package com.nearrish.backend.controller;

import com.auth0.jwt.interfaces.DecodedJWT;
import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.CommentRepository;
import com.nearrish.backend.repository.LikeRepository;
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
class PostControllerTest {

    @Autowired private PostController postController;
    @Autowired private PostRepository postRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private CommentRepository commentRepository;
    @Autowired private LikeRepository likeRepository;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = userRepository.save(new User("alice", "alice@example.com", "pass", ""));
        bob   = userRepository.save(new User("bob",   "bob@example.com",   "pass", ""));
        setAuth(alice);
    }

    @AfterEach
    void tearDown() {
        commentRepository.deleteAll();
        likeRepository.deleteAll();
        postRepository.deleteAll();
        userRepository.deleteAll();
        SecurityContextHolder.clearContext();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void setAuth(User user) {
        ApiAuthentication auth = new ApiAuthentication(
                mock(DecodedJWT.class), user, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    // ── createPost ────────────────────────────────────────────────────────────

    @Test
    void createPost_returnsEnrichedResponse() {
        PostResponse resp = postController.createPost(
                "Hello world", null, null, null, null, "PUBLIC");

        assertNotNull(resp.getId());
        assertEquals("Hello world", resp.getText());
        assertEquals(alice.getId(), resp.getAuthorId());
        assertNotNull(resp.getAuthor());
        assertEquals(alice.getUsername(), resp.getAuthor().username());
        assertEquals(0, resp.getLikeCount());
        assertEquals(0, resp.getCommentCount());
    }

    @Test
    void createPost_withFriendsOnlyVisibility_setsCorrectVisibility() {
        PostResponse resp = postController.createPost(
                "Private post", null, null, null, null, "FRIENDS_ONLY");

        assertEquals(Post.Visibility.FRIENDS_ONLY, resp.getVisibility());
    }

    @Test
    void createPost_withInvalidVisibility_defaultsToPublic() {
        PostResponse resp = postController.createPost(
                "Post", null, null, null, null, "INVALID");

        assertEquals(Post.Visibility.PUBLIC, resp.getVisibility());
    }

    @Test
    void createPost_withGeoCoords_storesLatLng() {
        PostResponse resp = postController.createPost(
                "Near here", null, 48.85, 2.35, null, "PUBLIC");

        assertEquals(48.85, resp.getLatitude());
        assertEquals(2.35,  resp.getLongitude());
    }

    // ── getFeed ───────────────────────────────────────────────────────────────

    @Test
    void getFeed_returnsOwnPost() {
        postController.createPost("My post", null, null, null, null, "PUBLIC");

        List<PostResponse> feed = postController.getFeed();

        assertFalse(feed.isEmpty());
        assertTrue(feed.stream().anyMatch(p -> "My post".equals(p.getText())));
    }

    @Test
    void getFeed_excludesFriendsOnlyPostsFromStranger() {
        // bob creates a FRIENDS_ONLY post
        setAuth(bob);
        postController.createPost("Bob private", null, null, null, null, "FRIENDS_ONLY");

        // alice (not bob's friend) fetches feed
        setAuth(alice);
        List<PostResponse> feed = postController.getFeed();

        assertTrue(feed.stream().noneMatch(p -> "Bob private".equals(p.getText())));
    }

    // ── getPost ───────────────────────────────────────────────────────────────

    @Test
    void getPost_returnsCorrectPost() {
        PostResponse created = postController.createPost(
                "Find me", null, null, null, null, "PUBLIC");

        PostResponse fetched = postController.getPost(created.getId());

        assertEquals("Find me", fetched.getText());
    }

    @Test
    void getPost_nonExistent_throws404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postController.getPost("non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    // ── getPostsByAuthor ──────────────────────────────────────────────────────

    @Test
    void getPostsByAuthor_returnsOnlyAuthorPosts() {
        postController.createPost("Alice's post", null, null, null, null, "PUBLIC");
        setAuth(bob);
        postController.createPost("Bob's post",   null, null, null, null, "PUBLIC");
        setAuth(alice);

        List<PostResponse> alicePosts = postController.getPostsByAuthor(alice.getId());

        assertEquals(1, alicePosts.size());
        assertEquals("Alice's post", alicePosts.get(0).getText());
    }

    // ── deletePost ────────────────────────────────────────────────────────────

    @Test
    void deletePost_byAuthor_removesPost() {
        PostResponse created = postController.createPost(
                "Delete me", null, null, null, null, "PUBLIC");

        postController.deletePost(created.getId());

        assertFalse(postRepository.existsById(created.getId()));
    }

    @Test
    void deletePost_byNonAuthor_throws403() {
        PostResponse created = postController.createPost(
                "Alice's post", null, null, null, null, "PUBLIC");

        setAuth(bob);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postController.deletePost(created.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }

    // ── getReplies ────────────────────────────────────────────────────────────

    @Test
    void getReplies_returnsChildPosts() {
        PostResponse parent = postController.createPost(
                "Parent", null, null, null, null, "PUBLIC");
        postController.createPost(
                "Reply", parent.getId(), null, null, null, "PUBLIC");

        List<PostResponse> replies = postController.getReplies(parent.getId());

        assertEquals(1, replies.size());
        assertEquals("Reply", replies.get(0).getText());
    }
}
