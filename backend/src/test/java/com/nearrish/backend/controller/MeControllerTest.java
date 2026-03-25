package com.nearrish.backend.controller;

import com.auth0.jwt.interfaces.DecodedJWT;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.security.ApiAuthentication;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "MODERATION_ENABLED=false"
}, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MeControllerTest {

    @Autowired private MeController meController;
    @Autowired private UserRepository userRepository;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User("pwUser", "pw@example.com", "OldPass1!", null);
        userRepository.save(user);
        authenticateAs(user);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        userRepository.deleteAll();
    }

    // ── success ──────────────────────────────────────────────────────────────

    @Test
    void changePassword_withValidInput_returns200AndUpdatesPassword() {
        var res = meController.changePassword(Map.of(
                "currentPassword", "OldPass1!",
                "newPassword",     "NewPass2@"
        ));

        assertEquals(HttpStatus.OK, res.getStatusCode());

        // Verify new password is persisted and old one no longer works
        User fresh = userRepository.findById(user.getId()).orElseThrow();
        assertTrue(fresh.checkPassword("NewPass2@"),  "New password must authenticate");
        assertFalse(fresh.checkPassword("OldPass1!"), "Old password must no longer work");
    }

    // ── wrong current password ────────────────────────────────────────────────

    @Test
    void changePassword_withWrongCurrentPassword_returns403() {
        var res = meController.changePassword(Map.of(
                "currentPassword", "WrongPass1!",
                "newPassword",     "NewPass2@"
        ));

        assertEquals(HttpStatus.FORBIDDEN, res.getStatusCode());
        assertEquals("Current password is incorrect.", res.getBody().get("message"));

        // Password must not have changed
        User fresh = userRepository.findById(user.getId()).orElseThrow();
        assertTrue(fresh.checkPassword("OldPass1!"), "Password must remain unchanged after failed attempt");
    }

    // ── password strength rules ───────────────────────────────────────────────

    @Test
    void changePassword_withTooShortNewPassword_returns400() {
        var res = meController.changePassword(Map.of(
                "currentPassword", "OldPass1!",
                "newPassword",     "Ab1"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
        assertTrue(res.getBody().get("message").contains("8 characters"));
    }

    @Test
    void changePassword_withNoUppercase_returns400() {
        var res = meController.changePassword(Map.of(
                "currentPassword", "OldPass1!",
                "newPassword",     "nouppercase1"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
        assertTrue(res.getBody().get("message").contains("uppercase"));
    }

    @Test
    void changePassword_withNoLowercase_returns400() {
        var res = meController.changePassword(Map.of(
                "currentPassword", "OldPass1!",
                "newPassword",     "NOLOWERCASE1"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
        assertTrue(res.getBody().get("message").contains("lowercase"));
    }

    @Test
    void changePassword_withNoNumber_returns400() {
        var res = meController.changePassword(Map.of(
                "currentPassword", "OldPass1!",
                "newPassword",     "NoNumberHere"
        ));

        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
        assertTrue(res.getBody().get("message").contains("number"));
    }

    @Test
    void changePassword_withMissingFields_returns400() {
        var res = meController.changePassword(Map.of("currentPassword", "OldPass1!"));

        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void authenticateAs(User u) {
        DecodedJWT jwt = mock(DecodedJWT.class);
        ApiAuthentication auth = new ApiAuthentication(jwt, u, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
