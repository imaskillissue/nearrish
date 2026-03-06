package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Notification;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.NotificationRepository;
import com.nearrish.backend.security.ApiAuthentication;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository notificationRepository;

    public NotificationController(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @GetMapping
    public List<Notification> getMyNotifications() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        String userId = (auth != null) ? auth.getName() : null;

        if (userId == null) {
            return Collections.emptyList();
        }

        return notificationRepository.findByRecipientIdOrderByCreatedAt(userId);
    }

    @PostMapping("/read")
    public void markAllAsRead() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // The Principal in your setup is likely the User ID (String) or the JWT object
        // Get the Name/ID directly from the auth object
        assert auth != null;
        String userId = auth.getName();

        if (userId != null) {
            notificationRepository.markAllAsReadForUser(userId);
        }
    }
}

