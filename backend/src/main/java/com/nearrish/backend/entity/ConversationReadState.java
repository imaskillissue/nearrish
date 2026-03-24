package com.nearrish.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Tracks the last time a user read a conversation.
 * Used to compute per-user unread message counts without a shared isRead flag.
 */
@Entity
@Table(
    name = "conversation_read_state",
    uniqueConstraints = @UniqueConstraint(columnNames = {"conversation_id", "user_id"})
)
public class ConversationReadState {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "conversation_id", nullable = false)
    private String conversationId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "last_read_at", nullable = false)
    private LocalDateTime lastReadAt;

    public ConversationReadState() {}

    public ConversationReadState(String conversationId, String userId, LocalDateTime lastReadAt) {
        this.conversationId = conversationId;
        this.userId = userId;
        this.lastReadAt = lastReadAt;
    }

    public String getId() { return id; }
    public String getConversationId() { return conversationId; }
    public String getUserId() { return userId; }
    public LocalDateTime getLastReadAt() { return lastReadAt; }
    public void setLastReadAt(LocalDateTime lastReadAt) { this.lastReadAt = lastReadAt; }
}
