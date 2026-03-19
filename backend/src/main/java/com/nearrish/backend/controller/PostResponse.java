package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Post;

public class PostResponse {

    private String id;
    private String text;
    private String authorId;
    private long timestamp;
    private String respondingToId;
    private Double latitude;
    private Double longitude;
    private String imageUrl;
    private Post.Visibility visibility;

    private AuthorInfo author;
    private long likeCount;
    private boolean userLiked;
    private long commentCount;

    public record AuthorInfo(String id, String username, String avatarUrl) {}

    public static PostResponse from(Post post, AuthorInfo author, long likeCount, boolean userLiked, long commentCount) {
        PostResponse r = new PostResponse();
        r.id = post.getId();
        r.text = post.getText();
        r.authorId = post.getAuthorId();
        r.timestamp = post.getTimestamp();
        r.respondingToId = post.getRespondingToId();
        r.latitude = post.getLatitude();
        r.longitude = post.getLongitude();
        r.imageUrl = post.getImageUrl();
        r.visibility = post.getVisibility();
        r.author = author;
        r.likeCount = likeCount;
        r.userLiked = userLiked;
        r.commentCount = commentCount;
        return r;
    }

    public String getId() { return id; }
    public String getText() { return text; }
    public String getAuthorId() { return authorId; }
    public long getTimestamp() { return timestamp; }
    public String getRespondingToId() { return respondingToId; }
    public Double getLatitude() { return latitude; }
    public Double getLongitude() { return longitude; }
    public String getImageUrl() { return imageUrl; }
    public Post.Visibility getVisibility() { return visibility; }
    public AuthorInfo getAuthor() { return author; }
    public long getLikeCount() { return likeCount; }
    public boolean isUserLiked() { return userLiked; }
    public long getCommentCount() { return commentCount; }
}
