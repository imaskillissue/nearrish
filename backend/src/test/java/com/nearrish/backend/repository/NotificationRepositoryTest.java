package com.nearrish.backend.repository;

import com.nearrish.backend.entity.Notification;
import com.nearrish.backend.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1"
})
class NotificationRepositoryTest {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Test
    void shouldFindNotificationsByRecipientId() {
        User user = new User("mark", "mark@test.com", "pass", "");
        userRepository.save(user);

        Notification n = new Notification(user, "Test content");
        notificationRepository.save(n);

        List<Notification> results = notificationRepository.findByRecipientIdOrderByCreatedAt(user.getId());

        assertEquals(1, results.size());
        assertEquals("Test content", results.get(0).getContent());
    }
}