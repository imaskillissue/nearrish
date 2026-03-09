package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Comment;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.security.ApiAuthentication;
import com.nearrish.backend.service.CommentService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/posts/{postId}/comments")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @GetMapping
    public List<Comment> getComments(@PathVariable String postId) {
        return commentService.getComments(postId);
    }

    @GetMapping("/count")
    public Map<String, Long> getCommentCount(@PathVariable String postId) {
        return Map.of("count", commentService.getCommentCount(postId));
    }

    @PostMapping
    public Comment addComment(@PathVariable String postId, @RequestBody Map<String, String> body) {
        return commentService.addComment(currentUser(), postId, body.get("content"));
    }

    @DeleteMapping("/{commentId}")
    public void deleteComment(@PathVariable String postId, @PathVariable String commentId) {
        commentService.deleteComment(currentUser(), commentId);
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return ((ApiAuthentication) auth).getUser();
    }
}
