package com.nearrish.backend.controller;

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
class PublicPostControllerTest {

    @Autowired private PublicPostController publicPostController;
    @Autowired private PostRepository postRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private LikeRepository likeRepository;
    @Autowired private CommentRepository commentRepository;

    private User alice;

    @BeforeEach
    void setUp() {
        alice = userRepository.save(new User("alice", "alice@example.com", "pass", ""));
    }

    @AfterEach
    void tearDown() {
        commentRepository.deleteAll();
        likeRepository.deleteAll();
        postRepository.deleteAll();
        userRepository.deleteAll();
    }

    private Post savePublicPost(String text) {
        Post p = new Post(text, alice.getId(), null);
        p.setVisibility(Post.Visibility.PUBLIC);
        return postRepository.save(p);
    }

    private Post saveFriendsOnlyPost(String text) {
        Post p = new Post(text, alice.getId(), null);
        p.setVisibility(Post.Visibility.FRIENDS_ONLY);
        return postRepository.save(p);
    }

    // ── getPublicFeed ─────────────────────────────────────────────────────────

    @Test
    void getPublicFeed_returnsPublicPosts() {
        savePublicPost("Public post");

        List<PostResponse> feed = publicPostController.getPublicFeed();

        assertFalse(feed.isEmpty());
        assertTrue(feed.stream().anyMatch(p -> "Public post".equals(p.getText())));
    }

    @Test
    void getPublicFeed_excludesFriendsOnlyPosts() {
        savePublicPost("Visible");
        saveFriendsOnlyPost("Hidden");

        List<PostResponse> feed = publicPostController.getPublicFeed();

        assertTrue(feed.stream().noneMatch(p -> "Hidden".equals(p.getText())));
    }

    @Test
    void getPublicFeed_enrichesWithAuthorInfo() {
        savePublicPost("Enriched");

        List<PostResponse> feed = publicPostController.getPublicFeed();

        assertFalse(feed.isEmpty());
        PostResponse first = feed.get(0);
        assertNotNull(first.getAuthor());
        assertEquals("alice", first.getAuthor().username());
        assertFalse(first.isUserLiked(), "userLiked should be false for unauthenticated feed");
    }

    @Test
    void getPublicFeed_emptyWhenNoPosts() {
        List<PostResponse> feed = publicPostController.getPublicFeed();

        assertTrue(feed.isEmpty());
    }

    @Test
    void getPublicFeed_enrichesWithLikeAndCommentCounts() {
        savePublicPost("Counted post");

        List<PostResponse> feed = publicPostController.getPublicFeed();

        assertFalse(feed.isEmpty());
        assertEquals(0, feed.get(0).getLikeCount());
        assertEquals(0, feed.get(0).getCommentCount());
    }

    // ── getPublicGeoFeed ──────────────────────────────────────────────────────

    @Test
    void getPublicGeoFeed_returnsOnlyGeotaggedPosts() {
        Post geoPost = new Post("Geo post", alice.getId(), null, 48.85, 2.35);
        geoPost.setVisibility(Post.Visibility.PUBLIC);
        postRepository.save(geoPost);

        savePublicPost("No geo");

        List<PostResponse> geoFeed = publicPostController.getPublicGeoFeed();

        assertEquals(1, geoFeed.size());
        assertEquals("Geo post", geoFeed.get(0).getText());
        assertEquals(48.85, geoFeed.get(0).getLatitude());
        assertEquals(2.35,  geoFeed.get(0).getLongitude());
    }

    @Test
    void getPublicGeoFeed_emptyWhenNoGeotaggedPosts() {
        savePublicPost("No coords");

        List<PostResponse> geoFeed = publicPostController.getPublicGeoFeed();

        assertTrue(geoFeed.isEmpty());
    }
}
