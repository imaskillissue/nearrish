package com.nearrish.backend.service;

import com.nearrish.backend.entity.User;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;


@Service
public class NotificationService {
    private final SimpMessagingTemplate messagingTemplate;

    public NotificationService(SimpMessagingTemplate messagingTemplate) {
     this.messagingTemplate = messagingTemplate;
    }

    public void sendPrivateSignal(User recipient) {
        String userId = recipient.getId();
        System.out.println("UserId is: " + userId);

        messagingTemplate.convertAndSendToUser(
                userId,
                "/queue/notifications",
                "PING"
        );
    }
}
