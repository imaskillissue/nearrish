package com.nearrish.backend.user;

public class Session {
    private String username;
    private long userId;
    private long expiresAt;

    public Session(String username, long userId, long expiresAt) {
        this.username = username;
        this.userId = userId;
        this.expiresAt = expiresAt;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public long getUserId() {
        return userId;
    }

    public void setUserId(long userId) {
        this.userId = userId;
    }

    public long getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(long expiresAt) {
        this.expiresAt = expiresAt;
    }
}
