package com.example.demo.dto;

import com.example.demo.model.User;
import java.time.Instant;

public record UserResponse(
    Long id,
    String username,
    String displayName,
    Instant createdAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
            user.getId(),
            user.getUsername(),
            user.getDisplayName(),
            user.getCreatedAt()
        );
    }
}
