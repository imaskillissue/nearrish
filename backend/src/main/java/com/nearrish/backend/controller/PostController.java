package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.CommentRepository;
import com.nearrish.backend.repository.LikeRepository;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.security.ApiAuthentication;
import com.nearrish.backend.service.PostService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService postService;
    private final LikeRepository likeRepository;
    private final UserRepository userRepository;
    private final CommentRepository commentRepository;

    public PostController(PostService postService, LikeRepository likeRepository,
                          UserRepository userRepository, CommentRepository commentRepository) {
        this.postService = postService;
        this.likeRepository = likeRepository;
        this.userRepository = userRepository;
        this.commentRepository = commentRepository;
    }

    @PostMapping
    public PostResponse createPost(@RequestParam String text,
                                   @RequestParam(required = false) String respondingToId,
                                   @RequestParam(required = false) Double latitude,
                                   @RequestParam(required = false) Double longitude,
                                   @RequestParam(required = false) String imageUrl,
                                   @RequestParam(required = false, defaultValue = "PUBLIC") String visibility) {
        Post.Visibility vis;
        try {
            vis = Post.Visibility.valueOf(visibility.toUpperCase());
        } catch (IllegalArgumentException e) {
            vis = Post.Visibility.PUBLIC;
        }
        User user = currentUser();
        Post post = postService.createPost(user, text, respondingToId, latitude, longitude, imageUrl, vis);
        return toResponse(post, user, user);
    }

    @GetMapping("/feed")
    public List<PostResponse> getFeed() {
        User user = currentUser();
        return toResponses(postService.getFeed(user), user);
    }

    @GetMapping("/feed/geo")
    public List<PostResponse> getGeoFeed() {
        User user = currentUser();
        return toResponses(postService.getGeoFeed(user), user);
    }

    @PostMapping("/upload-image")
    public Map<String, String> uploadImage(@RequestParam("file") MultipartFile file) throws IOException {
        String filename = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path uploadDir = Paths.get("/app/uploads");
        Files.createDirectories(uploadDir);
        Files.copy(file.getInputStream(), uploadDir.resolve(filename));
        return Map.of("filename", filename, "url", "/uploads/" + filename);
    }

    @GetMapping("/{postId}")
    public PostResponse getPost(@PathVariable String postId) {
        return toResponse(postService.getPost(postId), currentUser());
    }

    @GetMapping("/by-author/{authorId}")
    public List<PostResponse> getPostsByAuthor(@PathVariable String authorId) {
        return toResponses(postService.getPostsByAuthor(authorId), currentUser());
    }

    @GetMapping("/{postId}/replies")
    public List<PostResponse> getReplies(@PathVariable String postId) {
        return toResponses(postService.getReplies(postId), currentUser());
    }

    @DeleteMapping("/{postId}")
    public void deletePost(@PathVariable String postId) {
        postService.deletePost(currentUser(), postId);
    }

    private List<PostResponse> toResponses(List<Post> posts, User currentUser) {
        if (posts.isEmpty()) return List.of();
        Set<String> authorIds = posts.stream().map(Post::getAuthorId).collect(Collectors.toSet());
        Map<String, User> authorMap = userRepository.findAllById(authorIds)
                .stream().collect(Collectors.toMap(User::getId, u -> u));
        return posts.stream()
                .map(p -> toResponse(p, authorMap.get(p.getAuthorId()), currentUser))
                .collect(Collectors.toList());
    }

    private PostResponse toResponse(Post post, User currentUser) {
        User author = userRepository.findById(post.getAuthorId()).orElse(null);
        return toResponse(post, author, currentUser);
    }

    private PostResponse toResponse(Post post, User author, User currentUser) {
        PostResponse.AuthorInfo info = author != null
                ? new PostResponse.AuthorInfo(author.getId(), author.getUsername(), author.getAvatarUrl())
                : new PostResponse.AuthorInfo(post.getAuthorId(), "Unknown", null);
        long likeCount = likeRepository.countByPostId(post.getId());
        boolean userLiked = currentUser != null
                && likeRepository.existsByUserIdAndPostId(currentUser.getId(), post.getId());
        long commentCount = commentRepository.countByPost_Id(post.getId());
        return PostResponse.from(post, info, likeCount, userLiked, commentCount);
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return ((ApiAuthentication) auth).getUser();
    }
}
