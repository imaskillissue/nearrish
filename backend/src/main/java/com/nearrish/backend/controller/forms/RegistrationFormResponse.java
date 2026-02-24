package com.nearrish.backend.controller.forms;

public class RegistrationFormResponse {
    private final boolean success;
    private final String errorMessage;
    private final String sessionToken;

    public RegistrationFormResponse(boolean success, String errorMessage, String sessionToken) {
        this.success = success;
        this.errorMessage = errorMessage;
        this.sessionToken = sessionToken;
    }

    public boolean getSuccess() {
        return success;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public String getSessionToken() {
        return sessionToken;
    }
}
