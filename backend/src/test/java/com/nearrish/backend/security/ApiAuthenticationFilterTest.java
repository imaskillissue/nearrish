package com.nearrish.backend.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;

import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:filtertest;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "MODERATION_ENABLED=false"
})
class ApiAuthenticationFilterTest {

    private static final String JWT_SECRET = "a-string-secret-at-least-256-bits-long-to-be-secure";

    @Autowired private ApiAuthenticationFilter filter;
    @Autowired private UserRepository userRepository;

    @AfterEach
    void tearDown() {
        userRepository.deleteAll();
    }

    private MockHttpServletResponse runFilter(String token) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/posts/feed");
        if (token != null) req.addHeader("AUTH", token);
        MockHttpServletResponse resp = new MockHttpServletResponse();
        filter.doFilter(req, resp, new MockFilterChain());
        return resp;
    }

    // ── Stale / expired token ────────────────────────────────────────────────

    @Test
    void expiredTokenReturns401WithJsonMessage() throws Exception {
        User user = new User();
        user.setUsername("expiredUser");
        userRepository.save(user);

        String expiredJwt = JWT.create()
                .withClaim("userId", user.getId())
                .withClaim("username", user.getUsername())
                .withExpiresAt(new Date(System.currentTimeMillis() - 5_000))
                .sign(Algorithm.HMAC256(JWT_SECRET));

        MockHttpServletResponse resp = runFilter(expiredJwt);

        assertEquals(401, resp.getStatus());
        assertTrue(resp.getContentAsString().contains("message"),
                "Response body must contain JSON 'message' field for the frontend to parse");
    }

    // ── Invalid / tampered tokens ────────────────────────────────────────────

    @Test
    void tamperedSignatureReturns401() throws Exception {
        MockHttpServletResponse resp = runFilter(
                "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJmYWtlIn0.badsignature");
        assertEquals(401, resp.getStatus());
    }

    @Test
    void garbageTokenReturns401() throws Exception {
        assertEquals(401, runFilter("not.a.jwt").getStatus());
    }

    @Test
    void tokenForDeletedUserReturns401() throws Exception {
        // Valid JWT structure + valid signature, but the user ID is not in the DB
        String jwt = JWT.create()
                .withClaim("userId", "00000000-dead-beef-0000-000000000000")
                .withClaim("username", "ghost")
                .withExpiresAt(new Date(System.currentTimeMillis() + 60_000))
                .sign(Algorithm.HMAC256(JWT_SECRET));

        assertEquals(401, runFilter(jwt).getStatus());
    }

    // ── No token ─────────────────────────────────────────────────────────────

    @Test
    void missingTokenReturns401() throws Exception {
        assertEquals(401, runFilter(null).getStatus());
    }

    // ── Valid token passes filter ────────────────────────────────────────────

    @Test
    void validNonExpiredTokenPassesFilter() throws Exception {
        User user = new User();
        user.setUsername("activeUser");
        user.addRole("USER");
        userRepository.save(user);

        String jwt = JWT.create()
                .withClaim("userId", user.getId())
                .withClaim("username", user.getUsername())
                .withExpiresAt(new Date(System.currentTimeMillis() + 60_000))
                .sign(Algorithm.HMAC256(JWT_SECRET));

        assertNotEquals(401, runFilter(jwt).getStatus());
    }

    // ── shouldNotFilter — public & auth routes bypass the filter ─────────────

    @Test
    void publicRoutesAreExcludedFromFilter() throws Exception {
        for (String path : new String[]{"/api/public/posts", "/api/public/users/123"}) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", path);
            assertTrue(filter.shouldNotFilter(req), path + " should bypass the filter");
        }
    }

    @Test
    void authRoutesAreExcludedFromFilter() throws Exception {
        for (String path : new String[]{"/api/auth/login", "/api/auth/registration", "/api/auth/2fa/validate"}) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", path);
            assertTrue(filter.shouldNotFilter(req), path + " should bypass the filter");
        }
    }

    @Test
    void uploadsAndSwaggerAreExcludedFromFilter() throws Exception {
        for (String path : new String[]{"/uploads/image.jpg", "/swagger-ui/index.html", "/v3/api-docs", "/ws/websocket"}) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", path);
            assertTrue(filter.shouldNotFilter(req), path + " should bypass the filter");
        }
    }

    @Test
    void protectedRoutesAreNotExcludedFromFilter() throws Exception {
        for (String path : new String[]{"/api/posts/feed", "/api/me/profile", "/api/friends"}) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", path);
            assertFalse(filter.shouldNotFilter(req), path + " should be filtered");
        }
    }
}
