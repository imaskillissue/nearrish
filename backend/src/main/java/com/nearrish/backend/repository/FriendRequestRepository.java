package com.nearrish.backend.repository;

import com.nearrish.backend.entity.FriendRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendRequestRepository extends JpaRepository<FriendRequest, String> {

    Optional<FriendRequest> findBySenderIdAndReceiverId(String senderId, String receiverId);

    List<FriendRequest> findByReceiverIdAndStatus(String receiverId, FriendRequest.Status status);

    List<FriendRequest> findBySenderIdAndStatus(String senderId, FriendRequest.Status status);

    @Query("SELECT f FROM FriendRequest f WHERE (f.sender.id = :userId OR f.receiver.id = :userId) AND f.status = 'ACCEPTED'")
    List<FriendRequest> findAcceptedFriendships(String userId);

    boolean existsBySenderIdAndReceiverIdAndStatus(String senderId, String receiverId, FriendRequest.Status status);
}
