package com.nearrish.backend.controller;

import com.nearrish.backend.controller.forms.LoginForm;
import com.nearrish.backend.controller.forms.LoginFormResponse;
import com.nearrish.backend.controller.forms.RegistrationForm;
import com.nearrish.backend.controller.forms.RegistrationFormResponse;
import com.nearrish.backend.security.ApiAuthenticationService;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.service.ModerationClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthenticationController {
    private final UserRepository userRepository;
    private final ApiAuthenticationService authenticationService;
    private final ModerationClient moderationClient;

    public AuthenticationController(UserRepository userRepository, ApiAuthenticationService authenticationService,
                                    ModerationClient moderationClient) {
        this.userRepository = userRepository;
        this.authenticationService = authenticationService;
        this.moderationClient = moderationClient;
    }

    @PostMapping("/api/auth/login")
    public LoginFormResponse login(@RequestBody LoginForm form) {
        var user = userRepository.getByEmailOrUsername(form.getUsername(), form.getUsername());
        if (user == null || !user.checkPassword(form.getPassword())) {
            return new LoginFormResponse(false, null, "Invalid username or password", false);
        }
        String sessionToken = authenticationService.createJwtForUser(user, false);
        return new LoginFormResponse(true, sessionToken, null, user.getSecondFactor() != null && !user.getSecondFactor().isEmpty());
    }

    // TODO: @PostMapping("/auth/mfa")



    @PostMapping("/api/auth/registration")
    public RegistrationFormResponse register(@RequestBody RegistrationForm form) {
        if (userRepository.existsByEmail(form.getEmail())) {
            return new RegistrationFormResponse(false, "Email already in use", null);
        }
        if (userRepository.existsByUsername(form.getUsername())) {
            return new RegistrationFormResponse(false, "Username already in use", null);
        }

        ModerationClient.Result usernameMod = moderationClient.moderateUsername(form.getUsername());
        if (usernameMod.isBlocked()) {
            return new RegistrationFormResponse(false, usernameMod.reason(), null);
        }
        ModerationClient.Result nameMod = moderationClient.moderateText(form.getName());
        if (nameMod.isBlocked()) {
            return new RegistrationFormResponse(false, nameMod.reason(), null);
        }

        var user = new User(form.getUsername(), form.getEmail(), form.getPassword(), null);
        user.setName(form.getName());
        user.setNickname(form.getNickname());
        user.setAddress(form.getAddress());
        userRepository.save(user);
        String sessionToken = authenticationService.createJwtForUser(user, true);
        return new RegistrationFormResponse(true, null, sessionToken);
    }
}