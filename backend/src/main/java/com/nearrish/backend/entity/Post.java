package com.nearrish.backend.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;

@Entity
public class Post {
    @Id
    @GeneratedValue(strategy = jakarta.persistence.GenerationType.UUID)
    private String id;
    private String text;
    private String authorId;
    private long timestamp;
    private String respondingToId;
    // TODO: Location

    public Post(String text, String authorId, String respondingToId) {
        this.text = text;
        this.authorId = authorId;
        this.timestamp = System.currentTimeMillis();
        this.respondingToId = respondingToId;
    }

    public Post() {

    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getAuthorId() {
        return authorId;
    }

    public void setAuthorId(String authorId) {
        this.authorId = authorId;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

    public String getRespondingToId() {
        return respondingToId;
    }

    public void setRespondingToId(String respondingToId) {
        this.respondingToId = respondingToId;
    }
}
