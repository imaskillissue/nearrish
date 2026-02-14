package com.example.demo;

import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private final UserRepository userRepository;

    public DataSeeder(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("Users already seeded, skipping");
            return;
        }

        log.info("Seeding mock users...");
        userRepository.save(new User("juan", "Juan Son"));
        userRepository.save(new User("sonova", "Sonova Bitsh"));
        userRepository.save(new User("bas", "Bas Tard"));
        log.info("Seeded 3 mock users");
    }
}
