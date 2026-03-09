package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
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
import java.util.UUID;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    @PostMapping
    public Post createPost(@RequestParam String text,
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
        return postService.createPost(currentUser(), text, respondingToId, latitude, longitude, imageUrl, vis);
    }

    @GetMapping("/feed")
    public List<Post> getFeed() {
        return postService.getFeed(currentUser());
    }

    @GetMapping("/feed/geo")
    public List<Post> getGeoFeed() {
        return postService.getGeoFeed(currentUser());
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
    public Post getPost(@PathVariable String postId) {
        return postService.getPost(postId);
    }

    @GetMapping("/by-author/{authorId}")
    public List<Post> getPostsByAuthor(@PathVariable String authorId) {
        return postService.getPostsByAuthor(authorId);
    }

    @GetMapping("/{postId}/replies")
    public List<Post> getReplies(@PathVariable String postId) {
        return postService.getReplies(postId);
    }

    @DeleteMapping("/{postId}")
    public void deletePost(@PathVariable String postId) {
        postService.deletePost(currentUser(), postId);
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return ((ApiAuthentication) auth).getUser();
    }
}
