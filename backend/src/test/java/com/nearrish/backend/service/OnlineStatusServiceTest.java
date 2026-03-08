package com.nearrish.backend.service;

import com.nearrish.backend.security.StompAuthInterceptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OnlineStatusServiceTest {

    private SimpMessagingTemplate messagingTemplate;
    private OnlineStatusService onlineStatusService;

    @BeforeEach
    void setUp() {
        messagingTemplate = mock(SimpMessagingTemplate.class);
        onlineStatusService = new OnlineStatusService(messagingTemplate);
    }

    @Test
    void handleConnect_addsUserToOnlineSet() {
        // Arrange
        SessionConnectEvent event = createConnectEvent("alice", "user-1");

        // Act
        onlineStatusService.handleConnect(event);

        // Assert
        assertTrue(onlineStatusService.isOnline("user-1"));
        assertTrue(onlineStatusService.getOnlineUsers().contains("user-1"));
    }

    @Test
    void handleConnect_broadcastsOnlineStatus() {
        // Arrange
        SessionConnectEvent event = createConnectEvent("alice", "user-1");

        // Act
        onlineStatusService.handleConnect(event);

        // Assert
        verify(messagingTemplate).convertAndSend(
                eq("/topic/online"),
                eq((Object) Map.of("userId", "user-1", "status", "ONLINE"))
        );
    }

    @Test
    void handleDisconnect_removesUserFromOnlineSet() {
        // Arrange
        onlineStatusService.handleConnect(createConnectEvent("alice", "user-1"));

        // Act
        onlineStatusService.handleDisconnect(createDisconnectEvent("alice", "user-1"));

        // Assert
        assertFalse(onlineStatusService.isOnline("user-1"));
        assertFalse(onlineStatusService.getOnlineUsers().contains("user-1"));
    }

    @Test
    void handleDisconnect_broadcastsOfflineStatus() {
        // Arrange
        onlineStatusService.handleConnect(createConnectEvent("alice", "user-1"));
        reset(messagingTemplate);

        // Act
        onlineStatusService.handleDisconnect(createDisconnectEvent("alice", "user-1"));

        // Assert
        verify(messagingTemplate).convertAndSend(
                eq("/topic/online"),
                eq((Object) Map.of("userId", "user-1", "status", "OFFLINE"))
        );
    }

    @Test
    void multipleUsers_trackedIndependently() {
        // Act
        onlineStatusService.handleConnect(createConnectEvent("alice", "user-1"));
        onlineStatusService.handleConnect(createConnectEvent("bob", "user-2"));

        // Assert
        assertEquals(2, onlineStatusService.getOnlineUsers().size());
        assertTrue(onlineStatusService.isOnline("user-1"));
        assertTrue(onlineStatusService.isOnline("user-2"));

        // Disconnect one
        onlineStatusService.handleDisconnect(createDisconnectEvent("alice", "user-1"));
        assertEquals(1, onlineStatusService.getOnlineUsers().size());
        assertFalse(onlineStatusService.isOnline("user-1"));
        assertTrue(onlineStatusService.isOnline("user-2"));
    }

    @Test
    void isOnline_returnsFalseForUnknownUser() {
        assertFalse(onlineStatusService.isOnline("unknown-user"));
    }

    @Test
    void getOnlineUsers_returnsDefensiveCopy() {
        // Arrange
        onlineStatusService.handleConnect(createConnectEvent("alice", "user-1"));

        // Act & Assert — returned set should be immutable
        assertThrows(UnsupportedOperationException.class,
                () -> onlineStatusService.getOnlineUsers().add("injected-user"));
    }

    // --- Helpers ---

    private SessionConnectEvent createConnectEvent(String username, String userId) {
        StompAuthInterceptor.StompPrincipal principal = new StompAuthInterceptor.StompPrincipal(username, userId);
        Message<byte[]> message = MessageBuilder.withPayload(new byte[0]).build();
        return new SessionConnectEvent(this, message, principal);
    }

    private SessionDisconnectEvent createDisconnectEvent(String username, String userId) {
        StompAuthInterceptor.StompPrincipal principal = new StompAuthInterceptor.StompPrincipal(username, userId);
        Message<byte[]> message = MessageBuilder.withPayload(new byte[0]).build();
        return new SessionDisconnectEvent(this, message, "session-1", CloseStatus.NORMAL, principal);
    }
}
