package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.security.ApiAuthentication;
import com.nearrish.backend.service.PostService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
                           @RequestParam(required = false) Double longitude) {
        return postService.createPost(currentUser(), text, respondingToId, latitude, longitude);
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
