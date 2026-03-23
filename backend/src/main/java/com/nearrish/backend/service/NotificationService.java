package com.nearrish.backend.service;

import com.nearrish.backend.entity.Notification;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.NotificationRepository;
import jakarta.transaction.Transactional;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;


@Service
public class NotificationService {
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationRepository notificationRepository;

    public NotificationService(SimpMessagingTemplate messagingTemplate,
                               NotificationRepository notificationRepository) {
        this.messagingTemplate = messagingTemplate;
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public void sendNotification(User recipient, String messageText) {
        Notification notification = new Notification(recipient, messageText);
        notificationRepository.save(notification);

        // 2. Use the USERNAME for the WebSocket PING
        // Because ApiAuthentication.getName() returns the Username,
        // Spring will find the connection mapped to this string.
        messagingTemplate.convertAndSendToUser(
                recipient.getUsername(),
                "/queue/notifications",
                "PING"
        );

        System.out.println("PING sent to user: " + recipient.getUsername());
    }
}
