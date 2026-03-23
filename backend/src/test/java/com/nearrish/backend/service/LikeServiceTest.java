package com.nearrish.backend.service;

import com.nearrish.backend.entity.Comment;
import com.nearrish.backend.entity.Like;
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

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password="
})
class LikeServiceTest {

    @Autowired
    private LikeService likeService;

    @Autowired
    private LikeRepository likeRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private UserRepository userRepository;

    private User alice;
    private User bob;
    private Post post;
    private Comment comment;

    @BeforeEach
    void setUp() {
        alice = userRepository.save(new User("alice", "alice@example.com", "password", ""));
        bob = userRepository.save(new User("bob", "bob@example.com", "password", ""));
        post = postRepository.save(new Post("Hello world", alice.getId(), null));
        comment = commentRepository.save(new Comment(post, bob, "Nice post!"));
    }

    @AfterEach
    void tearDown() {
        likeRepository.deleteAll();
        commentRepository.deleteAll();
        postRepository.deleteAll();
        userRepository.deleteAll();
    }

    // --- Post likes ---

    @Test
    void likePost_savesLikeSuccessfully() {
        // Act
        Like like = likeService.likePost(bob, post.getId());

        // Assert
        assertNotNull(like.getId());
        assertEquals(bob.getId(), like.getUser().getId());
        assertEquals(post.getId(), like.getPost().getId());
    }

    @Test
    void likePost_nonExistentPost_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> likeService.likePost(bob, "non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void likePost_duplicate_throwsConflict() {
        // Arrange
        likeService.likePost(bob, post.getId());

        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> likeService.likePost(bob, post.getId()));
        assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    void unlikePost_removesLike() {
        // Arrange
        likeService.likePost(bob, post.getId());

        // Act
        likeService.unlikePost(bob, post.getId());

        // Assert
        assertEquals(0, likeService.getPostLikeCount(post.getId()));
    }

    @Test
    void unlikePost_whenNotLiked_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> likeService.unlikePost(bob, post.getId()));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void getPostLikeCount_returnsCorrectCount() {
        // Arrange
        likeService.likePost(alice, post.getId());
        likeService.likePost(bob, post.getId());

        // Act & Assert
        assertEquals(2, likeService.getPostLikeCount(post.getId()));
    }

    @Test
    void getPostLikeCount_nonExistentPost_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> likeService.getPostLikeCount("non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    // --- Comment likes ---

    @Test
    void likeComment_savesLikeSuccessfully() {
        // Act
        Like like = likeService.likeComment(alice, comment.getId());

        // Assert
        assertNotNull(like.getId());
        assertEquals(alice.getId(), like.getUser().getId());
        assertEquals(comment.getId(), like.getComment().getId());
    }

    @Test
    void likeComment_nonExistentComment_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> likeService.likeComment(alice, "non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void likeComment_duplicate_throwsConflict() {
        // Arrange
        likeService.likeComment(alice, comment.getId());

        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> likeService.likeComment(alice, comment.getId()));
        assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    void unlikeComment_removesLike() {
        // Arrange
        likeService.likeComment(alice, comment.getId());

        // Act
        likeService.unlikeComment(alice, comment.getId());

        // Assert
        assertEquals(0, likeService.getCommentLikeCount(comment.getId()));
    }

    @Test
    void getCommentLikeCount_returnsCorrectCount() {
        // Arrange
        likeService.likeComment(alice, comment.getId());
        likeService.likeComment(bob, comment.getId());

        // Act & Assert
        assertEquals(2, likeService.getCommentLikeCount(comment.getId()));
    }
}
