package com.nearrish.backend.user;

public class Session {
    private String username;
    private String userId;
    private long expiresAt;

    public Session(String username, String userId, long expiresAt) {
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

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public long getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(long expiresAt) {
        this.expiresAt = expiresAt;
    }
}
