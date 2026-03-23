package com.nearrish.backend.service;

import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.FriendRequestRepository;
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
        "spring.datasource.password=",
        "MODERATION_ENABLED=false"
})
class PostServiceTest {

    @Autowired private PostService postService;
    @Autowired private PostRepository postRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private FriendRequestRepository friendRequestRepository;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = userRepository.save(new User("alice", "alice@example.com", "password", ""));
        bob   = userRepository.save(new User("bob",   "bob@example.com",   "password", ""));
    }

    @AfterEach
    void tearDown() {
        friendRequestRepository.deleteAll();
        postRepository.deleteAll();
        userRepository.deleteAll();
    }

    private Post create(User author, String text) {
        return postService.createPost(author, text, null, null, null, null, Post.Visibility.PUBLIC);
    }

    // ── createPost ────────────────────────────────────────────────────────────

    @Test
    void createPost_savesPostSuccessfully() {
        Post post = create(alice, "Hello world");

        assertNotNull(post.getId());
        assertEquals("Hello world", post.getText());
        assertEquals(alice.getId(), post.getAuthorId());
        assertNull(post.getRespondingToId());
        assertTrue(post.getTimestamp() > 0);
    }

    @Test
    void createPost_withLocation_savesCoordinates() {
        Post post = postService.createPost(alice, "Berlin", null, 52.52, 13.40, null, Post.Visibility.PUBLIC);

        assertEquals(52.52, post.getLatitude());
        assertEquals(13.40, post.getLongitude());
    }

    @Test
    void createPost_withoutLocation_nullCoordinates() {
        Post post = create(alice, "No location");

        assertNull(post.getLatitude());
        assertNull(post.getLongitude());
    }

    @Test
    void createPost_withImageUrl_savesImageUrl() {
        Post post = postService.createPost(alice, "With image", null, null, null, "/uploads/img.jpg", Post.Visibility.PUBLIC);

        assertEquals("/uploads/img.jpg", post.getImageUrl());
    }

    @Test
    void createPost_asReply_savesRespondingToId() {
        Post parent = create(alice, "Parent");
        Post reply  = postService.createPost(bob, "Reply!", parent.getId(), null, null, null, Post.Visibility.PUBLIC);

        assertEquals(parent.getId(), reply.getRespondingToId());
    }

    @Test
    void createPost_replyToNonExistentPost_throws404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.createPost(alice, "Reply", "bad-id", null, null, null, Post.Visibility.PUBLIC));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void createPost_withFriendsOnlyVisibility_storesVisibility() {
        Post post = postService.createPost(alice, "Private", null, null, null, null, Post.Visibility.FRIENDS_ONLY);
        assertEquals(Post.Visibility.FRIENDS_ONLY, post.getVisibility());
    }

    @Test
    void createPost_nullVisibility_defaultsToPublic() {
        Post post = postService.createPost(alice, "Default vis", null, null, null, null, null);
        assertEquals(Post.Visibility.PUBLIC, post.getVisibility());
    }

    // ── getPost ───────────────────────────────────────────────────────────────

    @Test
    void getPost_returnsPost() {
        Post created = create(alice, "Test post");
        Post found   = postService.getPost(created.getId());

        assertEquals(created.getId(), found.getId());
        assertEquals("Test post", found.getText());
    }

    @Test
    void getPost_nonExistent_throws404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.getPost("non-existent"));
        assertEquals(404, ex.getStatusCode().value());
    }

    // ── getPostsByAuthor ──────────────────────────────────────────────────────

    @Test
    void getPostsByAuthor_returnsCorrectPosts() {
        create(alice, "Alice 1");
        create(alice, "Alice 2");
        create(bob,   "Bob 1");

        assertEquals(2, postService.getPostsByAuthor(alice.getId()).size());
        assertEquals(1, postService.getPostsByAuthor(bob.getId()).size());
    }

    @Test
    void getPostsByAuthor_noPosts_returnsEmpty() {
        assertTrue(postService.getPostsByAuthor(alice.getId()).isEmpty());
    }

    // ── getFeed ───────────────────────────────────────────────────────────────

    @Test
    void getFeed_returnsTopLevelPostsOnly() {
        Post parent = create(alice, "Top level");
        postService.createPost(bob, "Reply", parent.getId(), null, null, null, Post.Visibility.PUBLIC);
        create(bob, "Another top level");

        List<Post> feed = postService.getFeed(alice);

        assertEquals(2, feed.size());
        assertTrue(feed.stream().allMatch(p -> p.getRespondingToId() == null));
    }

    @Test
    void getFeed_orderedByTimestampDesc() {
        create(alice, "First");
        create(bob,   "Second");

        List<Post> feed = postService.getFeed(alice);

        assertEquals(2, feed.size());
        assertTrue(feed.get(0).getTimestamp() >= feed.get(1).getTimestamp());
    }

    @Test
    void getFeed_excludesFriendsOnlyFromStranger() {
        postService.createPost(bob, "Bob private", null, null, null, null, Post.Visibility.FRIENDS_ONLY);

        List<Post> feed = postService.getFeed(alice);  // alice is not bob's friend

        assertTrue(feed.stream().noneMatch(p -> "Bob private".equals(p.getText())));
    }

    @Test
    void getFeed_emptyWhenNoPosts() {
        assertTrue(postService.getFeed(alice).isEmpty());
    }

    // ── getPublicFeed ─────────────────────────────────────────────────────────

    @Test
    void getPublicFeed_returnsPublicPosts() {
        create(alice, "Public");
        postService.createPost(bob, "Private", null, null, null, null, Post.Visibility.FRIENDS_ONLY);

        List<Post> feed = postService.getPublicFeed();

        assertEquals(1, feed.size());
        assertEquals("Public", feed.get(0).getText());
    }

    // ── getGeoFeed ────────────────────────────────────────────────────────────

    @Test
    void getGeoFeed_returnsOnlyGeotaggedPosts() {
        postService.createPost(alice, "With loc", null, 52.52, 13.40, null, Post.Visibility.PUBLIC);
        create(bob, "No loc");

        List<Post> geoFeed = postService.getGeoFeed(alice);

        assertEquals(1, geoFeed.size());
        assertNotNull(geoFeed.get(0).getLatitude());
    }

    @Test
    void getPublicGeoFeed_excludesFriendsOnlyPosts() {
        postService.createPost(alice, "Geo private", null, 48.85, 2.35, null, Post.Visibility.FRIENDS_ONLY);

        List<Post> feed = postService.getPublicGeoFeed();

        assertTrue(feed.isEmpty());
    }

    // ── getReplies ────────────────────────────────────────────────────────────

    @Test
    void getReplies_returnsReplies() {
        Post parent = create(alice, "Parent");
        postService.createPost(bob, "Reply 1", parent.getId(), null, null, null, Post.Visibility.PUBLIC);
        postService.createPost(alice, "Reply 2", parent.getId(), null, null, null, Post.Visibility.PUBLIC);

        assertEquals(2, postService.getReplies(parent.getId()).size());
    }

    @Test
    void getReplies_nonExistent_throws404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.getReplies("bad-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void getReplies_noReplies_returnsEmpty() {
        Post parent = create(alice, "No replies");
        assertTrue(postService.getReplies(parent.getId()).isEmpty());
    }

    // ── deletePost ────────────────────────────────────────────────────────────

    @Test
    void deletePost_byAuthor_deletesSuccessfully() {
        Post post = create(alice, "Delete me");
        postService.deletePost(alice, post.getId());

        assertFalse(postRepository.existsById(post.getId()));
    }

    @Test
    void deletePost_byNonAuthor_throws403() {
        Post post = create(alice, "Alice's post");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.deletePost(bob, post.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void deletePost_nonExistent_throws404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> postService.deletePost(alice, "bad-id"));
        assertEquals(404, ex.getStatusCode().value());
    }
}
