package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.CommentRepository;
import com.nearrish.backend.repository.LikeRepository;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.service.PostService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/public/posts")
public class PublicPostController {

    private final PostService postService;
    private final LikeRepository likeRepository;
    private final UserRepository userRepository;
    private final CommentRepository commentRepository;

    public PublicPostController(PostService postService, LikeRepository likeRepository,
                                UserRepository userRepository, CommentRepository commentRepository) {
        this.postService = postService;
        this.likeRepository = likeRepository;
        this.userRepository = userRepository;
        this.commentRepository = commentRepository;
    }

    @GetMapping("/feed")
    public List<PostResponse> getPublicFeed() {
        return enrich(postService.getPublicFeed());
    }

    @GetMapping("/feed/geo")
    public List<PostResponse> getPublicGeoFeed() {
        return enrich(postService.getPublicGeoFeed());
    }

    @GetMapping("/search")
    public List<PostResponse> searchPosts(@RequestParam String q) {
        return enrich(postService.searchPublicPosts(q));
    }

    @GetMapping("/by-user/{userId}")
    public List<PostResponse> getPostsByUser(@PathVariable String userId) {
        return enrich(postService.getPublicPostsByAuthor(userId));
    }

    private List<PostResponse> enrich(List<Post> posts) {
        if (posts.isEmpty()) return List.of();
        Set<String> authorIds = posts.stream().map(Post::getAuthorId).collect(Collectors.toSet());
        Map<String, User> authorMap = userRepository.findAllById(authorIds)
                .stream().collect(Collectors.toMap(User::getId, u -> u));
        return posts.stream().map(p -> {
            User author = authorMap.get(p.getAuthorId());
            PostResponse.AuthorInfo info = author != null
                    ? new PostResponse.AuthorInfo(author.getId(), author.getUsername(), author.getAvatarUrl())
                    : new PostResponse.AuthorInfo(p.getAuthorId(), "Unknown", null);
            return PostResponse.from(p, info,
                    likeRepository.countByPostId(p.getId()),
                    false,
                    commentRepository.countByPost_Id(p.getId()));
        }).collect(Collectors.toList());
    }
}
