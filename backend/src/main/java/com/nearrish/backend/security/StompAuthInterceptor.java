package com.nearrish.backend.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;

@Component
public class StompAuthInterceptor implements ChannelInterceptor {

    @Value("${jwt.secret}")
    private String secret;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = accessor.getFirstNativeHeader("AUTH");
            if (token != null) {
                try {
                    DecodedJWT decoded = JWT.require(Algorithm.HMAC256(secret))
                            .build().verify(token);
                    String username = decoded.getClaim("username").asString();
                    String userId = decoded.getClaim("userId").asString();
                    accessor.setUser(new StompPrincipal(username, userId));
                } catch (Exception e) {
                    // Invalid token — connection will proceed without a Principal,
                    // so user-targeted messages won't be delivered.
                }
            }
        }
        return message;
    }

    public static class StompPrincipal implements Principal {
        private final String name;
        private final String userId;

        public StompPrincipal(String name, String userId) {
            this.name = name;
            this.userId = userId;
        }

        @Override
        public String getName() {
            return name;
        }

        public String getUserId() {
            return userId;
        }
    }
}
