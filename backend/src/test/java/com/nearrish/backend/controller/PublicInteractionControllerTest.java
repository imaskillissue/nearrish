package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Comment;
import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.CommentRepository;
import com.nearrish.backend.repository.LikeRepository;
import com.nearrish.backend.repository.PostRepository;
import com.nearrish.backend.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "MODERATION_ENABLED=false"
})
class PublicInteractionControllerTest {

    @Autowired private PublicInteractionController publicInteractionController;
    @Autowired private PostRepository postRepository;
    @Autowired private CommentRepository commentRepository;
    @Autowired private LikeRepository likeRepository;
    @Autowired private UserRepository userRepository;

    private User alice;
    private Post post;

    @BeforeEach
    void setUp() {
        alice = userRepository.save(new User("alice", "alice@example.com", "pass", ""));
        post  = postRepository.save(new Post("Hello world", alice.getId(), null));
    }

    @AfterEach
    void tearDown() {
        likeRepository.deleteAll();
        commentRepository.deleteAll();
        postRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ── getComments ───────────────────────────────────────────────────────────

    @Test
    void getComments_returnsCommentsWithLikeCount() {
        commentRepository.save(new Comment(post, alice, "First"));
        commentRepository.save(new Comment(post, alice, "Second"));

        List<Comment> comments = publicInteractionController.getComments(post.getId());

        assertEquals(2, comments.size());
        // likeCount should be populated (0 for fresh comments)
        assertTrue(comments.stream().allMatch(c -> c.getLikeCount() == 0));
    }

    @Test
    void getComments_onNonExistentPost_throws404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> publicInteractionController.getComments("bad-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    // ── getComment ────────────────────────────────────────────────────────────

    @Test
    void getComment_returnsCorrectComment() {
        Comment saved = commentRepository.save(new Comment(post, alice, "Hello!"));

        Comment fetched = publicInteractionController.getComment(post.getId(), saved.getId());

        assertEquals("Hello!", fetched.getContent());
    }

    // ── getCommentCount ───────────────────────────────────────────────────────

    @Test
    void getCommentCount_returnsCorrectCount() {
        commentRepository.save(new Comment(post, alice, "One"));
        commentRepository.save(new Comment(post, alice, "Two"));

        Map<String, Long> result = publicInteractionController.getCommentCount(post.getId());

        assertEquals(2L, result.get("count"));
    }

    // ── getPostLikeCount ──────────────────────────────────────────────────────

    @Test
    void getPostLikeCount_returnsZeroInitially() {
        long count = publicInteractionController.getPostLikeCount(post.getId());
        assertEquals(0L, count);
    }

    // ── getCommentLikeCount ───────────────────────────────────────────────────

    @Test
    void getCommentLikeCount_returnsZeroInitially() {
        Comment comment = commentRepository.save(new Comment(post, alice, "Hello"));

        long count = publicInteractionController.getCommentLikeCount(comment.getId());
        assertEquals(0L, count);
    }

    // ── moderateRegistration ──────────────────────────────────────────────────

    @Test
    void moderateRegistration_withSafeInput_returnsNotBlocked() {
        Map<String, Object> result = publicInteractionController.moderateRegistration(
                Map.of("name", "Alice Smith", "nickname", "alicesmith"));

        @SuppressWarnings("unchecked")
        Map<String, Object> nameField = (Map<String, Object>) result.get("name");
        @SuppressWarnings("unchecked")
        Map<String, Object> nicknameField = (Map<String, Object>) result.get("nickname");

        assertFalse((Boolean) nameField.get("blocked"));
        assertFalse((Boolean) nicknameField.get("blocked"));
    }

    @Test
    void moderateRegistration_withEmptyFields_returnsNotBlocked() {
        Map<String, Object> result = publicInteractionController.moderateRegistration(Map.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> nameField = (Map<String, Object>) result.get("name");
        assertFalse((Boolean) nameField.get("blocked"));
    }
}
