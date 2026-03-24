package com.nearrish.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "friend_requests")
public class FriendRequest {

    public enum Status { PENDING, ACCEPTED, DECLINED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @JsonIgnoreProperties({"passwordHash", "email", "secondFactor", "roles", "lastOnline"})
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "sender_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User sender;

    @JsonIgnoreProperties({"passwordHash", "email", "secondFactor", "roles", "lastOnline"})
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "receiver_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User receiver;

    @Enumerated(EnumType.STRING)
    private Status status = Status.PENDING;

    // Keep as LocalDateTime so the DB TIMESTAMP column stays compatible.
    // Serialize as epoch millis for the frontend via the @JsonProperty getter below.
    private LocalDateTime createdAt = LocalDateTime.now();

    public FriendRequest() {}

    public FriendRequest(User sender, User receiver) {
        this.sender = sender;
        this.receiver = receiver;
    }

    public String getId() { return id; }
    public User getSender() { return sender; }
    public User getReceiver() { return receiver; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    /** Returns the DB-stored LocalDateTime — hidden from JSON. */
    @JsonIgnore
    public LocalDateTime getCreatedAt() { return createdAt; }

    /** Serialized as "createdAt" in JSON responses as epoch millis. */
    @JsonProperty("createdAt")
    public long getCreatedAtMs() {
        return createdAt == null ? 0L : createdAt.toInstant(ZoneOffset.UTC).toEpochMilli();
    }
}
