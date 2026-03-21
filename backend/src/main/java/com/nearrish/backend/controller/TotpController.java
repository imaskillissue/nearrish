package com.nearrish.backend.controller;

import com.nearrish.backend.controller.forms.*;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.security.ApiAuthentication;
import com.nearrish.backend.security.ApiAuthenticationService;
import com.nearrish.backend.service.TotpService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class TotpController {

    private final TotpService totpService;
    private final UserRepository userRepository;
    private final ApiAuthenticationService authService;

    public TotpController(TotpService totpService, UserRepository userRepository,
                          ApiAuthenticationService authService) {
        this.totpService = totpService;
        this.userRepository = userRepository;
        this.authService = authService;
    }

    @GetMapping("/api/2fa/status")
    public Map<String, Boolean> status() {
        User user = currentUser();
        boolean enabled = user.getSecondFactor() != null && !user.getSecondFactor().isEmpty();
        return Map.of("enabled", enabled);
    }

    @PostMapping("/api/2fa/setup")
    public TotpSetupResponse setup() {
        User user = currentUser();
        String secret = totpService.generateSecret();
        String uri = totpService.getOtpAuthUri(secret, user.getUsername());
        return new TotpSetupResponse(secret, uri);
    }

    @PostMapping("/api/2fa/enable")
    public TotpActionResponse enable(@RequestBody TotpEnableForm form) {
        User user = currentUser();
        if (!totpService.verifyCode(form.getSecret(), form.getCode())) {
            return new TotpActionResponse(false, "Invalid code — check your authenticator app", null);
        }
        user.setSecondFactor(form.getSecret());
        userRepository.save(user);
        String token = authService.createJwtForUser(user, true);
        return new TotpActionResponse(true, "Two-factor authentication enabled", token);
    }

    @PostMapping("/api/2fa/disable")
    public TotpActionResponse disable(@RequestBody TotpDisableForm form) {
        User user = currentUser();
        if (!user.checkPassword(form.getPassword())) {
            return new TotpActionResponse(false, "Incorrect password", null);
        }
        if (user.getSecondFactor() == null || user.getSecondFactor().isEmpty()) {
            return new TotpActionResponse(false, "2FA is not enabled", null);
        }
        if (!totpService.verifyCode(user.getSecondFactor(), form.getCode())) {
            return new TotpActionResponse(false, "Invalid authenticator code", null);
        }
        user.setSecondFactor(null);
        userRepository.save(user);
        String token = authService.createJwtForUser(user, true);
        return new TotpActionResponse(true, "Two-factor authentication disabled", token);
    }

    private User currentUser() {
        return ((ApiAuthentication) SecurityContextHolder.getContext().getAuthentication()).getUser();
    }
}
