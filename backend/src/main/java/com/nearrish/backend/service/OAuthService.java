package com.nearrish.backend.service;

import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;

@Service
public class OAuthService {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    private final RestClient restClient = RestClient.create();
    private final UserRepository userRepository;

    @Value("${oauth.42.client-id:}")      private String client42Id;
    @Value("${oauth.42.client-secret:}")  private String client42Secret;
    @Value("${oauth.google.client-id:}")  private String clientGoogleId;
    @Value("${oauth.google.client-secret:}") private String clientGoogleSecret;
    @Value("${oauth.base-url:https://localhost}") private String baseUrl;

    public OAuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // ── Authorization URL ────────────────────────────────────────────────────

    public String getAuthorizationUrl(String provider) {
        String callbackUrl = encode(baseUrl + "/api/auth/oauth2/" + provider + "/callback");
        return switch (provider) {
            case "42" -> "https://api.intra.42.fr/oauth/authorize" +
                    "?client_id=" + encode(client42Id) +
                    "&redirect_uri=" + callbackUrl +
                    "&response_type=code&scope=public";
            case "google" -> "https://accounts.google.com/o/oauth2/v2/auth" +
                    "?client_id=" + encode(clientGoogleId) +
                    "&redirect_uri=" + callbackUrl +
                    "&response_type=code&scope=openid+email+profile";
            default -> throw new IllegalArgumentException("Unknown OAuth provider: " + provider);
        };
    }

    // ── Code → Access token ──────────────────────────────────────────────────

    public String exchangeCode(String provider, String code) {
        String tokenUrl = switch (provider) {
            case "42"     -> "https://api.intra.42.fr/oauth/token";
            case "google" -> "https://oauth2.googleapis.com/token";
            default -> throw new IllegalArgumentException("Unknown OAuth provider: " + provider);
        };
        String clientId     = "42".equals(provider) ? client42Id     : clientGoogleId;
        String clientSecret = "42".equals(provider) ? client42Secret : clientGoogleSecret;
        String callbackUrl  = baseUrl + "/api/auth/oauth2/" + provider + "/callback";

        String body = "grant_type=authorization_code"
                + "&code="          + encode(code)
                + "&client_id="     + encode(clientId)
                + "&client_secret=" + encode(clientSecret)
                + "&redirect_uri="  + encode(callbackUrl);

        Map<String, Object> response = restClient.post()
                .uri(tokenUrl)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(body)
                .retrieve()
                .body(MAP_TYPE);

        if (response == null) throw new RuntimeException("Empty token response from " + provider);
        return (String) response.get("access_token");
    }

    // ── Access token → User info ─────────────────────────────────────────────

    public OAuthUserInfo getUserInfo(String provider, String accessToken) {
        String userInfoUrl = switch (provider) {
            case "42"     -> "https://api.intra.42.fr/v2/me";
            case "google" -> "https://www.googleapis.com/oauth2/v3/userinfo";
            default -> throw new IllegalArgumentException("Unknown OAuth provider: " + provider);
        };

        Map<String, Object> data = restClient.get()
                .uri(userInfoUrl)
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .body(MAP_TYPE);

        if (data == null) throw new RuntimeException("Empty user info from " + provider);

        return switch (provider) {
            case "42" -> {
                String id        = String.valueOf(data.get("id"));
                String login     = (String) data.get("login");
                String email     = (String) data.get("email");
                String firstName = (String) data.getOrDefault("first_name", "");
                String lastName  = (String) data.getOrDefault("last_name", "");
                String name      = (firstName + " " + lastName).trim();
                yield new OAuthUserInfo(id, email, name.isEmpty() ? login : name, login, null);
            }
            case "google" -> {
                String id      = (String) data.get("sub");
                String email   = (String) data.get("email");
                String name    = (String) data.getOrDefault("name", "");
                String picture = (String) data.get("picture");
                yield new OAuthUserInfo(id, email, name, null, picture);
            }
            default -> throw new IllegalArgumentException("Unknown OAuth provider: " + provider);
        };
    }

    // ── Find or create local user ────────────────────────────────────────────

    public User findOrCreateUser(String provider, OAuthUserInfo info) {
        // 1. Already linked account
        Optional<User> byOAuth = userRepository.findByOauthProviderAndOauthId(provider, info.id());
        if (byOAuth.isPresent()) return byOAuth.get();

        // 2. Existing account with same email — link it
        if (info.email() != null) {
            Optional<User> byEmail = userRepository.findByEmail(info.email());
            if (byEmail.isPresent()) {
                User existing = byEmail.get();
                existing.setOauthProvider(provider);
                existing.setOauthId(info.id());
                return userRepository.save(existing);
            }
        }

        // 3. New user
        String username = uniqueUsername(info);
        User user = new User();
        user.setUsername(username);
        user.setEmail(info.email());
        user.setName(info.name() != null && !info.name().isBlank() ? info.name() : username);
        user.setNickname(username.length() > 8 ? username.substring(0, 8) : username);
        user.setOauthProvider(provider);
        user.setOauthId(info.id());
        return userRepository.save(user);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String uniqueUsername(OAuthUserInfo info) {
        String base = info.login() != null ? info.login()
                    : info.email() != null ? info.email().split("@")[0]
                    : "user";
        base = base.replaceAll("[^a-zA-Z0-9_]", "_").toLowerCase();
        if (!userRepository.existsByUsername(base)) return base;
        for (int i = 1; i <= 99; i++) {
            String candidate = base + i;
            if (!userRepository.existsByUsername(candidate)) return candidate;
        }
        return base + "_" + (System.currentTimeMillis() % 10000);
    }

    private static String encode(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
