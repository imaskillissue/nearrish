package com.example.demo.dto;

import com.example.demo.model.ChatMessage;
import java.time.Instant;

public record ChatMessageResponse(
    Long id,
    String content,
    String senderUsername,
    int moderationSeverity,
    String moderationCategory,
    Instant createdAt
) {
    public static ChatMessageResponse from(ChatMessage msg) {
        return new ChatMessageResponse(
            msg.getId(),
            msg.getContent(),
            msg.getSenderUsername(),
            msg.getModerationSeverity(),
            msg.getModerationCategory(),
            msg.getCreatedAt()
        );
    }
}
