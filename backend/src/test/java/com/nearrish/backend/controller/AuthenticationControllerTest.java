package com.nearrish.backend.controller;

import com.nearrish.backend.controller.forms.LoginForm;
import com.nearrish.backend.controller.forms.RegistrationForm;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "MODERATION_ENABLED=false"
}, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthenticationControllerTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private AuthenticationController authenticationController;

    @AfterEach
    void tearDown() {
        userRepository.deleteAll();
    }

    @Test
    void loginWithValidCredentialsReturnsSuccessResponse() {
        var user = new User("validUser", "valid@example.com", "password123", null);
        userRepository.save(user);

        var response = authenticationController.login(new LoginForm("validUser", "password123"));

        assertTrue(response.isSuccess());
        assertNotNull(response.getSessionToken());
        assertNull(response.getErrorMessage());
        assertFalse(response.isSecondFactorRequired());
    }

    @Test
    void loginWithInvalidPasswordReturnsError() {
        var user = new User("validUser", "valid@example.com", "password123", null);
        userRepository.save(user);

        var response = authenticationController.login(new LoginForm("validUser", "wrongPassword"));

        assertFalse(response.isSuccess());
        assertNull(response.getSessionToken());
        assertEquals("Invalid username or password", response.getErrorMessage());
    }

    @Test
    void loginWithUnknownUserReturnsError() {
        var response = authenticationController.login(new LoginForm("nobody", "pass"));

        assertFalse(response.isSuccess());
        assertNull(response.getSessionToken());
    }

    @Test
    void registerWithUniqueCredentialsReturnsSuccess() {
        var form = new RegistrationForm("newUser", "new@example.com", "pass123", "New User", "newUser", "");

        var response = authenticationController.register(form);

        assertTrue(response.isSuccess());
        assertNotNull(response.getSessionToken());
        assertNull(response.getErrorMessage());
    }

    @Test
    void registerWithDuplicateEmailReturnsError() {
        userRepository.save(new User("existing", "dup@example.com", "pass", null));

        var response = authenticationController.register(
                new RegistrationForm("other", "dup@example.com", "pass", "Other", "other", ""));

        assertFalse(response.isSuccess());
        assertEquals("Email already in use", response.getErrorMessage());
        assertNull(response.getSessionToken());
    }

    @Test
    void registerWithDuplicateUsernameReturnsError() {
        userRepository.save(new User("taken", "a@example.com", "pass", null));

        var response = authenticationController.register(
                new RegistrationForm("taken", "b@example.com", "pass", "Taken", "taken", ""));

        assertFalse(response.isSuccess());
        assertEquals("Username already in use", response.getErrorMessage());
        assertNull(response.getSessionToken());
    }

    @Test
    void loginJwtContainsRolesClaim() {
        var user = new User("roleUser", "role@example.com", "pass123", null);
        user.addRole("USER");
        userRepository.save(user);

        var response = authenticationController.login(new LoginForm("roleUser", "pass123"));

        assertTrue(response.isSuccess());
        assertNotNull(response.getSessionToken());
        // JWT has three parts; decode payload to verify roles claim is present
        String[] parts = response.getSessionToken().split("\\.");
        assertEquals(3, parts.length);
        String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
        assertTrue(payload.contains("roles"), "JWT payload should contain roles claim");
    }
}
