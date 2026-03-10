package com.nearrish.backend.repository;

import com.nearrish.backend.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, String> {

    List<Message> findByConversationIdOrderByCreatedAt(String conversationId);

    @Modifying
    @Query("UPDATE Message m SET m.isRead = true WHERE m.conversation.id = :conversationId AND m.sender.id <> :userId AND m.isRead = false")
    int markAsRead(String conversationId, String userId);
}
