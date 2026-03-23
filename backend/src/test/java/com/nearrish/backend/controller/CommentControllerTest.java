package com.nearrish.backend.controller;

import com.auth0.jwt.interfaces.DecodedJWT;
import com.nearrish.backend.entity.Comment;
import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.CommentRepository;
import com.nearrish.backend.repository.PostRepository;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.security.ApiAuthentication;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "MODERATION_ENABLED=false"
})
class CommentControllerTest {

    @Autowired private CommentController commentController;
    @Autowired private CommentRepository commentRepository;
    @Autowired private PostRepository postRepository;
    @Autowired private UserRepository userRepository;

    private User alice;
    private User bob;
    private Post post;

    @BeforeEach
    void setUp() {
        alice = userRepository.save(new User("alice", "alice@example.com", "pass", ""));
        bob   = userRepository.save(new User("bob",   "bob@example.com",   "pass", ""));
        post  = postRepository.save(new Post("Test post", alice.getId(), null));
        setAuth(alice);
    }

    @AfterEach
    void tearDown() {
        commentRepository.deleteAll();
        postRepository.deleteAll();
        userRepository.deleteAll();
        SecurityContextHolder.clearContext();
    }

    private void setAuth(User user) {
        ApiAuthentication auth = new ApiAuthentication(
                mock(DecodedJWT.class), user, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    // ── getComments ───────────────────────────────────────────────────────────

    @Test
    void getComments_returnsCommentsForPost() {
        setAuth(bob);
        commentController.addComment(post.getId(), Map.of("content", "Great post!"));
        setAuth(alice);

        List<Comment> comments = commentController.getComments(post.getId());

        assertEquals(1, comments.size());
        assertEquals("Great post!", comments.get(0).getContent());
    }

    @Test
    void getComments_onNonExistentPost_throws404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> commentController.getComments("bad-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    // ── getCommentCount ───────────────────────────────────────────────────────

    @Test
    void getCommentCount_returnsCorrectCount() {
        commentController.addComment(post.getId(), Map.of("content", "One"));
        commentController.addComment(post.getId(), Map.of("content", "Two"));

        Map<String, Long> result = commentController.getCommentCount(post.getId());

        assertEquals(2L, result.get("count"));
    }

    @Test
    void getCommentCount_onNonExistentPost_throws404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> commentController.getCommentCount("bad-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    // ── addComment ────────────────────────────────────────────────────────────

    @Test
    void addComment_savesCommentSuccessfully() {
        Comment comment = commentController.addComment(
                post.getId(), Map.of("content", "Nice!"));

        assertNotNull(comment.getId());
        assertEquals("Nice!", comment.getContent());
        assertEquals(alice.getId(), comment.getAuthor().getId());
    }

    @Test
    void addComment_onNonExistentPost_throws404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> commentController.addComment("bad-id", Map.of("content", "Hello")));
        assertEquals(404, ex.getStatusCode().value());
    }

    // ── deleteComment ─────────────────────────────────────────────────────────

    @Test
    void deleteComment_byAuthor_removesComment() {
        Comment comment = commentController.addComment(
                post.getId(), Map.of("content", "Delete me"));

        commentController.deleteComment(post.getId(), comment.getId());

        assertFalse(commentRepository.existsById(comment.getId()));
    }

    @Test
    void deleteComment_byNonAuthor_throws403() {
        Comment comment = commentController.addComment(
                post.getId(), Map.of("content", "Alice's comment"));

        setAuth(bob);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> commentController.deleteComment(post.getId(), comment.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void deleteComment_nonExistent_throws404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> commentController.deleteComment(post.getId(), "non-existent"));
        assertEquals(404, ex.getStatusCode().value());
    }
}
