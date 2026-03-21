package com.nearrish.backend.controller.forms;

public class TotpSetupResponse {
    private final String secret;
    private final String otpAuthUri;

    public TotpSetupResponse(String secret, String otpAuthUri) {
        this.secret = secret;
        this.otpAuthUri = otpAuthUri;
    }

    public String getSecret() { return secret; }
    public String getOtpAuthUri() { return otpAuthUri; }
}
