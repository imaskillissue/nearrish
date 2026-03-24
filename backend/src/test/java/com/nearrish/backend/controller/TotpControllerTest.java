package com.nearrish.backend.controller;

import com.auth0.jwt.interfaces.DecodedJWT;
import com.nearrish.backend.controller.forms.*;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.security.ApiAuthentication;
import com.nearrish.backend.security.ApiAuthenticationService;
import com.nearrish.backend.service.TotpService;
import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.exceptions.CodeGenerationException;
import dev.samstevens.totp.time.SystemTimeProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;

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
class TotpControllerTest {

    @Autowired private TotpController totpController;
    @Autowired private TotpService totpService;
    @Autowired private UserRepository userRepository;
    @Autowired private ApiAuthenticationService authService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User("totpUser", "totp@example.com", "Password1!", null);
        userRepository.save(user);
        authenticateAs(user);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        userRepository.deleteAll();
    }

    // ── status ───────────────────────────────────────────────────────────────

    @Test
    void status_whenNoSecondFactor_returnsDisabled() {
        var result = totpController.status();

        assertFalse(result.get("enabled"));
    }

    @Test
    void status_whenSecondFactorSet_returnsEnabled() {
        user.setSecondFactor(totpService.generateSecret());
        userRepository.save(user);

        var result = totpController.status();

        assertTrue(result.get("enabled"));
    }

    // ── setup ────────────────────────────────────────────────────────────────

    @Test
    void setup_returnsNonEmptySecretAndUri() {
        TotpSetupResponse response = totpController.setup();

        assertNotNull(response.getSecret());
        assertFalse(response.getSecret().isBlank());
        assertNotNull(response.getOtpAuthUri());
        assertTrue(response.getOtpAuthUri().startsWith("otpauth://totp/"));
    }

    @Test
    void setup_doesNotPersistSecretToDatabase() {
        totpController.setup();

        User fresh = userRepository.findById(user.getId()).orElseThrow();
        assertNull(fresh.getSecondFactor(), "setup() must not save the secret — enable() does that");
    }

    @Test
    void setup_returnsUniqueSecretEachCall() {
        String first  = totpController.setup().getSecret();
        String second = totpController.setup().getSecret();

        assertNotEquals(first, second);
    }

    // ── enable ───────────────────────────────────────────────────────────────

    @Test
    void enable_withValidCode_savesSecretAndReturnsSuccess() throws CodeGenerationException {
        String secret    = totpService.generateSecret();
        String validCode = currentCode(secret);

        TotpActionResponse response = totpController.enable(new TotpEnableForm(secret, validCode));

        assertTrue(response.isSuccess());
        assertNotNull(response.getSessionToken());
        User fresh = userRepository.findById(user.getId()).orElseThrow();
        assertEquals(secret, fresh.getSecondFactor());
    }

    @Test
    void enable_withWrongCode_returnsFalseAndDoesNotSaveSecret() {
        String secret = totpService.generateSecret();

        TotpActionResponse response = totpController.enable(new TotpEnableForm(secret, "000000"));

        assertFalse(response.isSuccess());
        assertNull(response.getSessionToken());
        User fresh = userRepository.findById(user.getId()).orElseThrow();
        assertNull(fresh.getSecondFactor(), "Secret must not be saved when code is wrong");
    }

    @Test
    void enable_returnedJwtContainsMfaTrue() throws CodeGenerationException {
        String secret    = totpService.generateSecret();
        String validCode = currentCode(secret);

        TotpActionResponse response = totpController.enable(new TotpEnableForm(secret, validCode));

        assertTrue(response.isSuccess());
        String payload = decodePayload(response.getSessionToken());
        assertTrue(payload.contains("\"mfa\":true"), "Returned JWT must have mfa=true");
    }

    // ── disable ──────────────────────────────────────────────────────────────

    @Test
    void disable_withCorrectCredentials_clearesSecretAndReturnsSuccess() throws CodeGenerationException {
        String secret = totpService.generateSecret();
        user.setSecondFactor(secret);
        userRepository.save(user);

        TotpActionResponse response = totpController.disable(new TotpDisableForm("Password1!", currentCode(secret)));

        assertTrue(response.isSuccess());
        assertNotNull(response.getSessionToken());
        User fresh = userRepository.findById(user.getId()).orElseThrow();
        assertNull(fresh.getSecondFactor());
    }

    @Test
    void disable_withWrongPassword_returnsFalse() throws CodeGenerationException {
        String secret = totpService.generateSecret();
        user.setSecondFactor(secret);
        userRepository.save(user);

        TotpActionResponse response = totpController.disable(new TotpDisableForm("wrongPassword", currentCode(secret)));

        assertFalse(response.isSuccess());
        assertNull(response.getSessionToken());
        User fresh = userRepository.findById(user.getId()).orElseThrow();
        assertNotNull(fresh.getSecondFactor(), "Secret must not be cleared when password is wrong");
    }

    @Test
    void disable_withWrongCode_returnsFalse() {
        String secret = totpService.generateSecret();
        user.setSecondFactor(secret);
        userRepository.save(user);

        TotpActionResponse response = totpController.disable(new TotpDisableForm("Password1!", "000000"));

        assertFalse(response.isSuccess());
        assertNull(response.getSessionToken());
    }

    @Test
    void disable_whenTwoFaNotEnabled_returnsFalse() {
        TotpActionResponse response = totpController.disable(new TotpDisableForm("Password1!", "123456"));

        assertFalse(response.isSuccess());
        assertEquals("2FA is not enabled", response.getMessage());
    }

    @Test
    void disable_returnedJwtContainsMfaTrue() throws CodeGenerationException {
        String secret = totpService.generateSecret();
        user.setSecondFactor(secret);
        userRepository.save(user);

        TotpActionResponse response = totpController.disable(new TotpDisableForm("Password1!", currentCode(secret)));

        assertTrue(response.isSuccess());
        String payload = decodePayload(response.getSessionToken());
        assertTrue(payload.contains("\"mfa\":true"), "JWT after disabling 2FA must have mfa=true (no 2FA required)");
    }

    @Test
    void enable_whenAlreadyEnabled_replacesExistingSecret() throws CodeGenerationException {
        String oldSecret = totpService.generateSecret();
        user.setSecondFactor(oldSecret);
        userRepository.save(user);

        String newSecret = totpService.generateSecret();
        TotpActionResponse response = totpController.enable(new TotpEnableForm(newSecret, currentCode(newSecret)));

        assertTrue(response.isSuccess());
        User fresh = userRepository.findById(user.getId()).orElseThrow();
        assertEquals(newSecret, fresh.getSecondFactor(), "Enable must replace the old secret with the new one");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void authenticateAs(User u) {
        DecodedJWT jwt = mock(DecodedJWT.class);
        ApiAuthentication auth = new ApiAuthentication(jwt, u, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private static String currentCode(String secret) throws CodeGenerationException {
        long counter = Math.floorDiv(new SystemTimeProvider().getTime(), 30L);
        return new DefaultCodeGenerator().generate(secret, counter);
    }

    private static String decodePayload(String jwt) {
        String[] parts = jwt.split("\\.");
        return new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
    }
}
