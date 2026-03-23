package com.nearrish.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_toxicity_reports")
public class UserToxicityReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String userId;

    private int score;

    @Column(columnDefinition = "TEXT")
    private String summary;

    private LocalDateTime generatedAt = LocalDateTime.now();

    private String triggeredBy;

    private int postsTotal;
    private int postsBlocked;
    private int commentsTotal;
    private int commentsBlocked;
    private int messagesTotal;
    private int messagesBlocked;

    public UserToxicityReport() {}

    public String getId() { return id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }

    public String getTriggeredBy() { return triggeredBy; }
    public void setTriggeredBy(String triggeredBy) { this.triggeredBy = triggeredBy; }

    public int getPostsTotal() { return postsTotal; }
    public void setPostsTotal(int postsTotal) { this.postsTotal = postsTotal; }

    public int getPostsBlocked() { return postsBlocked; }
    public void setPostsBlocked(int postsBlocked) { this.postsBlocked = postsBlocked; }

    public int getCommentsTotal() { return commentsTotal; }
    public void setCommentsTotal(int commentsTotal) { this.commentsTotal = commentsTotal; }

    public int getCommentsBlocked() { return commentsBlocked; }
    public void setCommentsBlocked(int commentsBlocked) { this.commentsBlocked = commentsBlocked; }

    public int getMessagesTotal() { return messagesTotal; }
    public void setMessagesTotal(int messagesTotal) { this.messagesTotal = messagesTotal; }

    public int getMessagesBlocked() { return messagesBlocked; }
    public void setMessagesBlocked(int messagesBlocked) { this.messagesBlocked = messagesBlocked; }
}
