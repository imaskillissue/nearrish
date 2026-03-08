package com.nearrish.backend.controller;

import com.nearrish.backend.entity.FriendRequest;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.security.ApiAuthentication;
import com.nearrish.backend.service.FriendRequestService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    @PostMapping("/accept/{requestId}")
    public FriendRequest acceptRequest(@PathVariable String requestId) {
        return friendRequestService.acceptRequest(currentUser(), requestId);
    }

    @PostMapping("/decline/{requestId}")
    public void declineRequest(@PathVariable String requestId) {
        friendRequestService.declineRequest(currentUser(), requestId);
    }

    @GetMapping
    public List<User> getFriends() {
        return friendRequestService.getFriends(currentUser());
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
