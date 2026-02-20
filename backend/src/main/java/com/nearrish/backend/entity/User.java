package com.nearrish.backend.entity;

import jakarta.persistence.*;
import org.springframework.security.crypto.scrypt.SCryptPasswordEncoder;

import java.util.ArrayList;

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

    @ElementCollection
    private ArrayList<String> roles;

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

    public String[] getRoles() {
        return roles.toArray(new String[0]);
    }

    public void setRoles(ArrayList<String> role) {
        this.roles = role;
    }



    public boolean checkPassword(String password) {
        return SCryptPasswordEncoder.defaultsForSpringSecurity_v5_8().matches(password, this.passwordHash);
    }
}
