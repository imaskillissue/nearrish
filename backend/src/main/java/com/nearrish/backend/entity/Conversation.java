package com.nearrish.backend.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "conversations")
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String name;

    private boolean isGroup = false;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "conversation_participants",
            joinColumns = @JoinColumn(name = "conversation_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<User> participants = new HashSet<>();

    private LocalDateTime createdAt = LocalDateTime.now();

    public Conversation() {}

    public Conversation(User a, User b) {
        this.participants.add(a);
        this.participants.add(b);
    }

    public Conversation(String name, Set<User> participants) {
        this.name = name;
        this.isGroup = true;
        this.participants = participants;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public boolean isGroup() { return isGroup; }
    public Set<User> getParticipants() { return participants; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
