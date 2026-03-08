package com.nearrish.backend.service;

import com.nearrish.backend.entity.FriendRequest;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.FriendRequestRepository;
import com.nearrish.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class FriendRequestService {

    private final FriendRequestRepository friendRequestRepository;
    private final UserRepository userRepository;

    public FriendRequestService(FriendRequestRepository friendRequestRepository,
                                UserRepository userRepository) {
        this.friendRequestRepository = friendRequestRepository;
        this.userRepository = userRepository;
    }

    public FriendRequest sendRequest(User sender, String receiverId) {
        if (sender.getId().equals(receiverId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot send friend request to yourself");
        }

        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        boolean alreadyPending = friendRequestRepository
                .existsBySenderIdAndReceiverIdAndStatus(sender.getId(), receiverId, FriendRequest.Status.PENDING);
        if (alreadyPending) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Friend request already sent");
        }

        return friendRequestRepository.save(new FriendRequest(sender, receiver));
    }

    public FriendRequest acceptRequest(User currentUser, String requestId) {
        FriendRequest request = getRequestForReceiver(currentUser.getId(), requestId);
        request.setStatus(FriendRequest.Status.ACCEPTED);
        return friendRequestRepository.save(request);
    }

    public void declineRequest(User currentUser, String requestId) {
        FriendRequest request = getRequestForReceiver(currentUser.getId(), requestId);
        request.setStatus(FriendRequest.Status.DECLINED);
        friendRequestRepository.save(request);
    }

    public List<User> getFriends(User user) {
        return friendRequestRepository.findAcceptedFriendships(user.getId()).stream()
                .map(f -> f.getSender().getId().equals(user.getId()) ? f.getReceiver() : f.getSender())
                .toList();
    }

    public List<FriendRequest> getIncomingRequests(User user) {
        return friendRequestRepository.findByReceiverIdAndStatus(user.getId(), FriendRequest.Status.PENDING);
    }

    public List<FriendRequest> getOutgoingRequests(User user) {
        return friendRequestRepository.findBySenderIdAndStatus(user.getId(), FriendRequest.Status.PENDING);
    }

    private FriendRequest getRequestForReceiver(String userId, String requestId) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Friend request not found"));

        if (!request.getReceiver().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your friend request");
        }

        if (request.getStatus() != FriendRequest.Status.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request already handled");
        }

        return request;
    }
}
