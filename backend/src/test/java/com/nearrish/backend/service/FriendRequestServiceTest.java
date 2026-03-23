package com.nearrish.backend.service;

import com.nearrish.backend.entity.FriendRequest;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.FriendRequestRepository;
import com.nearrish.backend.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password="
})
class FriendRequestServiceTest {

    @MockitoBean
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private FriendRequestService friendRequestService;

    @Autowired
    private FriendRequestRepository friendRequestRepository;

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
        friendRequestRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void sendRequest_createsRequestSuccessfully() {
        // Act
        FriendRequest request = friendRequestService.sendRequest(alice, bob.getId());

        // Assert
        assertNotNull(request.getId());
        assertEquals(FriendRequest.Status.PENDING, request.getStatus());
        assertEquals(alice.getId(), request.getSender().getId());
        assertEquals(bob.getId(), request.getReceiver().getId());
    }

    @Test
    void sendRequest_toSelf_throwsBadRequest() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> friendRequestService.sendRequest(alice, alice.getId()));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void sendRequest_toNonExistentUser_throwsNotFound() {
        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> friendRequestService.sendRequest(alice, "non-existent-id"));
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void sendRequest_duplicate_throwsConflict() {
        // Arrange
        friendRequestService.sendRequest(alice, bob.getId());

        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> friendRequestService.sendRequest(alice, bob.getId()));
        assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    void acceptRequest_updatesStatusToAccepted() {
        // Arrange
        FriendRequest request = friendRequestService.sendRequest(alice, bob.getId());

        // Act
        FriendRequest accepted = friendRequestService.acceptRequest(bob, request.getId());

        // Assert
        assertEquals(FriendRequest.Status.ACCEPTED, accepted.getStatus());
    }

    @Test
    void acceptRequest_byNonReceiver_throwsForbidden() {
        // Arrange
        FriendRequest request = friendRequestService.sendRequest(alice, bob.getId());

        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> friendRequestService.acceptRequest(alice, request.getId()));
        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void acceptRequest_alreadyHandled_throwsBadRequest() {
        // Arrange
        FriendRequest request = friendRequestService.sendRequest(alice, bob.getId());
        friendRequestService.acceptRequest(bob, request.getId());

        // Act & Assert
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> friendRequestService.acceptRequest(bob, request.getId()));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void declineRequest_updatesStatusToDeclined() {
        // Arrange
        FriendRequest request = friendRequestService.sendRequest(alice, bob.getId());

        // Act
        friendRequestService.declineRequest(bob, request.getId());

        // Assert
        FriendRequest updated = friendRequestRepository.findById(request.getId()).orElseThrow();
        assertEquals(FriendRequest.Status.DECLINED, updated.getStatus());
    }

    @Test
    void getFriends_returnsAcceptedFriends() {
        // Arrange
        FriendRequest request = friendRequestService.sendRequest(alice, bob.getId());
        friendRequestService.acceptRequest(bob, request.getId());

        // Act
        List<User> friends = friendRequestService.getFriends(alice);

        // Assert
        assertEquals(1, friends.size());
        assertEquals(bob.getId(), friends.get(0).getId());
    }

    @Test
    void getFriends_pendingRequest_notIncluded() {
        // Arrange
        friendRequestService.sendRequest(alice, bob.getId());

        // Act
        List<User> friends = friendRequestService.getFriends(alice);

        // Assert
        assertTrue(friends.isEmpty());
    }

    @Test
    void getIncomingRequests_returnsPendingRequests() {
        // Arrange
        friendRequestService.sendRequest(alice, bob.getId());

        // Act
        List<FriendRequest> incoming = friendRequestService.getIncomingRequests(bob);

        // Assert
        assertEquals(1, incoming.size());
        assertEquals(alice.getId(), incoming.get(0).getSender().getId());
    }

    @Test
    void getOutgoingRequests_returnsPendingRequests() {
        // Arrange
        friendRequestService.sendRequest(alice, bob.getId());

        // Act
        List<FriendRequest> outgoing = friendRequestService.getOutgoingRequests(alice);

        // Assert
        assertEquals(1, outgoing.size());
        assertEquals(bob.getId(), outgoing.get(0).getReceiver().getId());
    }

    // --- WebSocket notification tests ---

    @Test
    void sendRequest_notifiesReceiverViaWebSocket() {
        // Act
        FriendRequest request = friendRequestService.sendRequest(alice, bob.getId());

        // Assert
        verify(messagingTemplate).convertAndSendToUser(
                eq(bob.getUsername()),
                eq("/queue/friends"),
                eq(Map.of("type", "REQUEST_RECEIVED", "fromUserId", alice.getId(), "requestId", request.getId()))
        );
    }

    @Test
    void acceptRequest_notifiesSenderViaWebSocket() {
        // Arrange
        FriendRequest request = friendRequestService.sendRequest(alice, bob.getId());
        reset(messagingTemplate);

        // Act
        friendRequestService.acceptRequest(bob, request.getId());

        // Assert
        verify(messagingTemplate).convertAndSendToUser(
                eq(alice.getUsername()),
                eq("/queue/friends"),
                eq(Map.of("type", "REQUEST_ACCEPTED", "byUserId", bob.getId()))
        );
    }

    @Test
    void declineRequest_sendsDeclinedNotificationToSender() {
        // Arrange
        FriendRequest request = friendRequestService.sendRequest(alice, bob.getId());
        reset(messagingTemplate);

        // Act
        friendRequestService.declineRequest(bob, request.getId());

        // Assert
        verify(messagingTemplate).convertAndSendToUser(
                eq(alice.getUsername()),
                eq("/queue/friends"),
                eq(Map.of("type", "REQUEST_DECLINED", "byUserId", bob.getId()))
        );
    }
}
