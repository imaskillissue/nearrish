package com.nearrish.backend.controller.forms;

public class TotpEnableForm {
    private String secret;
    private String code;

    public TotpEnableForm() {}
    public TotpEnableForm(String secret, String code) { this.secret = secret; this.code = code; }

    public String getSecret() { return secret; }
    public void setSecret(String secret) { this.secret = secret; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
}
