package com.nearrish.backend.service;

import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "MODERATION_ENABLED=false"
})
class OAuthServiceTest {

    @Autowired private OAuthService oAuthService;
    @Autowired private UserRepository userRepository;

    @AfterEach
    void tearDown() {
        userRepository.deleteAll();
    }

    // ── getAuthorizationUrl ──────────────────────────────────────────────────

    @Test
    void getAuthorizationUrl_42_pointsToIntraApi() {
        String url = oAuthService.getAuthorizationUrl("42");

        assertTrue(url.startsWith("https://api.intra.42.fr/oauth/authorize"),
                "42 auth URL must point to the intra.42.fr endpoint");
    }

    @Test
    void getAuthorizationUrl_42_containsRequiredParameters() {
        String url = oAuthService.getAuthorizationUrl("42");

        assertTrue(url.contains("response_type=code"), "Must request an auth code");
        assertTrue(url.contains("scope=public"),       "Must request the public scope");
        assertTrue(url.contains("redirect_uri="),      "Must include redirect URI");
    }

    @Test
    void getAuthorizationUrl_google_pointsToGoogleAccounts() {
        String url = oAuthService.getAuthorizationUrl("google");

        assertTrue(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth"),
                "Google auth URL must point to accounts.google.com");
    }

    @Test
    void getAuthorizationUrl_google_containsRequiredParameters() {
        String url = oAuthService.getAuthorizationUrl("google");

        assertTrue(url.contains("response_type=code"),       "Must request an auth code");
        assertTrue(url.contains("scope=openid"),             "Must include openid scope");
        assertTrue(url.contains("redirect_uri="),            "Must include redirect URI");
    }

    @Test
    void getAuthorizationUrl_unknownProvider_throwsException() {
        assertThrows(IllegalArgumentException.class,
                () -> oAuthService.getAuthorizationUrl("facebook"),
                "Unknown provider must throw IllegalArgumentException");
    }

    // ── findOrCreateUser — new user ──────────────────────────────────────────

    @Test
    void findOrCreateUser_newUser_persistsToDatabase() {
        OAuthUserInfo info = new OAuthUserInfo("gh-1", "dev@example.com", "Dev User", "devlogin", null);

        User user = oAuthService.findOrCreateUser("google", info);

        assertNotNull(user.getId(), "User must be persisted and have an ID");
        assertTrue(userRepository.existsById(user.getId()));
    }

    @Test
    void findOrCreateUser_newUser_setsProviderAndId() {
        OAuthUserInfo info = new OAuthUserInfo("42-99", "student@42.fr", "Student Name", "student42", null);

        User user = oAuthService.findOrCreateUser("42", info);

        assertEquals("42",       user.getOauthProvider());
        assertEquals("42-99",    user.getOauthId());
    }

    @Test
    void findOrCreateUser_newUser_setsEmailAndName() {
        OAuthUserInfo info = new OAuthUserInfo("g-42", "jane@gmail.com", "Jane Doe", null, null);

        User user = oAuthService.findOrCreateUser("google", info);

        assertEquals("jane@gmail.com", user.getEmail());
        assertEquals("Jane Doe",       user.getName());
    }

    @Test
    void findOrCreateUser_42Login_usesLoginAsUsername() {
        OAuthUserInfo info = new OAuthUserInfo("42-55", "alice@42.fr", "Alice", "alice42", null);

        User user = oAuthService.findOrCreateUser("42", info);

        assertEquals("alice42", user.getUsername());
    }

    @Test
    void findOrCreateUser_nicknameIsTruncatedToEightChars() {
        OAuthUserInfo info = new OAuthUserInfo("42-77", "long@42.fr", "Long Login", "verylonglogin", null);

        User user = oAuthService.findOrCreateUser("42", info);

        assertTrue(user.getNickname().length() <= 8,
                "Nickname must be at most 8 characters, was: " + user.getNickname());
    }

    // ── findOrCreateUser — existing by OAuth ID ──────────────────────────────

    @Test
    void findOrCreateUser_existingByOauthId_returnsExistingUser() {
        OAuthUserInfo info = new OAuthUserInfo("g-100", "existing@gmail.com", "Existing", null, null);
        User first = oAuthService.findOrCreateUser("google", info);

        User second = oAuthService.findOrCreateUser("google", info);

        assertEquals(first.getId(), second.getId(), "Same OAuth ID must return the same user");
        assertEquals(1, userRepository.count(), "No duplicate user must be created");
    }

    // ── findOrCreateUser — email linking ────────────────────────────────────

    @Test
    void findOrCreateUser_existingEmailNoOauth_linksProviderToAccount() {
        User existing = new User("localuser", "shared@example.com", "Password1!", null);
        userRepository.save(existing);

        OAuthUserInfo info = new OAuthUserInfo("g-200", "shared@example.com", "Shared", null, null);
        User linked = oAuthService.findOrCreateUser("google", info);

        assertEquals(existing.getId(), linked.getId(), "Must link to the existing account by email");
        assertEquals("google",  linked.getOauthProvider());
        assertEquals("g-200",   linked.getOauthId());
        assertEquals(1, userRepository.count(), "No new user should be created when email matches");
    }

    @Test
    void findOrCreateUser_emailNull_createsNewUserWithoutEmailLinking() {
        OAuthUserInfo info = new OAuthUserInfo("42-300", null, "No Email", "noemail", null);

        User user = oAuthService.findOrCreateUser("42", info);

        assertNotNull(user.getId());
        assertNull(user.getEmail());
    }

    // ── findOrCreateUser — username conflict resolution ──────────────────────

    @Test
    void findOrCreateUser_usernameConflict_appendsNumberForUniqueness() {
        // Occupy the base username "devguy"
        User existing = new User("devguy", "other@example.com", "Password1!", null);
        userRepository.save(existing);

        OAuthUserInfo info = new OAuthUserInfo("g-400", "devguy@gmail.com", "Dev Guy", "devguy", null);
        User user = oAuthService.findOrCreateUser("google", info);

        assertNotEquals("devguy", user.getUsername(),
                "Username must be different from the already-taken base name");
        assertTrue(user.getUsername().startsWith("devguy"),
                "Unique username should still be based on the original login");
    }

    @Test
    void findOrCreateUser_loginWithSpecialChars_sanitisesUsername() {
        OAuthUserInfo info = new OAuthUserInfo("42-500", "dot@42.fr", "Dot User", "user.name", null);

        User user = oAuthService.findOrCreateUser("42", info);

        assertFalse(user.getUsername().contains("."),
                "Username must not contain dots or other special characters");
    }
}
