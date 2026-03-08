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
    private Double latitude;
    private Double longitude;
    private String imageUrl;

    public Post(String text, String authorId, String respondingToId) {
        this.text = text;
        this.authorId = authorId;
        this.timestamp = System.currentTimeMillis();
        this.respondingToId = respondingToId;
    }

    public Post(String text, String authorId, String respondingToId, Double latitude, Double longitude) {
        this.text = text;
        this.authorId = authorId;
        this.timestamp = System.currentTimeMillis();
        this.respondingToId = respondingToId;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public Post() {

    }

    public String getId() {
        return id;
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

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }
}
