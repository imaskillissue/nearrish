package com.example.demo.dto;

import com.example.demo.model.Post;
import java.time.Instant;

public record PostResponse(
    Long id,
    String content,
    String authorId,
    int moderationSeverity,
    String moderationCategory,
    Instant createdAt,
    Double latitude,
    Double longitude
) {
    public static PostResponse from(Post post) {
        return new PostResponse(
            post.getId(),
            post.getContent(),
            post.getAuthorId(),
            post.getModerationSeverity(),
            post.getModerationCategory(),
            post.getCreatedAt(),
            post.getLatitude(),
            post.getLongitude()
        );
    }
}
