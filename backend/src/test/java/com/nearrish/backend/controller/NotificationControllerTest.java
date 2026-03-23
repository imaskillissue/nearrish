package com.nearrish.backend.controller;

import com.auth0.jwt.interfaces.DecodedJWT;
import com.nearrish.backend.entity.Notification;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.NotificationRepository;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.security.ApiAuthentication;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password="
})
class NotificationControllerTest {

    @Autowired
    private NotificationController notificationController;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        // 1. Create and save a real user
        testUser = new User("testUser", "test@example.com", "password", "");
        userRepository.save(testUser);

        // 2. Mock the DecodedJWT object
        DecodedJWT mockedJwt = mock(DecodedJWT.class);

        // Tell the mock to return our testUser's ID when getSubject() is called
        // (Assuming your ApiAuthentication calls getSubject() to get the name/ID)
        when(mockedJwt.getSubject()).thenReturn(testUser.getId());

        // 3. Provide the mocked JWT to your ApiAuthentication
        ApiAuthentication auth = new ApiAuthentication(
                mockedJwt,
                testUser,
                Collections.emptyList()
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void tearDown() {
        notificationRepository.deleteAll();
        userRepository.deleteAll();
        SecurityContextHolder.clearContext();
    }

    @Test
    void testNotificationFlow() {
        // 1. Create the user
        User savedUser = userRepository.saveAndFlush(testUser);

        // 2. Create the notification linked to the PERSISTED user
        Notification note = new Notification(savedUser, "Someone liked your post!");
        notificationRepository.saveAndFlush(note);

        // 3. ACT: Retrieve via the Controller
        List<Notification> notifications = notificationController.getMyNotifications();

        // 4. ASSERT
        assertNotNull(notifications, "List should not be null");
        assertFalse(notifications.isEmpty(), "Should have 1 notification");


        assertEquals("Someone liked your post!", notifications.get(0).getContent(), "Content mismatch!");
        assertFalse(notifications.get(0).isRead(), "Notification should be unread initially");

        // 5. ACT: Mark as read
        notificationController.markAllAsRead();

        // 6. ASSERT: Check DB directly to confirm update
        List<Notification> finalCheck = notificationRepository.findByRecipientIdOrderByCreatedAt(savedUser.getId());
        assertTrue(finalCheck.get(0).isRead(), "Notification should be marked as read in DB");
    }
}