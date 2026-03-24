package com.nearrish.backend.controller;

import com.auth0.jwt.interfaces.DecodedJWT;
import com.nearrish.backend.controller.forms.*;
import com.nearrish.backend.security.ApiAuthenticationService;
import jakarta.validation.Valid;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.service.ModerationClient;
import com.nearrish.backend.service.TotpService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthenticationController {
    private final UserRepository userRepository;
    private final ApiAuthenticationService authenticationService;
    private final ModerationClient moderationClient;
    private final TotpService totpService;

    public AuthenticationController(UserRepository userRepository, ApiAuthenticationService authenticationService,
                                    ModerationClient moderationClient, TotpService totpService) {
        this.userRepository = userRepository;
        this.authenticationService = authenticationService;
        this.moderationClient = moderationClient;
        this.totpService = totpService;
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

    @PostMapping("/api/auth/2fa/validate")
    public TotpActionResponse validate(@RequestBody TotpValidateForm form) {
        DecodedJWT decoded;
        try {
            decoded = authenticationService.verifyToken(form.getToken());
        } catch (Exception e) {
            return new TotpActionResponse(false, "Invalid or expired session", null);
        }
        var user = userRepository.getByIdAndUsername(
                decoded.getClaim("userId").asString(),
                decoded.getClaim("username").asString()
        );
        if (user == null || user.getSecondFactor() == null || user.getSecondFactor().isEmpty()) {
            return new TotpActionResponse(false, "Invalid session", null);
        }
        if (!totpService.verifyCode(user.getSecondFactor(), form.getCode())) {
            return new TotpActionResponse(false, "Invalid authenticator code", null);
        }
        String fullToken = authenticationService.createJwtForUser(user, true);
        return new TotpActionResponse(true, null, fullToken);
    }

    @PostMapping("/api/auth/registration")
    public RegistrationFormResponse register(@Valid @RequestBody RegistrationForm form) {
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