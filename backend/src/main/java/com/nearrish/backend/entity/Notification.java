package com.nearrish.backend.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;


@Entity
@Table(name = "notification")
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    // CHANGE THIS FROM @ManyToMany TO @ManyToOne
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User recipient;

    private String content;
    private boolean isRead = false;

    // Ensure this matches the 'OrderByCreatedAt' in your Repository
    private LocalDateTime createdAt = LocalDateTime.now();

    public Notification() {}

    public Notification(User recipient, String content) {
        this.recipient = recipient;
        this.content = content;
    }

    // Getters
    public String getId() { return id; }
    public String getContent() { return content; }
    public boolean isRead() { return isRead; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setRead(boolean read) { isRead = read; }
}