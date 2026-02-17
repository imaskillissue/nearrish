package com.nearrish.backend.auth.forms;

public class LoginFormResponse {
    private final boolean success;
    private final String sessionToken;
    private final String errorMessage;
    private final boolean secondFactorRequired;

    public LoginFormResponse(boolean success, String sessionToken, String errorMessage, boolean secondFactorRequired) {
        this.success = success;
        this.sessionToken = sessionToken;
        this.errorMessage = errorMessage;
        this.secondFactorRequired = secondFactorRequired;
    }

    public boolean getSuccess() {
        return success;
    }

    public String getSessionToken() {
        return sessionToken;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public boolean isSecondFactorRequired() {
        return secondFactorRequired;
    }
}
