package com.nearrish.backend.controller;

import com.nearrish.backend.controller.forms.LoginForm;
import com.nearrish.backend.controller.forms.RegistrationForm;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.security.ApiAuthenticationService;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest( properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password="
}, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthenticationControllerTest {
    @Autowired
    private ApiAuthenticationService authenticationService;
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
        // Arrange
        var user = new User("validUser", "valid@example.com", "password123", null);
        userRepository.save(user);

        var loginForm = new LoginForm("validUser", "password123");

        // Act
        var response = authenticationController.login(loginForm);

        // Assert
        System.out.println(response.getErrorMessage());
        assertTrue(response.isSuccess());
        assertNotNull(response.getSessionToken());
        assertNull(response.getErrorMessage());
        assertFalse(response.isSecondFactorRequired());
    }

    @Test
    void loginWithInvalidCredentialsReturnsErrorResponse() {
        // Arrange
        var user = new User("validUser", "valid@example.com", "password123", null);
        userRepository.save(user);

        var loginForm = new LoginForm("validUser", "wrongPassword");

        // Act
        var response = authenticationController.login(loginForm);

        // Assert
        assertFalse(response.isSuccess());
        assertNull(response.getSessionToken());
        assertEquals("Invalid username or password", response.getErrorMessage());
    }

    @Test
    void registerWithUniqueEmailAndUsernameReturnsSuccessResponse() {
        // Arrange
        var registrationForm = new RegistrationForm("newUser", "new@example.com", "password123");

        // Act
        var response = authenticationController.register(registrationForm);

        // Assert
        assertTrue(response.isSuccess());
        assertNotNull(response.getSessionToken());
        assertNull(response.getErrorMessage());
    }

    @Test
    void registerWithDuplicateEmailReturnsErrorResponse() {
        // Arrange
        var existingUser = new User("existingUser", "duplicate@example.com", "password123", null);
        userRepository.save(existingUser);

        var registrationForm = new RegistrationForm("newUser", "duplicate@example.com", "password123");

        // Act
        var response = authenticationController.register(registrationForm);

        // Assert
        assertFalse(response.isSuccess());
        assertEquals("Email already in use", response.getErrorMessage());
        assertNull(response.getSessionToken());
    }

    @Test
    void registerWithDuplicateUsernameReturnsErrorResponse() {
        // Arrange
        var existingUser = new User("duplicateUser", "unique@example.com", "password123", null);
        userRepository.save(existingUser);

        var registrationForm = new RegistrationForm("duplicateUser", "new@example.com", "password123");

        // Act
        var response = authenticationController.register(registrationForm);

        // Assert
        assertFalse(response.isSuccess());
        assertEquals("Username already in use", response.getErrorMessage());
        assertNull(response.getSessionToken());
    }

}