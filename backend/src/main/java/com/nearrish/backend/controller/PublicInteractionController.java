package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Comment;
import com.nearrish.backend.service.CommentService;
import com.nearrish.backend.service.LikeService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Public (no-auth) read-only endpoints for comments and like counts.
 * Allows unauthenticated users to view comments and like counts on public posts.
 */
@RestController
@RequestMapping("/api/public")
public class PublicInteractionController {

    private final CommentService commentService;
    private final LikeService likeService;

    public PublicInteractionController(CommentService commentService, LikeService likeService) {
        this.commentService = commentService;
        this.likeService = likeService;
    }

    @GetMapping("/posts/{postId}/comments")
    public List<Comment> getComments(@PathVariable String postId) {
        return commentService.getComments(postId);
    }

    @GetMapping("/posts/{postId}/comments/count")
    public Map<String, Long> getCommentCount(@PathVariable String postId) {
        return Map.of("count", commentService.getCommentCount(postId));
    }

    @GetMapping("/posts/{postId}/likes")
    public long getPostLikeCount(@PathVariable String postId) {
        return likeService.getPostLikeCount(postId);
    }

    @GetMapping("/comments/{commentId}/likes")
    public long getCommentLikeCount(@PathVariable String commentId) {
        return likeService.getCommentLikeCount(commentId);
    }
}
