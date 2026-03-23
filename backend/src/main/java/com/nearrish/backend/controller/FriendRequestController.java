package com.nearrish.backend.controller;

import com.nearrish.backend.entity.FriendRequest;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.security.ApiAuthentication;
import com.nearrish.backend.service.FriendRequestService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/friends")
public class FriendRequestController {

    private final FriendRequestService friendRequestService;

    public FriendRequestController(FriendRequestService friendRequestService) {
        this.friendRequestService = friendRequestService;
    }

    @PostMapping("/request/{userId}")
    public FriendRequest sendRequest(@PathVariable String userId) {
        return friendRequestService.sendRequest(currentUser(), userId);
    }

    /** Cancel an outgoing pending request (called by the sender). */
    @DeleteMapping("/request/{requestId}")
    public void cancelRequest(@PathVariable String requestId) {
        friendRequestService.cancelRequest(currentUser(), requestId);
    }

    @PostMapping("/accept/{requestId}")
    public FriendRequest acceptRequest(@PathVariable String requestId) {
        return friendRequestService.acceptRequest(currentUser(), requestId);
    }

    @PostMapping("/decline/{requestId}")
    public void declineRequest(@PathVariable String requestId) {
        friendRequestService.declineRequest(currentUser(), requestId);
    }

    /** Remove an existing friendship. */
    @DeleteMapping("/friend/{userId}")
    public void unfriend(@PathVariable String userId) {
        friendRequestService.unfriend(currentUser(), userId);
    }

    /** Check friendship status with a specific user: NONE | PENDING_SENT | PENDING_RECEIVED | FRIEND */
    @GetMapping("/status/{userId}")
    public Map<String, String> getFriendshipStatus(@PathVariable String userId) {
        return friendRequestService.getFriendshipStatus(currentUser(), userId);
    }

    @GetMapping
    public List<Map<String, String>> getFriends() {
        // Use HashMap (not Map.of) so null avatarUrl values are allowed
        return friendRequestService.getFriends(currentUser()).stream()
                .map(u -> {
                    Map<String, String> m = new HashMap<>();
                    m.put("id", u.getId());
                    m.put("username", u.getUsername());
                    m.put("avatarUrl", u.getAvatarUrl());
                    return m;
                })
                .toList();
    }

    @GetMapping("/requests/incoming")
    public List<FriendRequest> getIncomingRequests() {
        return friendRequestService.getIncomingRequests(currentUser());
    }

    @GetMapping("/requests/outgoing")
    public List<FriendRequest> getOutgoingRequests() {
        return friendRequestService.getOutgoingRequests(currentUser());
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return ((ApiAuthentication) auth).getUser();
    }
}
