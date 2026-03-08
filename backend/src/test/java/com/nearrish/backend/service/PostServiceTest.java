package com.nearrish.backend.service;

import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.PostRepository;
import com.nearrish.backend.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password="
})
class PostServiceTest {

    @Autowired
    private PostService postService;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserRepository userRepository;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = userRepository.save(new User("alice", "alice@example.com", "password", ""));
        bob = userRepository.save(new User("bob", "bob@example.com", "password", ""));
    }

    @AfterEach
    void tearDown() {
        postRepository.deleteAll();
        userRepository.deleteAll();
    }

    // --- createPost ---

    @Test
    void createPost_savesPostSuccessfully() {
        // Act
        Post post = postService.createPost(alice, "Hello world", null, null, null);

        // Assert
        assertNotNull(post.getId());
        assertEquals("Hello world", post.getText());
        assertEquals(alice.getId(), post.getAuthorId());
        assertNull(post.getRespondingToId());
        assertTrue(post.getTimestamp() > 0);
    }

    @Test
    void createPost_withLocation_savesCoordinates() {
        // Act
        Post post = postService.createPost(alice, "Post from Berlin", null, 52.5200, 13.4050);

        // Assert
        assertNotNull(post.getId());
        assertEquals(52.5200, post.getLatitude());
        assertEquals(13.4050, post.getLongitude());
    }

    @Test
    void createPost_withoutLocation_nullCoordinates() {
        // Act
        Post post = postService.createPost(alice, "No location", null, null, null);

        // Assert
        assertNull(post.getLatitude());
        assertNull(post.getLongitude());
    }

    @Test
    void createPost_asReply_savesRespondingToId() {
        // Arrange
        Post parent = postService.createPost(alice, "Parent post", null, null, null);

        // Act
        Post reply = postService.createPost(bob, "Reply!", parent.getId(), null, null);

        // Assert
        assertEquals(parent.getId(), reply.getRespondingToId());
    }

    @Test
    void createPost_replyToNonExistentPost_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.createPost(alice, "Reply", "non-existent-id", null, null));
        assertEquals(404, ex.getStatusCode().value());
    }

    // --- getPost ---

    @Test
    void getPost_returnsPostSuccessfully() {
        // Arrange
        Post created = postService.createPost(alice, "Test post", null, null, null);

        // Act
        Post found = postService.getPost(created.getId());

        // Assert
        assertEquals(created.getId(), found.getId());
        assertEquals("Test post", found.getText());
    }

    @Test
    void getPost_nonExistent_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.getPost("non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    // --- getPostsByAuthor ---

    @Test
    void getPostsByAuthor_returnsCorrectPosts() {
        // Arrange
        postService.createPost(alice, "Alice post 1", null, null, null);
        postService.createPost(alice, "Alice post 2", null, null, null);
        postService.createPost(bob, "Bob post", null, null, null);

        // Act
        List<Post> alicePosts = postService.getPostsByAuthor(alice.getId());
        List<Post> bobPosts = postService.getPostsByAuthor(bob.getId());

        // Assert
        assertEquals(2, alicePosts.size());
        assertEquals(1, bobPosts.size());
    }

    @Test
    void getPostsByAuthor_noPostsReturnsEmptyList() {
        // Act
        List<Post> posts = postService.getPostsByAuthor(alice.getId());

        // Assert
        assertTrue(posts.isEmpty());
    }

    // --- getReplies ---

    @Test
    void getReplies_returnsRepliesSuccessfully() {
        // Arrange
        Post parent = postService.createPost(alice, "Parent", null, null, null);
        postService.createPost(bob, "Reply 1", parent.getId(), null, null);
        postService.createPost(alice, "Reply 2", parent.getId(), null, null);

        // Act
        List<Post> replies = postService.getReplies(parent.getId());

        // Assert
        assertEquals(2, replies.size());
    }

    @Test
    void getReplies_nonExistentPost_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.getReplies("non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void getReplies_noReplies_returnsEmptyList() {
        // Arrange
        Post parent = postService.createPost(alice, "No replies here", null, null, null);

        // Act
        List<Post> replies = postService.getReplies(parent.getId());

        // Assert
        assertTrue(replies.isEmpty());
    }

    // --- deletePost ---

    @Test
    void deletePost_byAuthor_deletesSuccessfully() {
        // Arrange
        Post post = postService.createPost(alice, "To be deleted", null, null, null);

        // Act
        postService.deletePost(alice, post.getId());

        // Assert
        assertFalse(postRepository.existsById(post.getId()));
    }

    @Test
    void deletePost_byNonAuthor_throwsForbidden() {
        // Arrange
        Post post = postService.createPost(alice, "Alice's post", null, null, null);

        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.deletePost(bob, post.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void deletePost_nonExistent_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.deletePost(alice, "non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }
}
