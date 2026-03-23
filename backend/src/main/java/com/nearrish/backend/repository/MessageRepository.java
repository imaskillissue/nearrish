package com.nearrish.backend.repository;

import com.nearrish.backend.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends JpaRepository<Message, String> {

    List<Message> findByConversationIdOrderByCreatedAt(String conversationId);

    List<Message> findByConversationIdOrderByCreatedAtDesc(String conversationId, Pageable pageable);

    @Query("SELECT m FROM Message m WHERE m.conversation.id = :conversationId AND m.createdAt < :before ORDER BY m.createdAt DESC")
    List<Message> findBeforeCursor(@Param("conversationId") String conversationId, @Param("before") LocalDateTime before, Pageable pageable);

    Optional<Message> findTopByConversationIdOrderByCreatedAtDesc(String conversationId);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.conversation.id = :conversationId AND m.sender.id <> :userId AND m.isRead = false")
    long countUnread(String conversationId, String userId);

    @Modifying
    @Query("UPDATE Message m SET m.isRead = true WHERE m.conversation.id = :conversationId AND m.sender.id <> :userId AND m.isRead = false")
    int markAsRead(String conversationId, String userId);

    List<Message> findBySender_Id(String senderId);
}
