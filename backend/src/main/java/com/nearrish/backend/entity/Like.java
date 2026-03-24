package com.nearrish.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_likes", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "post_id"}),
        @UniqueConstraint(columnNames = {"user_id", "comment_id"})
})
public class Like {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @JsonIgnoreProperties({"passwordHash", "email", "secondFactor", "roles", "lastOnline"})
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "post_id")
    private Post post;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "comment_id")
    private Comment comment;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Like() {}

    public static Like forPost(User user, Post post) {
        Like like = new Like();
        like.user = user;
        like.post = post;
        return like;
    }

    public static Like forComment(User user, Comment comment) {
        Like like = new Like();
        like.user = user;
        like.comment = comment;
        return like;
    }

    public String getId() { return id; }
    public User getUser() { return user; }
    public Post getPost() { return post; }
    public Comment getComment() { return comment; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
