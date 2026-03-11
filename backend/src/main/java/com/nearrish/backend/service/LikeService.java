package com.nearrish.backend.service;

import com.nearrish.backend.entity.Comment;
import com.nearrish.backend.entity.Like;
import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.CommentRepository;
import com.nearrish.backend.repository.LikeRepository;
import com.nearrish.backend.repository.PostRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LikeService {

    private final LikeRepository likeRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;

    public LikeService(LikeRepository likeRepository,
                       PostRepository postRepository,
                       CommentRepository commentRepository) {
        this.likeRepository = likeRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
    }

    public Like likePost(User user, String postId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));

        if (likeRepository.existsByUserIdAndPostId(user.getId(), postId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Post already liked");
        }

        return likeRepository.save(Like.forPost(user, post));
    }

    public void unlikePost(User user, String postId) {
        Like like = likeRepository.findByUserIdAndPostId(user.getId(), postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Like not found"));

        likeRepository.delete(like);
    }

    public long getPostLikeCount(String postId) {
        if (!postRepository.existsById(postId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found");
        }
        return likeRepository.countByPostId(postId);
    }

    public Like likeComment(User user, String commentId) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));

        if (likeRepository.existsByUserIdAndCommentId(user.getId(), commentId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Comment already liked");
        }

        return likeRepository.save(Like.forComment(user, comment));
    }

    public void unlikeComment(User user, String commentId) {
        Like like = likeRepository.findByUserIdAndCommentId(user.getId(), commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Like not found"));

        likeRepository.delete(like);
    }

    public boolean hasLikedPost(User user, String postId) {
        return likeRepository.existsByUserIdAndPostId(user.getId(), postId);
    }

    public boolean hasLikedComment(User user, String commentId) {
        return likeRepository.existsByUserIdAndCommentId(user.getId(), commentId);
    }

    public long getCommentLikeCount(String commentId) {
        if (!commentRepository.existsById(commentId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found");
        }
        return likeRepository.countByCommentId(commentId);
    }
}
