package com.nearrish.backend.auth.forms;

public class LoginForm {
    private final String usernameOrMail;
    private final String password;

    public LoginForm(String usernameOrMail, String password) {
        this.usernameOrMail = usernameOrMail;
        this.password = password;
    }

    public String getUsernameOrMail() {
        return usernameOrMail;
    }

    public String getPassword() {
        return password;
    }
}
