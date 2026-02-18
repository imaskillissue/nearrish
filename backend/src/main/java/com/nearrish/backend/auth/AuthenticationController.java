package com.nearrish.backend.auth;

import com.nearrish.backend.auth.forms.LoginForm;
import com.nearrish.backend.auth.forms.LoginFormResponse;
import com.nearrish.backend.auth.forms.RegistrationForm;
import com.nearrish.backend.auth.forms.RegistrationFormResponse;
import com.nearrish.backend.security.ApiAuthenticationService;
import com.nearrish.backend.user.User;
import com.nearrish.backend.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthenticationController {
    @Autowired
    private final UserRepository userRepository;
    @Autowired
    private final ApiAuthenticationService authenticationService;

    public AuthenticationController(UserRepository userRepository, ApiAuthenticationService authenticationService) {
        this.userRepository = userRepository;
        this.authenticationService = authenticationService;
    }

    @PostMapping("/auth/login")
    public LoginFormResponse login(@RequestBody LoginForm form) {
        var user = userRepository.getByEmailOrUsername(form.getUsernameOrMail(), form.getUsernameOrMail());
        if (user == null || !user.checkPassword(form.getPassword())) {
            return new LoginFormResponse(false, null, "Invalid username or password", false);
        }
        String sessionToken = authenticationService.createJwtForUser(user, false);
        return new LoginFormResponse(true, sessionToken, null, user.getSecondFactor() != null && !user.getSecondFactor().isEmpty());
    }

    // TODO: @PostMapping("/auth/mfa")



    @PostMapping("/auth/registration")
    public RegistrationFormResponse register(@RequestBody RegistrationForm form) {
        if (userRepository.existsByEmail(form.getEmail())) {
            return new RegistrationFormResponse(false, "Email already in use", null);
        }
        if (userRepository.existsByUsername(form.getUsername())) {
            return new RegistrationFormResponse(false, "Username already in use", null);
        }
        var user = new User(form.getUsername(), form.getEmail(), form.getPassword(), null);
        userRepository.save(user);
        String sessionToken = authenticationService.createJwtForUser(user, true);
        return new RegistrationFormResponse(true, null, sessionToken);
    }
}