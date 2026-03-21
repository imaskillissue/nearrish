package com.nearrish.backend.controller;

import com.nearrish.backend.entity.User;
import com.nearrish.backend.security.ApiAuthenticationService;
import com.nearrish.backend.service.OAuthService;
import com.nearrish.backend.service.OAuthUserInfo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

@RestController
public class OAuthController {

    private final OAuthService oAuthService;
    private final ApiAuthenticationService authService;

    @Value("${oauth.base-url:https://localhost}")
    private String baseUrl;

    public OAuthController(OAuthService oAuthService, ApiAuthenticationService authService) {
        this.oAuthService = oAuthService;
        this.authService  = authService;
    }

    /**
     * Redirects the browser to the provider's authorization page.
     * e.g. GET /api/auth/oauth2/google/initiate
     */
    @GetMapping("/api/auth/oauth2/{provider}/initiate")
    public RedirectView initiate(@PathVariable String provider) {
        try {
            return new RedirectView(oAuthService.getAuthorizationUrl(provider));
        } catch (Exception e) {
            return new RedirectView(baseUrl + "/?auth_error=unsupported_provider");
        }
    }

    /**
     * Handles the provider's redirect after the user approves access.
     * Exchanges the code for a token, fetches user info, finds/creates the
     * local account, issues a JWT and sends the browser back to the frontend.
     */
    @GetMapping("/api/auth/oauth2/{provider}/callback")
    public RedirectView callback(@PathVariable String provider,
                                 @RequestParam(required = false) String code,
                                 @RequestParam(required = false) String error) {
        if (error != null || code == null) {
            return new RedirectView(baseUrl + "/?auth_error=access_denied");
        }
        try {
            String accessToken = oAuthService.exchangeCode(provider, code);
            OAuthUserInfo info  = oAuthService.getUserInfo(provider, accessToken);
            User user           = oAuthService.findOrCreateUser(provider, info);
            String jwt          = authService.createJwtForUser(user, true);
            return new RedirectView(baseUrl + "/?token=" + jwt);
        } catch (Exception e) {
            return new RedirectView(baseUrl + "/?auth_error=oauth_failed");
        }
    }
}
