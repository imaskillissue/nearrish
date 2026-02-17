package com.nearrish.backend.auth.forms;

public class RegistrationForm {
    private final String username;
    private final String email;
    private final String password;

    public RegistrationForm(String username, String email, String password) {
        this.username = username;
        this.email = email;
        this.password = password;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }
}
