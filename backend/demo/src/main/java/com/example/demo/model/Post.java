package com.example.demo.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 5000)
    private String content;

    @Column(nullable = false)
    private String authorId;

    @Column(nullable = false)
    private int moderationSeverity;

    @Column
    private String moderationCategory;

    @Column(nullable = false)
    private Instant createdAt;

    // Location fields (nullable for backward compatibility with existing posts)
    @Column
    private Double latitude;

    @Column
    private Double longitude;

    protected Post() {}

    public Post(String content, String authorId, int moderationSeverity, String moderationCategory) {
        this.content = content;
        this.authorId = authorId;
        this.moderationSeverity = moderationSeverity;
        this.moderationCategory = moderationCategory;
        this.createdAt = Instant.now();
    }

    public Post(String content, String authorId, int moderationSeverity, String moderationCategory,
                Double latitude, Double longitude) {
        this(content, authorId, moderationSeverity, moderationCategory);
        this.latitude = latitude;
        this.longitude = longitude;
    }

    // Getters
    public Long getId() { return id; }
    public String getContent() { return content; }
    public String getAuthorId() { return authorId; }
    public int getModerationSeverity() { return moderationSeverity; }
    public String getModerationCategory() { return moderationCategory; }
    public Instant getCreatedAt() { return createdAt; }
    public Double getLatitude() { return latitude; }
    public Double getLongitude() { return longitude; }

    // Setters where needed
    public void setContent(String content) { this.content = content; }
    public void setModerationSeverity(int severity) { this.moderationSeverity = severity; }
    public void setModerationCategory(String category) { this.moderationCategory = category; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
}
