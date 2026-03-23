package com.nearrish.backend.controller;

import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.security.ApiAuthentication;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.security.crypto.scrypt.SCryptPasswordEncoder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Authenticated /api/users/me endpoints.
 * All routes require a valid JWT (not in shouldNotFilter, so auth is enforced).
 */
@RestController
@RequestMapping("/api/users/me")
public class MeController {

    private final UserRepository userRepository;

    public MeController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** GET /api/users/me — return own profile including avatarUrl */
    @GetMapping
    public Map<String, String> getMe() {
        User user = currentUser();
        Map<String, String> result = new HashMap<>();
        result.put("id", user.getId());
        result.put("username", user.getUsername());
        result.put("email", user.getEmail());
        result.put("name", user.getName());
        result.put("nickname", user.getNickname());
        result.put("address", user.getAddress());
        result.put("avatarUrl", user.getAvatarUrl());
        return result;
    }

    /** PATCH /api/users/me — update name, nickname, address */
    @PatchMapping
    public Map<String, String> updateMe(@RequestBody Map<String, String> body) {
        User user = currentUser();
        if (body.containsKey("name"))     user.setName(body.get("name"));
        if (body.containsKey("nickname")) user.setNickname(body.get("nickname"));
        if (body.containsKey("address"))  user.setAddress(body.get("address"));
        userRepository.save(user);
        Map<String, String> result = new HashMap<>();
        result.put("id", user.getId());
        result.put("username", user.getUsername());
        result.put("email", user.getEmail());
        result.put("name", user.getName());
        result.put("nickname", user.getNickname());
        result.put("address", user.getAddress());
        result.put("avatarUrl", user.getAvatarUrl());
        return result;
    }

    /** POST /api/users/me/avatar — upload a profile picture */
    @PostMapping("/avatar")
    public Map<String, String> uploadAvatar(@RequestParam("file") MultipartFile file) throws IOException {
        String filename = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path uploadDir = Paths.get("/app/uploads");
        Files.createDirectories(uploadDir);
        Files.copy(file.getInputStream(), uploadDir.resolve(filename));

        String url = "/uploads/" + filename;
        User user = currentUser();
        user.setAvatarUrl(url);
        userRepository.save(user);

        return Map.of("avatarUrl", url);
    }

    /** PATCH /api/users/me/password — change own password */
    @PatchMapping("/password")
    public org.springframework.http.ResponseEntity<Map<String, String>> changePassword(
            @RequestBody Map<String, String> body) {
        String currentPw = body.get("currentPassword");
        String newPw     = body.get("newPassword");
        if (currentPw == null || newPw == null || newPw.length() < 8) {
            return org.springframework.http.ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid request"));
        }
        User user = currentUser();
        if (!user.checkPassword(currentPw)) {
            return org.springframework.http.ResponseEntity.status(403)
                    .body(Map.of("error", "Current password is incorrect"));
        }
        String hash = SCryptPasswordEncoder.defaultsForSpringSecurity_v5_8().encode(newPw);
        user.setPasswordHash(hash);
        userRepository.save(user);
        return org.springframework.http.ResponseEntity.ok(Map.of("status", "ok"));
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return ((ApiAuthentication) auth).getUser();
    }
}
