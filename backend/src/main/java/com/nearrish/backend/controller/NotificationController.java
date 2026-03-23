package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Notification;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.NotificationRepository;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.security.ApiAuthentication;
import com.nearrish.backend.service.NotificationService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public NotificationController(NotificationRepository notificationRepository,
                                  NotificationService notificationService,
                                  UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    @PostMapping("/send")
    public void send(@RequestParam String recipientId, @RequestParam String message) {
        User recipient = userRepository.findById(recipientId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        notificationService.sendNotification(recipient, message);
    }

    @GetMapping
    public List<Notification> getMyNotifications() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth instanceof ApiAuthentication apiAuth) {
            String userId = apiAuth.getUserId();
            System.out.println("DEBUG: Fetching notifications for UUID: " + userId);
            return notificationRepository.findByRecipientIdOrderByCreatedAt(userId);
        }

        return Collections.emptyList();
    }

    @PostMapping("/read")
    public void markAllAsRead() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth instanceof ApiAuthentication apiAuth) {
            String userId = apiAuth.getUserId();
            notificationRepository.markAllAsReadForUser(userId);
        }
    }
}

