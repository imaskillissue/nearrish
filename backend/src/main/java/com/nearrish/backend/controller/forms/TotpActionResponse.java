package com.nearrish.backend.controller.forms;

public class TotpActionResponse {
    private final boolean success;
    private final String message;
    private final String sessionToken;

    public TotpActionResponse(boolean success, String message, String sessionToken) {
        this.success = success;
        this.message = message;
        this.sessionToken = sessionToken;
    }

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public String getSessionToken() { return sessionToken; }
}
