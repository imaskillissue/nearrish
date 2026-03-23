package com.nearrish.backend.service;

import com.nearrish.backend.entity.Comment;
import com.nearrish.backend.entity.Post;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.CommentRepository;
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
class CommentServiceTest {

    @Autowired
    private CommentService commentService;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserRepository userRepository;

    private User alice;
    private User bob;
    private Post post;

    @BeforeEach
    void setUp() {
        alice = userRepository.save(new User("alice", "alice@example.com", "password", ""));
        bob = userRepository.save(new User("bob", "bob@example.com", "password", ""));
        post = postRepository.save(new Post("Hello world", alice.getId(), null));
    }

    @AfterEach
    void tearDown() {
        commentRepository.deleteAll();
        postRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void addComment_savesCommentSuccessfully() {
        // Act
        Comment comment = commentService.addComment(bob, post.getId(), "Nice post!");

        // Assert
        assertNotNull(comment.getId());
        assertEquals("Nice post!", comment.getContent());
        assertEquals(bob.getId(), comment.getAuthor().getId());
        assertEquals(post.getId(), comment.getPost().getId());
    }

    @Test
    void addComment_toNonExistentPost_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> commentService.addComment(bob, "non-existent-id", "Hello!"));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void getComments_returnsCommentsInOrder() {
        // Arrange
        commentService.addComment(bob, post.getId(), "First");
        commentService.addComment(alice, post.getId(), "Second");

        // Act
        List<Comment> comments = commentService.getComments(post.getId());

        // Assert
        assertEquals(2, comments.size());
        assertEquals("First", comments.get(0).getContent());
        assertEquals("Second", comments.get(1).getContent());
    }

    @Test
    void getComments_onNonExistentPost_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> commentService.getComments("non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void deleteComment_byAuthor_deletesSuccessfully() {
        // Arrange
        Comment comment = commentService.addComment(bob, post.getId(), "To be deleted");

        // Act
        commentService.deleteComment(bob, comment.getId());

        // Assert
        assertFalse(commentRepository.existsById(comment.getId()));
    }

    @Test
    void deleteComment_byNonAuthor_throwsForbidden() {
        // Arrange
        Comment comment = commentService.addComment(bob, post.getId(), "Bob's comment");

        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> commentService.deleteComment(alice, comment.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void deleteComment_nonExistent_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> commentService.deleteComment(alice, "non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }
}
