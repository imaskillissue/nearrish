package com.nearrish.backend.entity;

import jakarta.persistence.*;
import org.springframework.security.crypto.scrypt.SCryptPasswordEncoder;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    private String username;
    private String email;
    private String passwordHash;
    /**
     * 2fa Secret, leave empty if disabled
     * */
    private String secondFactor;

    @ElementCollection(fetch = FetchType.EAGER)
    private Set<String> roles;
    private long lastOnline;
    private String avatarUrl;
    private String name;
    private String nickname;
    private String address;

    public User(String id, String username, String email, String password, String secondFactor) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.passwordHash = SCryptPasswordEncoder.defaultsForSpringSecurity_v5_8().encode(password);
        this.secondFactor = secondFactor;
    }

    public User(String username, String email, String password, String secondFactor) {
        this.username = username;
        this.email = email;
        this.passwordHash = SCryptPasswordEncoder.defaultsForSpringSecurity_v5_8().encode(password);
        this.secondFactor = secondFactor;
    }

    public User() {

    }

    public void setId(String id) {
        this.id = id;
    }

    public String getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getSecondFactor() {
        return secondFactor;
    }

    public String[] getRoles() {
        if (roles == null) return new String[0];
        return roles.toArray(new String[0]);
    }

    public void setRoles(Set<String> role) {
        this.roles = role;
    }

    public void addRole(String role) {
        if (this.roles == null) {
            this.roles = new HashSet<>();
        }
        this.roles.add(role);
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public void setSecondFactor(String secondFactor) {
        this.secondFactor = secondFactor;
    }

    public boolean checkPassword(String password) {
        return SCryptPasswordEncoder.defaultsForSpringSecurity_v5_8().matches(password, this.passwordHash);
    }

    public long getLastOnline() {
        return lastOnline;
    }

    public void setLastOnline(long lastOnline) {
        this.lastOnline = lastOnline;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
}
