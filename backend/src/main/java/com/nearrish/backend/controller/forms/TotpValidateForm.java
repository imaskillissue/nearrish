package com.nearrish.backend.controller.forms;

public class TotpValidateForm {
    private String token;
    private String code;

    public TotpValidateForm() {}
    public TotpValidateForm(String token, String code) { this.token = token; this.code = code; }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
}
