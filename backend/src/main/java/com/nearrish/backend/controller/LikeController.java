package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Like;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.security.ApiAuthentication;
import com.nearrish.backend.service.LikeService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
public class LikeController {

    private final LikeService likeService;

    public LikeController(LikeService likeService) {
        this.likeService = likeService;
    }

    @PostMapping("/api/posts/{postId}/like")
    public Like likePost(@PathVariable String postId) {
        return likeService.likePost(currentUser(), postId);
    }

    @DeleteMapping("/api/posts/{postId}/like")
    public void unlikePost(@PathVariable String postId) {
        likeService.unlikePost(currentUser(), postId);
    }

    @GetMapping("/api/posts/{postId}/likes")
    public long getPostLikeCount(@PathVariable String postId) {
        return likeService.getPostLikeCount(postId);
    }

    @PostMapping("/api/comments/{commentId}/like")
    public Like likeComment(@PathVariable String commentId) {
        return likeService.likeComment(currentUser(), commentId);
    }

    @DeleteMapping("/api/comments/{commentId}/like")
    public void unlikeComment(@PathVariable String commentId) {
        likeService.unlikeComment(currentUser(), commentId);
    }

    @GetMapping("/api/comments/{commentId}/likes")
    public long getCommentLikeCount(@PathVariable String commentId) {
        return likeService.getCommentLikeCount(commentId);
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return ((ApiAuthentication) auth).getUser();
    }
}
