package com.nearrish.backend.controller.forms;

public class RegistrationForm {
    private final String username;
    private final String email;
    private final String password;
    private final String name;
    private final String nickname;
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
