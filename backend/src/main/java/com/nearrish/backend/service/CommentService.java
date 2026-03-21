package com.nearrish.backend.service;

import com.nearrish.backend.entity.Comment;
import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.CommentRepository;
import com.nearrish.backend.repository.PostRepository;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service
public class CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final ModerationClient moderationClient;
    private final SimpMessagingTemplate messagingTemplate;

    public CommentService(CommentRepository commentRepository, PostRepository postRepository,
                          ModerationClient moderationClient, SimpMessagingTemplate messagingTemplate) {
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
        this.moderationClient = moderationClient;
        this.messagingTemplate = messagingTemplate;
    }

    public Comment addComment(User author, String postId, String content) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));

        Comment saved = commentRepository.save(new Comment(post, author, content));
        String savedId = saved.getId();

        messagingTemplate.convertAndSend("/topic/posts",
                "NEW_COMMENT:" + postId + ":" + savedId);

        String postText = post.getText();
        CompletableFuture.runAsync(() -> {
            ModerationClient.Result mod = moderationClient.moderateComment(content, postText);
            commentRepository.findById(savedId).ifPresent(c -> {
                c.setSentiment(mod.sentiment());
                if (mod.isBlocked()) {
                    String reason = mod.reason() != null ? mod.reason() : "Content removed by moderation";
                    c.setModerated(true);
                    c.setModerationReason(reason);
                }
                commentRepository.save(c);
            });
            if (mod.isBlocked()) {
                String reason = mod.reason() != null ? mod.reason() : "Content removed by moderation";
                messagingTemplate.convertAndSend("/topic/posts",
                        "MODERATED_COMMENT:" + savedId + ":" + postId + ":" + reason);
            }
        });
        return saved;
    }

    public Comment getComment(String commentId) {
        return commentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));
    }

    public List<Comment> getComments(String postId) {
        if (!postRepository.existsById(postId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found");
        }
        return commentRepository.findByPost_IdOrderByCreatedAt(postId);
    }

    public long getCommentCount(String postId) {
        if (!postRepository.existsById(postId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found");
        }
        return commentRepository.countByPost_Id(postId);
    }

    public void deleteComment(User currentUser, String commentId) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));

        if (!comment.getAuthor().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot delete someone else's comment");
        }

        String postId = comment.getPost().getId();
        commentRepository.delete(comment);
        messagingTemplate.convertAndSend("/topic/posts",
                "DELETED_COMMENT:" + postId + ":" + commentId);
    }
}
