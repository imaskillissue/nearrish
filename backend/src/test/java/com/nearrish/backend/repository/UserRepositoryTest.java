package com.nearrish.backend.repository;

import com.nearrish.backend.entity.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;


@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password="
})
class UserRepositoryTest {
    @Autowired
    private UserRepository userRepository;
    private User user;

    @BeforeEach
    void setUp() {
        user = new User("TomatenMark", "mark@mag.tomaten", "password", "");
        userRepository.save(user);

    }

    @AfterEach
    void tearDown() {
        userRepository.deleteAll();
    }

    @Test
    void getByIdAndUsername() {
        User result = userRepository.getByIdAndUsername(user.getId(), user.getUsername());
        assertTrue(result != null && result.getId().equals(user.getId()) && result.getUsername().equals(user.getUsername()));
    }

    @Test
    void getByEmailOrUsername() {
    	User result = userRepository.getByEmailOrUsername(user.getEmail(), user.getUsername());
        assertTrue(result != null && (result.getEmail().equals(user.getEmail()) || result.getUsername().equals(user.getUsername())));
    }

    @Test
    void existsByEmail() {
        assertTrue(userRepository.existsByEmail(user.getEmail()));
    }

    @Test
    void existsByUsername() {
        assertTrue(userRepository.existsByUsername(user.getUsername()));
    }
}