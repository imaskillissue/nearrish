package com.nearrish.backend.controller;

import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.FriendRequestRepository;
import com.nearrish.backend.repository.UserRepository;
import com.nearrish.backend.service.OnlineStatusService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/public/users")
public class UserController {

    private final UserRepository userRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final OnlineStatusService onlineStatusService;

    public UserController(UserRepository userRepository, FriendRequestRepository friendRequestRepository, OnlineStatusService onlineStatusService) {
        this.userRepository = userRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.onlineStatusService = onlineStatusService;
    }

    /** Returns the set of user IDs that are currently connected via WebSocket. */
    @GetMapping("/online")
    public Set<String> getOnlineUsers() {
        return onlineStatusService.getOnlineUsers();
    }

    /** Returns all users (id, username, avatarUrl) — used by the friends page to discover new users. */
    @GetMapping
    public List<Map<String, String>> listUsers() {
        return userRepository.findAll().stream()
                .map(u -> {
                    Map<String, String> m = new HashMap<>();
                    m.put("id", u.getId());
                    m.put("username", u.getUsername());
                    m.put("avatarUrl", u.getAvatarUrl());
                    return m;
                })
                .toList();
    }

    @GetMapping("/{id}")
    public Map<String, String> getPublicProfile(@PathVariable String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        Map<String, String> result = new HashMap<>();
        result.put("id", user.getId());
        result.put("username", user.getUsername());
        result.put("name", user.getName());
        result.put("nickname", user.getNickname());
        result.put("address", user.getAddress());
        result.put("avatarUrl", user.getAvatarUrl());
        result.put("email", user.getEmail());
        return result;
    }

    @GetMapping("/{id}/friend-count")
    public Map<String, Integer> getFriendCount(@PathVariable String id) {
        if (!userRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
        int count = friendRequestRepository.findAcceptedFriendships(id).size();
        return Map.of("count", count);
    }
}
