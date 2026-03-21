package com.nearrish.backend.service;

import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.exceptions.CodeGenerationException;
import dev.samstevens.totp.time.SystemTimeProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TotpServiceTest {

    private TotpService totpService;

    @BeforeEach
    void setUp() {
        totpService = new TotpService();
    }

    // ── generateSecret ──────────────────────────────────────────────────────

    @Test
    void generateSecret_returnsNonEmptyBase32String() {
        String secret = totpService.generateSecret();

        assertNotNull(secret);
        assertFalse(secret.isBlank());
        assertTrue(secret.matches("[A-Z2-7=]+"), "Secret should be Base32 encoded (uppercase letters and digits 2-7)");
    }

    @Test
    void generateSecret_returnsDifferentValuesEachCall() {
        String first  = totpService.generateSecret();
        String second = totpService.generateSecret();

        assertNotEquals(first, second, "Each generated secret should be unique");
    }

    @Test
    void generateSecret_hasReasonableLength() {
        String secret = totpService.generateSecret();

        assertTrue(secret.length() >= 16, "Secret should be at least 16 Base32 characters (80 bits)");
    }

    // ── getOtpAuthUri ────────────────────────────────────────────────────────

    @Test
    void getOtpAuthUri_startsWithOtpAuthScheme() {
        String secret = totpService.generateSecret();
        String uri = totpService.getOtpAuthUri(secret, "testUser");

        assertTrue(uri.startsWith("otpauth://totp/"), "URI must start with otpauth://totp/");
    }

    @Test
    void getOtpAuthUri_containsIssuerAndLabel() {
        String secret = totpService.generateSecret();
        String uri = totpService.getOtpAuthUri(secret, "alice");

        assertTrue(uri.contains("alice"),   "URI must contain the username label");
        assertTrue(uri.contains("Nearrish"), "URI must contain the issuer");
    }

    @Test
    void getOtpAuthUri_containsSecret() {
        String secret = totpService.generateSecret();
        String uri = totpService.getOtpAuthUri(secret, "testUser");

        assertTrue(uri.contains("secret=" + secret), "URI must contain the secret parameter");
    }

    @Test
    void getOtpAuthUri_containsTotpParameters() {
        String secret = totpService.generateSecret();
        String uri = totpService.getOtpAuthUri(secret, "testUser");

        assertTrue(uri.contains("digits=6"),  "URI must specify 6 digits");
        assertTrue(uri.contains("period=30"), "URI must specify 30-second period");
    }

    // ── verifyCode ───────────────────────────────────────────────────────────

    @Test
    void verifyCode_returnsFalseForObviouslyWrongCode() {
        String secret = totpService.generateSecret();

        // "000000" is extremely unlikely to be the current valid TOTP code
        assertFalse(totpService.verifyCode(secret, "000000"));
    }

    @Test
    void verifyCode_returnsFalseForNonNumericCode() {
        String secret = totpService.generateSecret();

        assertFalse(totpService.verifyCode(secret, "abcdef"));
    }

    @Test
    void verifyCode_returnsTrueForCurrentValidCode() throws CodeGenerationException {
        String secret = totpService.generateSecret();
        long counter  = Math.floorDiv(new SystemTimeProvider().getTime(), 30L);
        String validCode = new DefaultCodeGenerator().generate(secret, counter);

        assertTrue(totpService.verifyCode(secret, validCode));
    }

    @Test
    void verifyCode_returnsFalseForCodeFromDifferentSecret() throws CodeGenerationException {
        String secretA = totpService.generateSecret();
        String secretB = totpService.generateSecret();
        long counter   = Math.floorDiv(new SystemTimeProvider().getTime(), 30_000L);
        String codeForB = new DefaultCodeGenerator().generate(secretB, counter);

        assertFalse(totpService.verifyCode(secretA, codeForB),
                "Code generated for secretB must not validate against secretA");
    }
}
