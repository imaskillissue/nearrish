package com.nearrish.backend.controller;

import com.nearrish.backend.entity.User;
import com.nearrish.backend.security.ApiAuthenticationService;
import com.nearrish.backend.service.OAuthService;
import com.nearrish.backend.service.OAuthUserInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.view.RedirectView;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class OAuthControllerTest {

    private OAuthService oAuthService;
    private ApiAuthenticationService authService;
    private OAuthController controller;

    private static final String BASE_URL = "https://localhost";

    @BeforeEach
    void setUp() {
        oAuthService = mock(OAuthService.class);
        authService  = mock(ApiAuthenticationService.class);
        controller   = new OAuthController(oAuthService, authService);
        ReflectionTestUtils.setField(controller, "baseUrl", BASE_URL);
    }

    // ── initiate ─────────────────────────────────────────────────────────────

    @Test
    void initiate_validProvider_redirectsToProviderUrl() {
        String providerUrl = "https://accounts.google.com/o/oauth2/v2/auth?client_id=x&redirect_uri=y";
        when(oAuthService.getAuthorizationUrl("google")).thenReturn(providerUrl);

        RedirectView view = controller.initiate("google");

        assertEquals(providerUrl, view.getUrl());
    }

    @Test
    void initiate_unknownProvider_redirectsToUnsupportedProviderError() {
        when(oAuthService.getAuthorizationUrl("facebook"))
                .thenThrow(new IllegalArgumentException("Unknown provider"));

        RedirectView view = controller.initiate("facebook");

        assertEquals(BASE_URL + "/?auth_error=unsupported_provider", view.getUrl());
    }

    // ── callback — rejected / missing code ───────────────────────────────────

    @Test
    void callback_nullCode_redirectsToAccessDenied() {
        RedirectView view = controller.callback("google", null, null);

        assertEquals(BASE_URL + "/?auth_error=access_denied", view.getUrl());
        verifyNoInteractions(oAuthService);
    }

    @Test
    void callback_errorParam_redirectsToAccessDenied() {
        RedirectView view = controller.callback("google", "someCode", "access_denied");

        assertEquals(BASE_URL + "/?auth_error=access_denied", view.getUrl());
        verifyNoInteractions(oAuthService);
    }

    @Test
    void callback_bothCodeAndError_errorTakesPriority() {
        RedirectView view = controller.callback("google", "someCode", "access_denied");

        assertEquals(BASE_URL + "/?auth_error=access_denied", view.getUrl());
    }

    // ── callback — success path ───────────────────────────────────────────────

    @Test
    void callback_validCode_exchangesCodeAndRedirectsWithToken() {
        OAuthUserInfo info = new OAuthUserInfo("g-1", "user@gmail.com", "User", null, null);
        User user          = new User("oauthuser", "user@gmail.com", "nopassword", null);
        when(oAuthService.exchangeCode("google", "auth-code")).thenReturn("access-token-123");
        when(oAuthService.getUserInfo("google", "access-token-123")).thenReturn(info);
        when(oAuthService.findOrCreateUser("google", info)).thenReturn(user);
        when(authService.createJwtForUser(user, true)).thenReturn("jwt.token.here");

        RedirectView view = controller.callback("google", "auth-code", null);

        assertEquals(BASE_URL + "/?token=jwt.token.here", view.getUrl());
    }

    @Test
    void callback_validCode_callsServicesInOrder() {
        OAuthUserInfo info = new OAuthUserInfo("42-1", "s@42.fr", "Student", "slogin", null);
        User user          = new User("slogin", "s@42.fr", "nopassword", null);
        when(oAuthService.exchangeCode("42", "code42")).thenReturn("at42");
        when(oAuthService.getUserInfo("42", "at42")).thenReturn(info);
        when(oAuthService.findOrCreateUser("42", info)).thenReturn(user);
        when(authService.createJwtForUser(user, true)).thenReturn("jwt42");

        controller.callback("42", "code42", null);

        var inOrder = inOrder(oAuthService, authService);
        inOrder.verify(oAuthService).exchangeCode("42", "code42");
        inOrder.verify(oAuthService).getUserInfo("42", "at42");
        inOrder.verify(oAuthService).findOrCreateUser("42", info);
        inOrder.verify(authService).createJwtForUser(user, true);
    }

    // ── callback — service errors ─────────────────────────────────────────────

    @Test
    void callback_exchangeCodeThrows_redirectsToOAuthFailed() {
        when(oAuthService.exchangeCode(any(), any())).thenThrow(new RuntimeException("Token endpoint error"));

        RedirectView view = controller.callback("google", "bad-code", null);

        assertEquals(BASE_URL + "/?auth_error=oauth_failed", view.getUrl());
    }

    @Test
    void callback_getUserInfoThrows_redirectsToOAuthFailed() {
        when(oAuthService.exchangeCode(any(), any())).thenReturn("access-token");
        when(oAuthService.getUserInfo(any(), any())).thenThrow(new RuntimeException("User info error"));

        RedirectView view = controller.callback("google", "code", null);

        assertEquals(BASE_URL + "/?auth_error=oauth_failed", view.getUrl());
    }

    @Test
    void callback_findOrCreateUserThrows_redirectsToOAuthFailed() {
        when(oAuthService.exchangeCode(any(), any())).thenReturn("access-token");
        when(oAuthService.getUserInfo(any(), any())).thenReturn(
                new OAuthUserInfo("id", "e@x.com", "Name", null, null));
        when(oAuthService.findOrCreateUser(any(), any())).thenThrow(new RuntimeException("DB error"));

        RedirectView view = controller.callback("google", "code", null);

        assertEquals(BASE_URL + "/?auth_error=oauth_failed", view.getUrl());
    }
}
