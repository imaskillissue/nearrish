package com.nearrish.backend.controller;

import com.auth0.jwt.interfaces.DecodedJWT;
import com.nearrish.backend.entity.*;
import com.nearrish.backend.repository.*;
import com.nearrish.backend.security.ApiAuthentication;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import com.auth0.jwt.interfaces.Claim;

import java.util.Arrays;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "MODERATION_ENABLED=false"
})
class AdminControllerTest {

    @Autowired private AdminController adminController;
    @Autowired private UserRepository userRepository;
    @Autowired private PostRepository postRepository;
    @Autowired private CommentRepository commentRepository;
    @Autowired private LikeRepository likeRepository;
    @Autowired private UserToxicityReportRepository toxicityReportRepository;

    private User admin;
    private User regularUser;

    @BeforeEach
    void setUp() {
        admin = new User("adminUser", "admin@example.com", "pass", "");
        admin.addRole("ADMIN");
        admin = userRepository.save(admin);

        regularUser = userRepository.save(new User("regular", "regular@example.com", "pass", ""));

        setAuth(admin);
    }

    @AfterEach
    void tearDown() {
        toxicityReportRepository.deleteAll();
        likeRepository.deleteAll();
        commentRepository.deleteAll();
        postRepository.deleteAll();
        userRepository.deleteAll();
        SecurityContextHolder.clearContext();
    }

    private void setAuth(User user) {
        DecodedJWT jwt = mock(DecodedJWT.class);
        Claim claim = mock(Claim.class);
        when(jwt.getClaim("roles")).thenReturn(claim);
        when(claim.asList(String.class)).thenReturn(new ArrayList<>(Arrays.asList(user.getRoles())));
        ApiAuthentication auth = new ApiAuthentication(jwt, user, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    // ── verify ────────────────────────────────────────────────────────────────

    @Test
    void verify_asAdmin_returns200() {
        Map<String, String> result = adminController.verify();
        assertEquals("ok", result.get("status"));
    }

    @Test
    void verify_asNonAdmin_throws403() {
        setAuth(regularUser);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> adminController.verify());
        assertEquals(403, ex.getStatusCode().value());
    }

    // ── getUsers ──────────────────────────────────────────────────────────────

    @Test
    void getUsers_asAdmin_returnsAllUsers() {
        List<Map<String, Object>> users = adminController.getUsers();

        assertTrue(users.size() >= 2);
        assertTrue(users.stream().anyMatch(u -> "adminUser".equals(u.get("username"))));
        assertTrue(users.stream().anyMatch(u -> "regular".equals(u.get("username"))));
    }

    @Test
    void getUsers_includesExpectedFields() {
        List<Map<String, Object>> users = adminController.getUsers();

        Map<String, Object> first = users.get(0);
        assertTrue(first.containsKey("userId"));
        assertTrue(first.containsKey("username"));
        assertTrue(first.containsKey("email"));
    }

    @Test
    void getUsers_asNonAdmin_throws403() {
        setAuth(regularUser);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> adminController.getUsers());
        assertEquals(403, ex.getStatusCode().value());
    }

    // ── deleteUser ────────────────────────────────────────────────────────────

    @Test
    void deleteUser_asAdmin_removesUser() {
        adminController.deleteUser(regularUser.getId());

        assertFalse(userRepository.existsById(regularUser.getId()));
    }

    @Test
    void deleteUser_nonExistent_throws404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> adminController.deleteUser("non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void deleteUser_asNonAdmin_throws403() {
        setAuth(regularUser);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> adminController.deleteUser(admin.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }

    // ── getModerationQueue ────────────────────────────────────────────────────

    @Test
    void getModerationQueue_asAdmin_returnsPostsAndComments() {
        Map<String, Object> result = adminController.getModerationQueue();

        assertTrue(result.containsKey("posts"));
        assertTrue(result.containsKey("comments"));
    }

    @Test
    void getModerationQueue_includesFlaggedPosts() {
        Post flagged = new Post("Bad content", regularUser.getId(), null);
        flagged.setModerated(true);
        flagged.setModerationReason("Violation");
        flagged.setModerationSeverity(3);
        postRepository.save(flagged);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> posts =
                (List<Map<String, Object>>) adminController.getModerationQueue().get("posts");

        assertTrue(posts.stream().anyMatch(p -> "Bad content".equals(p.get("content"))));
    }

    @Test
    void getModerationQueue_includesHighSeverityPosts() {
        Post highSev = new Post("Borderline content", regularUser.getId(), null);
        highSev.setModerationSeverity(2);  // severity >= 2 should appear
        postRepository.save(highSev);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> posts =
                (List<Map<String, Object>>) adminController.getModerationQueue().get("posts");

        assertTrue(posts.stream().anyMatch(p -> "Borderline content".equals(p.get("content"))));
    }

    @Test
    void getModerationQueue_excludesCleanPosts() {
        postRepository.save(new Post("Clean post", regularUser.getId(), null));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> posts =
                (List<Map<String, Object>>) adminController.getModerationQueue().get("posts");

        assertTrue(posts.stream().noneMatch(p -> "Clean post".equals(p.get("content"))));
    }

    @Test
    void getModerationQueue_asNonAdmin_throws403() {
        setAuth(regularUser);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> adminController.getModerationQueue());
        assertEquals(403, ex.getStatusCode().value());
    }

    // ── getToxicity ───────────────────────────────────────────────────────────

    @Test
    void getToxicity_whenNoReport_throws404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> adminController.getToxicity(regularUser.getId()));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void getToxicity_afterAnalysis_returnsReport() {
        // Run analysis first to create the report
        adminController.analyseUser(regularUser.getId());

        Map<String, Object> result = adminController.getToxicity(regularUser.getId());

        assertEquals(regularUser.getId(), result.get("userId"));
        assertTrue(result.containsKey("score"));
        assertTrue(result.containsKey("summary"));
    }

    // ── analyseUser ───────────────────────────────────────────────────────────

    @Test
    void analyseUser_createsReport() {
        Map<String, Object> result = adminController.analyseUser(regularUser.getId());

        assertNotNull(result);
        assertEquals(regularUser.getId(), result.get("userId"));
        assertTrue(result.containsKey("score"));
        assertTrue(result.containsKey("summary"));
    }

    @Test
    void analyseUser_scoreIsInRange() {
        Map<String, Object> result = adminController.analyseUser(regularUser.getId());

        int score = (int) result.get("score");
        assertTrue(score >= 0 && score <= 100, "Score should be 0–100, got " + score);
    }

    @Test
    void analyseUser_userWithNoContent_scoresZero() {
        Map<String, Object> result = adminController.analyseUser(regularUser.getId());

        // User has no posts, comments, messages, or likes → score should be 0
        assertEquals(0, result.get("score"));
    }

    @Test
    void analyseUser_userWithFlaggedPost_hasPositiveScore() {
        Post flagged = new Post("Offensive content", regularUser.getId(), null);
        flagged.setModerationSeverity(3);
        postRepository.save(flagged);

        Map<String, Object> result = adminController.analyseUser(regularUser.getId());

        int score = (int) result.get("score");
        assertTrue(score > 0, "User with a severity=3 post should have score > 0");
    }

    @Test
    void analyseUser_persistsReport() {
        adminController.analyseUser(regularUser.getId());

        assertTrue(toxicityReportRepository.findByUserId(regularUser.getId()).isPresent());
    }

    @Test
    void analyseUser_updatesExistingReport() {
        adminController.analyseUser(regularUser.getId());
        adminController.analyseUser(regularUser.getId());  // run twice

        // Should still be a single report, not two
        assertEquals(1, toxicityReportRepository.findAll().stream()
                .filter(r -> regularUser.getId().equals(r.getUserId())).count());
    }

    @Test
    void analyseUser_nonExistentUser_throws404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> adminController.analyseUser("non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void analyseUser_asNonAdmin_throws403() {
        setAuth(regularUser);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> adminController.analyseUser(admin.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }
}
