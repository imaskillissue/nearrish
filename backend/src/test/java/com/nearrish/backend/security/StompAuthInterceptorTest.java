package com.nearrish.backend.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class StompAuthInterceptorTest {

    private final StompAuthInterceptor interceptor = new StompAuthInterceptor();
    private final MessageChannel channel = mock(MessageChannel.class);
    private final String secret = "a-string-secret-at-least-256-bits-long-to-be-secure";

    private Message<?> buildStompMessage(StompCommand command, String authHeader) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        if (authHeader != null) {
            accessor.addNativeHeader("AUTH", authHeader);
        }
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    @Test
    void connect_withValidJwt_setsPrincipal() {
        // Arrange
        String token = JWT.create()
                .withClaim("username", "alice")
                .withClaim("userId", "user-123")
                .sign(Algorithm.HMAC256(secret));

        Message<?> message = buildStompMessage(StompCommand.CONNECT, token);

        // Act
        Message<?> result = interceptor.preSend(message, channel);

        // Assert
        assertNotNull(result);
        StompHeaderAccessor resultAccessor = MessageHeaderAccessor.getAccessor(result, StompHeaderAccessor.class);
        assertNotNull(resultAccessor);
        assertNotNull(resultAccessor.getUser());
        assertEquals("alice", resultAccessor.getUser().getName());
        assertInstanceOf(StompAuthInterceptor.StompPrincipal.class, resultAccessor.getUser());
        assertEquals("user-123", ((StompAuthInterceptor.StompPrincipal) resultAccessor.getUser()).getUserId());
    }

    @Test
    void connect_withInvalidJwt_noPrincipalSet() {
        Message<?> message = buildStompMessage(StompCommand.CONNECT, "invalid-token");

        Message<?> result = interceptor.preSend(message, channel);

        assertNotNull(result);
        StompHeaderAccessor resultAccessor = MessageHeaderAccessor.getAccessor(result, StompHeaderAccessor.class);
        assertNotNull(resultAccessor);
        assertNull(resultAccessor.getUser());
    }

    @Test
    void connect_withNoAuthHeader_noPrincipalSet() {
        Message<?> message = buildStompMessage(StompCommand.CONNECT, null);

        Message<?> result = interceptor.preSend(message, channel);

        assertNotNull(result);
        StompHeaderAccessor resultAccessor = MessageHeaderAccessor.getAccessor(result, StompHeaderAccessor.class);
        assertNotNull(resultAccessor);
        assertNull(resultAccessor.getUser());
    }

    @Test
    void connect_withExpiredJwt_noPrincipalSet() {
        String token = JWT.create()
                .withClaim("username", "alice")
                .withClaim("userId", "user-123")
                .withExpiresAt(new java.util.Date(System.currentTimeMillis() - 1000))
                .sign(Algorithm.HMAC256(secret));

        Message<?> message = buildStompMessage(StompCommand.CONNECT, token);

        Message<?> result = interceptor.preSend(message, channel);

        assertNotNull(result);
        StompHeaderAccessor resultAccessor = MessageHeaderAccessor.getAccessor(result, StompHeaderAccessor.class);
        assertNotNull(resultAccessor);
        assertNull(resultAccessor.getUser());
    }

    @Test
    void nonConnectCommand_doesNotSetPrincipal() {
        Message<?> message = buildStompMessage(StompCommand.SEND, "some-token");

        Message<?> result = interceptor.preSend(message, channel);

        assertNotNull(result);
        StompHeaderAccessor resultAccessor = MessageHeaderAccessor.getAccessor(result, StompHeaderAccessor.class);
        assertNotNull(resultAccessor);
        assertNull(resultAccessor.getUser());
    }

    @Test
    void connect_withWrongSecret_noPrincipalSet() {
        String token = JWT.create()
                .withClaim("username", "alice")
                .withClaim("userId", "user-123")
                .sign(Algorithm.HMAC256("wrong-secret-that-is-also-256-bits-long"));

        Message<?> message = buildStompMessage(StompCommand.CONNECT, token);

        Message<?> result = interceptor.preSend(message, channel);

        assertNotNull(result);
        StompHeaderAccessor resultAccessor = MessageHeaderAccessor.getAccessor(result, StompHeaderAccessor.class);
        assertNotNull(resultAccessor);
        assertNull(resultAccessor.getUser());
    }

    @Test
    void stompPrincipal_getName_returnsUsername() {
        StompAuthInterceptor.StompPrincipal principal = new StompAuthInterceptor.StompPrincipal("alice", "user-123");

        assertEquals("alice", principal.getName());
        assertEquals("user-123", principal.getUserId());
    }
}
