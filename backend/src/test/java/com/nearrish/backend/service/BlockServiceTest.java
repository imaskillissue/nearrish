package com.nearrish.backend.service;

import com.nearrish.backend.entity.Block;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.BlockRepository;
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
class BlockServiceTest {

    @Autowired
    private BlockService blockService;

    @Autowired
    private BlockRepository blockRepository;

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
        blockRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void blockUser_createsBlockSuccessfully() {
        // Act
        Block block = blockService.blockUser(alice, bob.getId());

        // Assert
        assertNotNull(block.getId());
        assertEquals(alice.getId(), block.getBlocker().getId());
        assertEquals(bob.getId(), block.getBlocked().getId());
    }

    @Test
    void blockUser_toSelf_throwsBadRequest() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> blockService.blockUser(alice, alice.getId()));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void blockUser_toNonExistentUser_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> blockService.blockUser(alice, "non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void blockUser_duplicate_throwsConflict() {
        // Arrange
        blockService.blockUser(alice, bob.getId());

        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> blockService.blockUser(alice, bob.getId()));
        assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    void unblockUser_removesBlock() {
        // Arrange
        blockService.blockUser(alice, bob.getId());

        // Act
        blockService.unblockUser(alice, bob.getId());

        // Assert
        assertFalse(blockService.isBlocked(alice.getId(), bob.getId()));
    }

    @Test
    void unblockUser_whenNotBlocked_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> blockService.unblockUser(alice, bob.getId()));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void getBlockedUsers_returnsBlockedList() {
        // Arrange
        blockService.blockUser(alice, bob.getId());

        // Act
        List<User> blocked = blockService.getBlockedUsers(alice);

        // Assert
        assertEquals(1, blocked.size());
        assertEquals(bob.getId(), blocked.get(0).getId());
    }

    @Test
    void isBlocked_returnsTrueWhenBlocked() {
        // Arrange
        blockService.blockUser(alice, bob.getId());

        // Assert
        assertTrue(blockService.isBlocked(alice.getId(), bob.getId()));
        assertFalse(blockService.isBlocked(bob.getId(), alice.getId()));
    }
}
