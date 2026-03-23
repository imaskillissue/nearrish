package com.nearrish.backend.service;

import com.nearrish.backend.security.StompAuthInterceptor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OnlineStatusService {

    private final Set<String> onlineUsers = ConcurrentHashMap.newKeySet();
    private final SimpMessagingTemplate messagingTemplate;

    public OnlineStatusService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void handleConnect(SessionConnectEvent event) {
        Principal principal = event.getUser();
        if (principal instanceof StompAuthInterceptor.StompPrincipal sp) {
            onlineUsers.add(sp.getUserId());
            messagingTemplate.convertAndSend("/topic/online",
                    (Object) Map.of("userId", sp.getUserId(), "status", "ONLINE"));
        }
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        Principal principal = event.getUser();
        if (principal instanceof StompAuthInterceptor.StompPrincipal sp) {
            onlineUsers.remove(sp.getUserId());
            messagingTemplate.convertAndSend("/topic/online",
                    (Object) Map.of("userId", sp.getUserId(), "status", "OFFLINE"));
        }
    }

    public Set<String> getOnlineUsers() {
        return Set.copyOf(onlineUsers);
    }

    public boolean isOnline(String userId) {
        return onlineUsers.contains(userId);
    }
}
