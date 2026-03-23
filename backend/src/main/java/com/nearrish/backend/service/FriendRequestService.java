package com.nearrish.backend.service;

import com.nearrish.backend.entity.FriendRequest;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.FriendRequestRepository;
import com.nearrish.backend.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
public class FriendRequestService {

    private final FriendRequestRepository friendRequestRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public FriendRequestService(FriendRequestRepository friendRequestRepository,
                                UserRepository userRepository,
                                SimpMessagingTemplate messagingTemplate) {
        this.friendRequestRepository = friendRequestRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
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

        FriendRequest saved = friendRequestRepository.save(new FriendRequest(sender, receiver));
        messagingTemplate.convertAndSendToUser(
                receiver.getUsername(), "/queue/friends",
                Map.of("type", "REQUEST_RECEIVED", "fromUserId", sender.getId(), "requestId", saved.getId()));
        return saved;
    }

    @Transactional
    public FriendRequest acceptRequest(User currentUser, String requestId) {
        FriendRequest request = getRequestForReceiver(currentUser.getId(), requestId);
        request.setStatus(FriendRequest.Status.ACCEPTED);
        FriendRequest saved = friendRequestRepository.save(request);
        messagingTemplate.convertAndSendToUser(
                request.getSender().getUsername(), "/queue/friends",
                Map.of("type", "REQUEST_ACCEPTED", "byUserId", currentUser.getId()));
        return saved;
    }

    @Transactional
    public void declineRequest(User currentUser, String requestId) {
        FriendRequest request = getRequestForReceiver(currentUser.getId(), requestId);
        request.setStatus(FriendRequest.Status.DECLINED);
        friendRequestRepository.save(request);
        messagingTemplate.convertAndSendToUser(
                request.getSender().getUsername(), "/queue/friends",
                Map.of("type", "REQUEST_DECLINED", "byUserId", currentUser.getId()));
    }

    @Transactional
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

    @Transactional
    public void cancelRequest(User sender, String requestId) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        if (!request.getSender().getId().equals(sender.getId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your request");
        if (request.getStatus() != FriendRequest.Status.PENDING)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is not pending");
        String receiverUsername = request.getReceiver().getUsername();
        friendRequestRepository.delete(request);
        messagingTemplate.convertAndSendToUser(
                receiverUsername, "/queue/friends",
                Map.of("type", "REQUEST_CANCELLED", "byUserId", sender.getId()));
    }

    @Transactional
    public void unfriend(User user, String friendUserId) {
        FriendRequest friendship = friendRequestRepository.findAcceptedFriendships(user.getId()).stream()
                .filter(f -> f.getSender().getId().equals(friendUserId) || f.getReceiver().getId().equals(friendUserId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No friendship found"));
        User otherUser = friendship.getSender().getId().equals(user.getId())
                ? friendship.getReceiver() : friendship.getSender();
        friendRequestRepository.delete(friendship);
        messagingTemplate.convertAndSendToUser(
                otherUser.getUsername(), "/queue/friends",
                Map.of("type", "UNFRIENDED", "byUserId", user.getId()));
    }

    public Map<String, String> getFriendshipStatus(User currentUser, String targetUserId) {
        boolean isFriend = friendRequestRepository.findAcceptedFriendships(currentUser.getId()).stream()
                .anyMatch(f -> f.getSender().getId().equals(targetUserId) || f.getReceiver().getId().equals(targetUserId));
        if (isFriend) return Map.of("status", "FRIEND");

        if (friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(
                currentUser.getId(), targetUserId, FriendRequest.Status.PENDING))
            return Map.of("status", "PENDING_SENT");

        if (friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(
                targetUserId, currentUser.getId(), FriendRequest.Status.PENDING))
            return Map.of("status", "PENDING_RECEIVED");

        return Map.of("status", "NONE");
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
