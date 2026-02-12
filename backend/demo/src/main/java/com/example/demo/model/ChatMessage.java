package com.example.demo.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "chat_messages")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 2000)
    private String content;

    @Column(nullable = false)
    private String senderUsername;

    @Column(nullable = false)
    private int moderationSeverity;

    @Column
    private String moderationCategory;

    @Column(nullable = false)
    private Instant createdAt;

    protected ChatMessage() {}

    public ChatMessage(String content, String senderUsername, int moderationSeverity, String moderationCategory) {
        this.content = content;
        this.senderUsername = senderUsername;
        this.moderationSeverity = moderationSeverity;
        this.moderationCategory = moderationCategory;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getContent() { return content; }
    public String getSenderUsername() { return senderUsername; }
    public int getModerationSeverity() { return moderationSeverity; }
    public String getModerationCategory() { return moderationCategory; }
    public Instant getCreatedAt() { return createdAt; }
}
