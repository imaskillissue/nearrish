package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Comment;
import com.nearrish.backend.repository.LikeRepository;
import com.nearrish.backend.service.CommentService;
import com.nearrish.backend.service.LikeService;
import com.nearrish.backend.service.ModerationClient;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Public (no-auth) read-only endpoints for comments and like counts.
 * Allows unauthenticated users to view comments and like counts on public posts.
 */
@RestController
@RequestMapping("/api/public")
public class PublicInteractionController {

    private final CommentService commentService;
    private final LikeService likeService;
    private final ModerationClient moderationClient;
    private final LikeRepository likeRepository;

    public PublicInteractionController(CommentService commentService, LikeService likeService,
                                       ModerationClient moderationClient, LikeRepository likeRepository) {
        this.commentService = commentService;
        this.likeService = likeService;
        this.moderationClient = moderationClient;
        this.likeRepository = likeRepository;
    }

    @GetMapping("/posts/{postId}/comments")
    public List<Comment> getComments(@PathVariable String postId) {
        List<Comment> comments = commentService.getComments(postId);
        for (Comment c : comments) {
            c.setLikeCount(likeRepository.countByCommentId(c.getId()));
        }
        return comments;
    }

    @GetMapping("/posts/{postId}/comments/{commentId}")
    public Comment getComment(@PathVariable String postId, @PathVariable String commentId) {
        return commentService.getComment(commentId);
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

    @PostMapping("/moderate/registration")
    public Map<String, Object> moderateRegistration(@RequestBody Map<String, String> body) {
        String name     = body.getOrDefault("name", "");
        String nickname = body.getOrDefault("nickname", "");

        CompletableFuture<ModerationClient.Result> nameFuture =
                CompletableFuture.supplyAsync(() -> moderationClient.moderateText(name));
        CompletableFuture<ModerationClient.Result> nicknameFuture =
                CompletableFuture.supplyAsync(() -> moderationClient.moderateUsername(nickname));

        ModerationClient.Result nameResult     = nameFuture.join();
        ModerationClient.Result nicknameResult = nicknameFuture.join();

        Map<String, Object> nameField     = new HashMap<>();
        nameField.put("blocked", nameResult.isBlocked());
        nameField.put("reason",  nameResult.isBlocked() ? "This name is not allowed." : "");

        Map<String, Object> nicknameField = new HashMap<>();
        nicknameField.put("blocked", nicknameResult.isBlocked());
        nicknameField.put("reason",  nicknameResult.isBlocked() ? "This nickname is not allowed." : "");

        Map<String, Object> result = new HashMap<>();
        result.put("name",     nameField);
        result.put("nickname", nicknameField);
        return result;
    }
}
