package com.nearrish.backend.user;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import org.springframework.security.crypto.scrypt.SCryptPasswordEncoder;

@Entity
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

    public User(String id, String username, String email, String password, String secondFactor) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.passwordHash = SCryptPasswordEncoder.defaultsForSpringSecurity_v5_8().encode(password);
        this.secondFactor = secondFactor;
    }

    public User(String username, String email, String passwordHash, String secondFactor) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
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

    public boolean checkPassword(String password) {
        return SCryptPasswordEncoder.defaultsForSpringSecurity_v5_8().matches(password, this.passwordHash);
    }
}
