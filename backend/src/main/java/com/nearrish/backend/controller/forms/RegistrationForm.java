package com.nearrish.backend.controller.forms;

import jakarta.validation.constraints.*;

public class RegistrationForm {
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 30, message = "Username must be 3–30 characters")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "Username may only contain letters, numbers and underscores")
    private final String username;

    @NotBlank(message = "Email is required")
    @Email(message = "Valid email address required")
    private final String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 128, message = "Password must be at least 8 characters")
    private final String password;

    @NotBlank(message = "Name is required")
    @Size(max = 60, message = "Name must be at most 60 characters")
    private final String name;

    @NotBlank(message = "Nickname is required")
    @Size(max = 60, message = "Nickname must be at most 60 characters")
    private final String nickname;

    @NotBlank(message = "Address is required")
    @Size(max = 200, message = "Address must be at most 200 characters")
    private final String address;

    public RegistrationForm(String username, String email, String password, String name, String nickname, String address) {
        this.username = username;
        this.email = email;
        this.password = password;
        this.name = name;
        this.nickname = nickname;
        this.address = address;
    }

    public String getUsername() { return username; }
    public String getEmail()    { return email; }
    public String getPassword() { return password; }
    public String getName()     { return name; }
    public String getNickname() { return nickname; }
    public String getAddress()  { return address; }
}
