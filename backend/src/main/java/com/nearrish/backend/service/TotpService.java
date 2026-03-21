package com.nearrish.backend.service;

import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.code.DefaultCodeVerifier;
import dev.samstevens.totp.code.HashingAlgorithm;
import dev.samstevens.totp.qr.QrData;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;
import org.springframework.stereotype.Service;

@Service
public class TotpService {

    private final DefaultSecretGenerator secretGenerator = new DefaultSecretGenerator();
    private final DefaultCodeVerifier codeVerifier;

    public TotpService() {
        codeVerifier = new DefaultCodeVerifier(new DefaultCodeGenerator(), new SystemTimeProvider());
        codeVerifier.setAllowedTimePeriodDiscrepancy(1); // allow 30s of clock drift
    }

    public String generateSecret() {
        return secretGenerator.generate();
    }

    public String getOtpAuthUri(String secret, String username) {
        return new QrData.Builder()
                .label(username)
                .secret(secret)
                .issuer("Nearrish")
                .algorithm(HashingAlgorithm.SHA1)
                .digits(6)
                .period(30)
                .build()
                .getUri();
    }

    public boolean verifyCode(String secret, String code) {
        return codeVerifier.isValidCode(secret, code);
    }
}
