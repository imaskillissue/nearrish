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
        Post post = postService.createPost(alice, "Hello world", null, null, null, null);

        assertNotNull(post.getId());
        assertEquals("Hello world", post.getText());
        assertEquals(alice.getId(), post.getAuthorId());
        assertNull(post.getRespondingToId());
        assertTrue(post.getTimestamp() > 0);
    }

    @Test
    void createPost_withLocation_savesCoordinates() {
        Post post = postService.createPost(alice, "Post from Berlin", null, 52.5200, 13.4050, null);

        assertNotNull(post.getId());
        assertEquals(52.5200, post.getLatitude());
        assertEquals(13.4050, post.getLongitude());
    }

    @Test
    void createPost_withoutLocation_nullCoordinates() {
        Post post = postService.createPost(alice, "No location", null, null, null, null);

        assertNull(post.getLatitude());
        assertNull(post.getLongitude());
    }

    @Test
    void createPost_withImageUrl_savesImageUrl() {
        Post post = postService.createPost(alice, "With image", null, null, null, "/uploads/test.jpg");

        assertEquals("/uploads/test.jpg", post.getImageUrl());
    }

    @Test
    void createPost_withoutImageUrl_nullImageUrl() {
        Post post = postService.createPost(alice, "No image", null, null, null, null);

        assertNull(post.getImageUrl());
    }

    @Test
    void createPost_asReply_savesRespondingToId() {
        Post parent = postService.createPost(alice, "Parent post", null, null, null, null);
        Post reply = postService.createPost(bob, "Reply!", parent.getId(), null, null, null);

        assertEquals(parent.getId(), reply.getRespondingToId());
    }

    @Test
    void createPost_replyToNonExistentPost_throwsNotFound() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.createPost(alice, "Reply", "non-existent-id", null, null, null));
        assertEquals(404, ex.getStatusCode().value());
    }

    // --- getPost ---

    @Test
    void getPost_returnsPostSuccessfully() {
        Post created = postService.createPost(alice, "Test post", null, null, null, null);
        Post found = postService.getPost(created.getId());

        assertEquals(created.getId(), found.getId());
        assertEquals("Test post", found.getText());
    }

    @Test
    void getPost_nonExistent_throwsNotFound() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.getPost("non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    // --- getPostsByAuthor ---

    @Test
    void getPostsByAuthor_returnsCorrectPosts() {
        postService.createPost(alice, "Alice post 1", null, null, null, null);
        postService.createPost(alice, "Alice post 2", null, null, null, null);
        postService.createPost(bob, "Bob post", null, null, null, null);

        List<Post> alicePosts = postService.getPostsByAuthor(alice.getId());
        List<Post> bobPosts = postService.getPostsByAuthor(bob.getId());

        assertEquals(2, alicePosts.size());
        assertEquals(1, bobPosts.size());
    }

    @Test
    void getPostsByAuthor_noPostsReturnsEmptyList() {
        List<Post> posts = postService.getPostsByAuthor(alice.getId());
        assertTrue(posts.isEmpty());
    }

    // --- getFeed ---

    @Test
    void getFeed_returnsTopLevelPostsOnly() {
        Post parent = postService.createPost(alice, "Top level post", null, null, null, null);
        postService.createPost(bob, "Reply", parent.getId(), null, null, null);
        postService.createPost(bob, "Another top level", null, null, null, null);

        List<Post> feed = postService.getFeed();

        assertEquals(2, feed.size());
        assertTrue(feed.stream().allMatch(p -> p.getRespondingToId() == null));
    }

    @Test
    void getFeed_orderedByTimestampDesc() {
        Post first = postService.createPost(alice, "First", null, null, null, null);
        Post second = postService.createPost(bob, "Second", null, null, null, null);

        List<Post> feed = postService.getFeed();

        assertEquals(2, feed.size());
        assertTrue(feed.get(0).getTimestamp() >= feed.get(1).getTimestamp());
    }

    @Test
    void getFeed_emptyWhenNoPosts() {
        List<Post> feed = postService.getFeed();
        assertTrue(feed.isEmpty());
    }

    // --- getGeoFeed ---

    @Test
    void getGeoFeed_returnsOnlyPostsWithLocation() {
        postService.createPost(alice, "With location", null, 52.52, 13.40, null);
        postService.createPost(bob, "Without location", null, null, null, null);
        postService.createPost(alice, "Also with location", null, 48.85, 2.35, null);

        List<Post> geoFeed = postService.getGeoFeed();

        assertEquals(2, geoFeed.size());
        assertTrue(geoFeed.stream().allMatch(p -> p.getLatitude() != null && p.getLongitude() != null));
    }

    @Test
    void getGeoFeed_excludesReplies() {
        Post parent = postService.createPost(alice, "Parent with loc", null, 52.52, 13.40, null);
        postService.createPost(bob, "Reply with loc", parent.getId(), 48.85, 2.35, null);

        List<Post> geoFeed = postService.getGeoFeed();

        assertEquals(1, geoFeed.size());
        assertEquals(parent.getId(), geoFeed.get(0).getId());
    }

    @Test
    void getGeoFeed_emptyWhenNoGeotaggedPosts() {
        postService.createPost(alice, "No location", null, null, null, null);

        List<Post> geoFeed = postService.getGeoFeed();
        assertTrue(geoFeed.isEmpty());
    }

    // --- getReplies ---

    @Test
    void getReplies_returnsRepliesSuccessfully() {
        Post parent = postService.createPost(alice, "Parent", null, null, null, null);
        postService.createPost(bob, "Reply 1", parent.getId(), null, null, null);
        postService.createPost(alice, "Reply 2", parent.getId(), null, null, null);

        List<Post> replies = postService.getReplies(parent.getId());

        assertEquals(2, replies.size());
    }

    @Test
    void getReplies_nonExistentPost_throwsNotFound() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.getReplies("non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void getReplies_noReplies_returnsEmptyList() {
        Post parent = postService.createPost(alice, "No replies here", null, null, null, null);

        List<Post> replies = postService.getReplies(parent.getId());

        assertTrue(replies.isEmpty());
    }

    // --- deletePost ---

    @Test
    void deletePost_byAuthor_deletesSuccessfully() {
        Post post = postService.createPost(alice, "To be deleted", null, null, null, null);
        postService.deletePost(alice, post.getId());

        assertFalse(postRepository.existsById(post.getId()));
    }

    @Test
    void deletePost_byNonAuthor_throwsForbidden() {
        Post post = postService.createPost(alice, "Alice's post", null, null, null, null);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.deletePost(bob, post.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void deletePost_nonExistent_throwsNotFound() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.deletePost(alice, "non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }
}
