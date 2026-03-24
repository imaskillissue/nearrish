package com.nearrish.backend.repository;

import com.nearrish.backend.entity.ConversationReadState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConversationReadStateRepository extends JpaRepository<ConversationReadState, String> {

    Optional<ConversationReadState> findByConversationIdAndUserId(String conversationId, String userId);

    void deleteByConversationId(String conversationId);
}
