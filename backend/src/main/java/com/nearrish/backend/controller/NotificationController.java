package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Notification;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.NotificationRepository;
import com.nearrish.backend.security.ApiAuthentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

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
        ApiAuthentication auth = (ApiAuthentication) SecurityContextHolder.getContext().getAuthentication();
        assert auth != null;
        User user = (User) auth.getPrincipal();

        assert user != null;
        return notificationRepository.findByRecipientIdOrderByCreatedAt(user.getId());
    }

    @PostMapping("/{id}/read")
    public void markAsRead(@PathVariable String id) {
        notificationRepository.findById(id).ifPresent(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
    }
}
