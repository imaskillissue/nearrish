package com.nearrish.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "comments")
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id")
    private Post post;

    @JsonIgnoreProperties({"passwordHash", "email", "secondFactor", "roles", "lastOnline"})
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "author_id")
    private User author;

    private String content;

    // Keep as LocalDateTime so the DB TIMESTAMP column stays compatible.
    // Serialize as epoch millis for the frontend via the @JsonProperty getter below.
    private LocalDateTime createdAt = LocalDateTime.now();

    public Comment() {}

    public Comment(Post post, User author, String content) {
        this.post = post;
        this.author = author;
        this.content = content;
    }

    public String getId() { return id; }
    public Post getPost() { return post; }
    public User getAuthor() { return author; }
    public String getContent() { return content; }

    /** Returns the DB-stored LocalDateTime — hidden from JSON. */
    @JsonIgnore
    public LocalDateTime getCreatedAt() { return createdAt; }

    /** Serialized as "createdAt" in JSON responses as epoch millis. */
    @JsonProperty("createdAt")
    public long getCreatedAtMs() {
        return createdAt == null ? 0L : createdAt.toInstant(ZoneOffset.UTC).toEpochMilli();
    }
}
