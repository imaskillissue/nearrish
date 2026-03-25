package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Comment;
import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.*;
import com.nearrish.backend.security.ApiAuthentication;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/search/advanced")
public class SearchAdvancedController {

    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final UserRepository userRepository;
    private final LikeRepository likeRepository;
    private final FriendRequestRepository friendRequestRepository;

    public SearchAdvancedController(PostRepository postRepository,
                                    CommentRepository commentRepository,
                                    UserRepository userRepository,
                                    LikeRepository likeRepository,
                                    FriendRequestRepository friendRequestRepository) {
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.userRepository = userRepository;
        this.likeRepository = likeRepository;
        this.friendRequestRepository = friendRequestRepository;
    }

    @GetMapping
    public Map<String, Object> search(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "posts") String type,
            @RequestParam(defaultValue = "recent") String sort,
            @RequestParam(defaultValue = "false") boolean friendsOnly,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {

        User currentUser = ((ApiAuthentication) authentication).getUser();
        List<String> friendIds = friendsOnly ? getFriendIds(currentUser.getId()) : List.of();

        return switch (type) {
            case "comments" -> searchComments(q, sort, friendsOnly, friendIds, page, size);
            case "users"    -> searchUsers(q, friendsOnly, friendIds, page, size);
            default         -> searchPosts(q, sort, friendsOnly, friendIds, lat, lng, page, size);
        };
    }

    private List<String> getFriendIds(String userId) {
        return friendRequestRepository.findAcceptedFriendships(userId).stream()
                .map(f -> f.getSender().getId().equals(userId)
                        ? f.getReceiver().getId()
                        : f.getSender().getId())
                .collect(Collectors.toList());
    }

    // ── Posts ─────────────────────────────────────────────────────────────────

    private Map<String, Object> searchPosts(String q, String sort, boolean friendsOnly,
                                             List<String> friendIds,
                                             Double lat, Double lng, int page, int size) {
        List<Post> posts;
        if (friendsOnly) {
            posts = friendIds.isEmpty() ? List.of()
                    : (q.isBlank() ? postRepository.findByFriends(friendIds)
                                   : postRepository.searchByFriends(q.trim(), friendIds));
        } else {
            posts = q.isBlank() ? postRepository.findPublicFeed()
                                : postRepository.searchPublicPosts(q.trim());
        }

        List<String> postIds = posts.stream().map(Post::getId).toList();
        Map<String, Long> likeCounts    = batchPostLikes(postIds);
        Map<String, Long> commentCounts = batchCommentCounts(postIds);

        Comparator<Post> cmp = switch (sort) {
            case "likes"    -> Comparator.comparingLong((Post p) -> likeCounts.getOrDefault(p.getId(), 0L)).reversed();
            case "comments" -> Comparator.comparingLong((Post p) -> commentCounts.getOrDefault(p.getId(), 0L)).reversed();
            case "toxicity" -> Comparator.comparingInt((Post p) ->
                    p.getModerationSeverity() == null ? -1 : p.getModerationSeverity()).reversed();
            case "closest"  -> (lat == null || lng == null)
                    ? Comparator.comparingLong(Post::getTimestamp).reversed()
                    : Comparator.comparingDouble((Post p) -> {
                        if (p.getLatitude() == null || p.getLongitude() == null) return Double.MAX_VALUE;
                        double dlat = p.getLatitude() - lat, dlng = p.getLongitude() - lng;
                        return dlat * dlat + dlng * dlng;
                    });
            default         -> Comparator.comparingLong(Post::getTimestamp).reversed();
        };

        List<Post> sorted = new ArrayList<>(posts);
        sorted.sort(cmp);
        int total = sorted.size();
        List<Post> slice = paginate(sorted, page, size);

        Set<String> authorIds = slice.stream().map(Post::getAuthorId).collect(Collectors.toSet());
        Map<String, User> authorMap = userRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        List<PostResponse> results = slice.stream().map(p -> {
            User author = authorMap.get(p.getAuthorId());
            PostResponse.AuthorInfo info = author != null
                    ? new PostResponse.AuthorInfo(author.getId(), author.getUsername(), author.getAvatarUrl())
                    : new PostResponse.AuthorInfo(p.getAuthorId(), "Unknown", null);
            return PostResponse.from(p, info,
                    likeCounts.getOrDefault(p.getId(), 0L),
                    false,
                    commentCounts.getOrDefault(p.getId(), 0L));
        }).toList();

        return result("posts", results, total, page, size);
    }

    // ── Comments ─────────────────────────────────────────────────────────────

    private Map<String, Object> searchComments(String q, String sort, boolean friendsOnly,
                                                List<String> friendIds, int page, int size) {
        List<Comment> comments;
        if (friendsOnly) {
            comments = friendIds.isEmpty() ? List.of()
                    : (q.isBlank() ? commentRepository.findByAuthorIds(friendIds)
                                   : commentRepository.searchByAuthorIds(q.trim(), friendIds));
        } else {
            comments = q.isBlank() ? commentRepository.findAllUnmoderated()
                                   : commentRepository.searchComments(q.trim());
        }

        List<String> cids = comments.stream().map(Comment::getId).toList();
        Map<String, Long> likeCounts = batchCommentLikes(cids);
        comments.forEach(c -> c.setLikeCount(likeCounts.getOrDefault(c.getId(), 0L)));

        Comparator<Comment> cmp = "likes".equals(sort)
                ? Comparator.comparingLong(Comment::getLikeCount).reversed()
                : Comparator.comparingLong(Comment::getCreatedAtMs).reversed();

        List<Comment> sorted = new ArrayList<>(comments);
        sorted.sort(cmp);
        int total = sorted.size();
        return result("comments", paginate(sorted, page, size), total, page, size);
    }

    // ── Users ─────────────────────────────────────────────────────────────────

    private Map<String, Object> searchUsers(String q, boolean friendsOnly,
                                             List<String> friendIds, int page, int size) {
        List<User> users = q.isBlank()
                ? userRepository.findAllDistinct()
                : userRepository.searchByUsernameOrName(q.trim());

        if (friendsOnly) {
            Set<String> friendSet = new HashSet<>(friendIds);
            users = users.stream().filter(u -> friendSet.contains(u.getId())).toList();
        }

        List<User> sorted = users.stream()
                .sorted(Comparator.comparing(u -> u.getUsername().toLowerCase()))
                .toList();

        List<Map<String, String>> results = paginate(sorted, page, size).stream().map(u -> {
            Map<String, String> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("username", u.getUsername());
            m.put("name", u.getName());
            m.put("avatarUrl", u.getAvatarUrl());
            return m;
        }).toList();

        return result("users", results, sorted.size(), page, size);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Map<String, Long> batchPostLikes(List<String> ids) {
        if (ids.isEmpty()) return Map.of();
        return likeRepository.countLikesByPostIds(ids).stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> (Long) r[1]));
    }

    private Map<String, Long> batchCommentLikes(List<String> ids) {
        if (ids.isEmpty()) return Map.of();
        return likeRepository.countLikesByCommentIds(ids).stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> (Long) r[1]));
    }

    private Map<String, Long> batchCommentCounts(List<String> postIds) {
        if (postIds.isEmpty()) return Map.of();
        return commentRepository.countByPostIds(postIds).stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> (Long) r[1]));
    }

    private <T> List<T> paginate(List<T> list, int page, int size) {
        int from = page * size;
        if (from >= list.size()) return List.of();
        return list.subList(from, Math.min(from + size, list.size()));
    }

    private Map<String, Object> result(String type, Object results, int total, int page, int size) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", type);
        m.put("total", total);
        m.put("page", page);
        m.put("size", size);
        m.put("hasMore", (long) (page + 1) * size < total);
        m.put("results", results);
        return m;
    }
}
