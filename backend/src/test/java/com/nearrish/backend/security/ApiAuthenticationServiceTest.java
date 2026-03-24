package com.nearrish.backend.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password="
})
class ApiAuthenticationServiceTest {
    @Autowired
    private ApiAuthenticationService apiAuthenticationService;
    @Autowired
    private UserRepository userRepository;

    @AfterEach
    void tearDown() {
        userRepository.deleteAll();
    }

    @Test
    void getAuthenticationReturnsApiAuthenticationForValidJwt() {
        // Arrange
        User user = new User();
        user.setUsername("testUser");
        user.addRole("USER");
        userRepository.save(user);

        String jwt = JWT.create()
                .withClaim("userId", user.getId())
                .withClaim("username", user.getUsername())
                .sign(Algorithm.HMAC256("a-string-secret-at-least-256-bits-long-to-be-secure"));

        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        Mockito.when(request.getHeader("AUTH")).thenReturn(jwt);

        // Act
        ApiAuthentication authentication = apiAuthenticationService.getAuthentication(request);

        // Assert
        assertNotNull(authentication);
        assertEquals(user.getUsername(), authentication.getUser().getUsername());
    }

    @Test
    void getAuthenticationThrowsBadCredentialsExceptionForInvalidJwt() {
        // Arrange
        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        Mockito.when(request.getHeader("AUTH")).thenReturn("invalidJwt");

        // Act & Assert
        assertThrows(BadCredentialsException.class, () -> apiAuthenticationService.getAuthentication(request));
    }

    @Test
    void getAuthenticationThrowsBadCredentialsExceptionForNonExistentUser() {
        // Arrange
        String jwt = JWT.create()
                .withClaim("userId", "nonExistentId")
                .withClaim("username", "nonExistentUser")
                .sign(Algorithm.HMAC256("a-string-secret-at-least-256-bits-long-to-be-secure"));

        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        Mockito.when(request.getHeader("AUTH")).thenReturn(jwt);

        // Act & Assert
        assertThrows(BadCredentialsException.class, () -> apiAuthenticationService.getAuthentication(request));
    }

    @Test
    void getAuthenticationThrowsBadCredentialsExceptionForMissingJwtHeader() {
        // Arrange
        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        Mockito.when(request.getHeader("AUTH")).thenReturn(null);

        // Act & Assert
        assertThrows(BadCredentialsException.class, () -> apiAuthenticationService.getAuthentication(request));
    }

    @Test
    void verifyTokenReturnsDecodedJwtForValidToken() {
        User user = new User();
        user.setUsername("verifyUser");
        userRepository.save(user);

        String jwt = JWT.create()
                .withClaim("userId", user.getId())
                .withClaim("username", user.getUsername())
                .withExpiresAt(new java.util.Date(System.currentTimeMillis() + 60_000))
                .sign(Algorithm.HMAC256("a-string-secret-at-least-256-bits-long-to-be-secure"));

        var decoded = apiAuthenticationService.verifyToken(jwt);

        assertNotNull(decoded);
        assertEquals(user.getId(), decoded.getClaim("userId").asString());
        assertEquals(user.getUsername(), decoded.getClaim("username").asString());
    }

    @Test
    void verifyTokenThrowsBadCredentialsForInvalidToken() {
        assertThrows(org.springframework.security.authentication.BadCredentialsException.class,
                () -> apiAuthenticationService.verifyToken("this.is.garbage"));
    }

    @Test
    void verifyTokenThrowsBadCredentialsForExpiredToken() {
        User user = new User();
        user.setUsername("expiredUser");
        userRepository.save(user);

        String jwt = JWT.create()
                .withClaim("userId", user.getId())
                .withClaim("username", user.getUsername())
                .withExpiresAt(new java.util.Date(System.currentTimeMillis() - 1000))
                .sign(Algorithm.HMAC256("a-string-secret-at-least-256-bits-long-to-be-secure"));

        assertThrows(org.springframework.security.authentication.BadCredentialsException.class,
                () -> apiAuthenticationService.verifyToken(jwt));
    }

    @Test
    void createJwtForUser_withMfaTrue_containsCorrectClaims() {
        User user = new User("jwtClaimsUser", "jwtclaims@example.com", "pass", null);
        user.addRole("USER");
        userRepository.save(user);

        String token = apiAuthenticationService.createJwtForUser(user, true);

        String payload = new String(java.util.Base64.getUrlDecoder().decode(token.split("\\.")[1]));
        assertTrue(payload.contains("\"mfa\":true"),                          "JWT must contain mfa=true");
        assertTrue(payload.contains("\"userId\":\"" + user.getId() + "\""),   "JWT must contain correct userId");
        assertTrue(payload.contains("\"username\":\"jwtClaimsUser\""),        "JWT must contain correct username");
        assertTrue(payload.contains("roles"),                                 "JWT must contain roles claim");
    }

    @Test
    void createJwtForUser_withMfaFalse_and2faConfigured_containsMfaFalse() {
        // mfa=false is only meaningful when the user has a second factor configured —
        // it signals a partial token (password verified, TOTP not yet verified).
        User user = new User("jwtMfaFalseUser", "jwtmfafalse@example.com", "pass", "SOMESECRET");
        userRepository.save(user);

        String token = apiAuthenticationService.createJwtForUser(user, false);

        String payload = new String(java.util.Base64.getUrlDecoder().decode(token.split("\\.")[1]));
        assertTrue(payload.contains("\"mfa\":false"), "Partial token for 2FA user must contain mfa=false");
    }

    @Test
    void getAuthenticationThrowsBadCredentialsExceptionForExpiredJwt() {
        // Arrange
        User user = new User();
        user.setUsername("testUser");
        user.addRole("USER");
        userRepository.save(user);

        String jwt = JWT.create()
                .withClaim("userId", user.getId())
                .withClaim("username", user.getUsername())
                .withExpiresAt(new java.util.Date(System.currentTimeMillis() - 1000)) // Expired 1 second ago
                .sign(Algorithm.HMAC256("a-string-secret-at-least-256-bits-long-to-be-secure"));

        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        Mockito.when(request.getHeader("AUTH")).thenReturn(jwt);

        // Act & Assert
        assertThrows(BadCredentialsException.class, () -> apiAuthenticationService.getAuthentication(request));
    }
}