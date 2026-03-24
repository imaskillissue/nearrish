package com.nearrish.backend.service;

import com.nearrish.backend.entity.Conversation;
import com.nearrish.backend.entity.ConversationReadState;
import com.nearrish.backend.entity.Message;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.BlockRepository;
import com.nearrish.backend.repository.ConversationReadStateRepository;
import com.nearrish.backend.repository.ConversationRepository;
import com.nearrish.backend.repository.MessageRepository;
import com.nearrish.backend.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@Service
public class ChatService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final BlockRepository blockRepository;
    private final ConversationReadStateRepository readStateRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ModerationClient moderationClient;

    public ChatService(ConversationRepository conversationRepository,
                       MessageRepository messageRepository,
                       UserRepository userRepository,
                       BlockRepository blockRepository,
                       ConversationReadStateRepository readStateRepository,
                       SimpMessagingTemplate messagingTemplate,
                       ModerationClient moderationClient) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.blockRepository = blockRepository;
        this.readStateRepository = readStateRepository;
        this.messagingTemplate = messagingTemplate;
        this.moderationClient = moderationClient;
    }

    @Transactional
    public Conversation getOrCreateConversation(User currentUser, String otherUserId) {
        if (currentUser.getId().equals(otherUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot start a conversation with yourself");
        }

        User other = userRepository.findById(otherUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (isBlockedInEitherDirection(currentUser.getId(), otherUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot start a conversation with this user");
        }

        return conversationRepository
                .findByTwoParticipants(currentUser.getId(), otherUserId)
                .orElseGet(() -> conversationRepository.save(new Conversation(currentUser, other)));
    }

    public List<Conversation> getConversations(User user) {
        return conversationRepository.findByParticipantId(user.getId());
    }

    @Transactional
    public Message sendMessage(User sender, String conversationId, String content) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        boolean isMember = conversation.getParticipants().stream()
                .anyMatch(p -> p.getId().equals(sender.getId()));
        if (!isMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not part of this conversation");
        }

        if (!conversation.isGroup()) {
            conversation.getParticipants().stream()
                    .filter(p -> !p.getId().equals(sender.getId()))
                    .forEach(recipient -> {
                        if (isBlockedInEitherDirection(sender.getId(), recipient.getId())) {
                            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot send messages to this user");
                        }
                    });
        }

        // Build recent history for context-aware moderation (last 10 messages)
        var history = messageRepository
                .findByConversationIdOrderByCreatedAtDesc(conversationId, org.springframework.data.domain.PageRequest.of(0, 10))
                .stream()
                .map(m -> new ModerationClient.ChatMessage(m.getSender().getUsername(), m.getContent(), m.isModerated()))
                .toList();

        Message message = messageRepository.save(new Message(conversation, sender, content));
        String messageId = message.getId();
        String senderUsername = sender.getUsername();

        // Capture all participant usernames before leaving the transactional context
        List<String> recipientUsernames = conversation.getParticipants().stream()
                .filter(p -> !p.getId().equals(sender.getId()))
                .map(User::getUsername)
                .toList();

        recipientUsernames.forEach(username -> messagingTemplate.convertAndSendToUser(
                username, "/queue/chat", conversationId + ":" + messageId
        ));

        // Moderate after transaction commits so the delete can find the row
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                CompletableFuture.runAsync(() -> {
                    ModerationClient.Result mod = moderationClient.moderateChat(content, senderUsername, history);
                    if (mod.isBlocked()) {
                        String reason = mod.reason() != null ? mod.reason() : "Message removed by moderation";
                        messageRepository.findById(messageId).ifPresent(msg -> {
                            msg.setModerated(true);
                            msg.setModerationReason(reason);
                            messageRepository.save(msg);
                        });
                        // All participants see the reason
                        String removedMsg = "REMOVED:" + messageId + ":" + reason;
                        messagingTemplate.convertAndSendToUser(
                                senderUsername, "/queue/chat", removedMsg
                        );
                        recipientUsernames.forEach(username -> messagingTemplate.convertAndSendToUser(
                                username, "/queue/chat", removedMsg
                        ));
                    }
                });
            }
        });

        return message;
    }

    @Transactional
    public List<Message> getMessages(User user, String conversationId, int limit, java.time.LocalDateTime before) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        boolean isMember = conversation.getParticipants().stream()
                .anyMatch(p -> p.getId().equals(user.getId()));
        if (!isMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not part of this conversation");
        }

        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(0, limit);
        List<Message> msgs = before != null
                ? messageRepository.findBeforeCursor(conversationId, before, pageable)
                : messageRepository.findByConversationIdOrderByCreatedAtDesc(conversationId, pageable);
        java.util.Collections.reverse(msgs);
        return msgs;
    }

    @Transactional
    public Conversation createGroupConversation(User creator, String name, List<String> memberIds) {
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Group name is required");
        }
        if (memberIds == null || memberIds.size() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A group chat requires at least 2 other members");
        }

        Set<User> participants = new HashSet<>();
        participants.add(creator);

        for (String memberId : memberIds) {
            if (memberId.equals(creator.getId())) continue;
            User member = userRepository.findById(memberId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + memberId));
            participants.add(member);
        }

        if (participants.size() < 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A group chat requires at least 3 participants");
        }

        return conversationRepository.save(new Conversation(name, participants));
    }

    @Transactional
    public Conversation addGroupMember(User currentUser, String conversationId, String userId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        if (!conversation.isGroup()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot add members to a direct conversation");
        }

        boolean isMember = conversation.getParticipants().stream()
                .anyMatch(p -> p.getId().equals(currentUser.getId()));
        if (!isMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not part of this conversation");
        }

        boolean alreadyMember = conversation.getParticipants().stream()
                .anyMatch(p -> p.getId().equals(userId));
        if (alreadyMember) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User is already a member");
        }

        User newMember = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        conversation.getParticipants().add(newMember);
        return conversationRepository.save(conversation);
    }

    @Transactional
    public Conversation removeGroupMember(User currentUser, String conversationId, String userId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        if (!conversation.isGroup()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot remove members from a direct conversation");
        }

        boolean isMember = conversation.getParticipants().stream()
                .anyMatch(p -> p.getId().equals(currentUser.getId()));
        if (!isMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not part of this conversation");
        }

        boolean targetIsMember = conversation.getParticipants().stream()
                .anyMatch(p -> p.getId().equals(userId));
        if (!targetIsMember) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not a member of this conversation");
        }

        conversation.getParticipants().removeIf(p -> p.getId().equals(userId));
        return conversationRepository.save(conversation);
    }

    @Transactional
    public Conversation leaveGroupConversation(User currentUser, String conversationId) {
        return removeGroupMember(currentUser, conversationId, currentUser.getId());
    }

    @Transactional
    public Conversation renameGroupConversation(User currentUser, String conversationId, String newName) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        if (!conversation.isGroup()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot rename a direct conversation");
        }

        boolean isMember = conversation.getParticipants().stream()
                .anyMatch(p -> p.getId().equals(currentUser.getId()));
        if (!isMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not part of this conversation");
        }

        if (newName == null || newName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Group name is required");
        }

        conversation.setName(newName);
        return conversationRepository.save(conversation);
    }

    @Transactional
    public void markAsRead(User user, String conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        boolean isMember = conversation.getParticipants().stream()
                .anyMatch(p -> p.getId().equals(user.getId()));
        if (!isMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not part of this conversation");
        }

        // Update per-message isRead flag (for DM read-receipt checkmarks)
        messageRepository.markAsRead(conversationId, user.getId());

        // Upsert per-user last-read timestamp (used for accurate per-user unread counts)
        ConversationReadState readState = readStateRepository
                .findByConversationIdAndUserId(conversationId, user.getId())
                .orElse(new ConversationReadState(conversationId, user.getId(), java.time.LocalDateTime.now()));
        readState.setLastReadAt(java.time.LocalDateTime.now());
        readStateRepository.save(readState);

        // Notify other participants so their read receipts update in real-time
        conversation.getParticipants().stream()
                .filter(p -> !p.getId().equals(user.getId()))
                .forEach(p -> messagingTemplate.convertAndSendToUser(
                        p.getUsername(),
                        "/queue/chat",
                        "READ:" + conversationId
                ));
    }

    private boolean isBlockedInEitherDirection(String userAId, String userBId) {
        return blockRepository.existsByBlockerIdAndBlockedId(userAId, userBId) ||
               blockRepository.existsByBlockerIdAndBlockedId(userBId, userAId);
    }
}
