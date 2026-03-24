package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Conversation;
import com.nearrish.backend.entity.Message;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.repository.ConversationReadStateRepository;
import com.nearrish.backend.repository.MessageRepository;
import com.nearrish.backend.security.ApiAuthentication;
import com.nearrish.backend.service.ChatService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;
    private final MessageRepository messageRepository;
    private final ConversationReadStateRepository readStateRepository;

    public ChatController(ChatService chatService, MessageRepository messageRepository,
                          ConversationReadStateRepository readStateRepository) {
        this.chatService = chatService;
        this.messageRepository = messageRepository;
        this.readStateRepository = readStateRepository;
    }

    @GetMapping("/conversations")
    public List<Map<String, Object>> getConversations() {
        User me = currentUser();
        return chatService.getConversations(me).stream()
                .map(c -> {
                    Map<String, Object> dto = new HashMap<>(toConversationDto(c));
                    var last = messageRepository.findTopByConversationIdOrderByCreatedAtDesc(c.getId());
                    dto.put("lastMessage", last.map(this::toMessageDto).orElse(null));
                    java.time.LocalDateTime lastReadAt = readStateRepository
                            .findByConversationIdAndUserId(c.getId(), me.getId())
                            .map(rs -> rs.getLastReadAt())
                            .orElse(java.time.LocalDateTime.of(2000, 1, 1, 0, 0));
                    dto.put("unreadCount", messageRepository.countUnreadSince(c.getId(), me.getId(), lastReadAt));
                    return dto;
                })
                .toList();
    }

    @PostMapping("/conversations/{userId}")
    public Map<String, Object> startConversation(@PathVariable String userId) {
        return toConversationDto(chatService.getOrCreateConversation(currentUser(), userId));
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public List<Map<String, Object>> getMessages(
            @PathVariable String conversationId,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String before) {
        java.time.LocalDateTime beforeDt = before != null
                ? java.time.LocalDateTime.parse(before)
                : null;
        return chatService.getMessages(currentUser(), conversationId, limit, beforeDt).stream()
                .map(this::toMessageDto)
                .toList();
    }

    @PostMapping("/conversations/group")
    public Map<String, Object> createGroupConversation(@RequestParam String name, @RequestParam List<String> memberIds) {
        return toConversationDto(chatService.createGroupConversation(currentUser(), name, memberIds));
    }

    @PostMapping("/conversations/{conversationId}/members/{userId}")
    public Map<String, Object> addGroupMember(@PathVariable String conversationId, @PathVariable String userId) {
        return toConversationDto(chatService.addGroupMember(currentUser(), conversationId, userId));
    }

    @DeleteMapping("/conversations/{conversationId}/members/{userId}")
    public Map<String, Object> removeGroupMember(@PathVariable String conversationId, @PathVariable String userId) {
        return toConversationDto(chatService.removeGroupMember(currentUser(), conversationId, userId));
    }

    @PostMapping("/conversations/{conversationId}/leave")
    public Map<String, Object> leaveGroupConversation(@PathVariable String conversationId) {
        return toConversationDto(chatService.leaveGroupConversation(currentUser(), conversationId));
    }

    @PutMapping("/conversations/{conversationId}/name")
    public Map<String, Object> renameGroupConversation(@PathVariable String conversationId, @RequestParam String name) {
        return toConversationDto(chatService.renameGroupConversation(currentUser(), conversationId, name));
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public Map<String, Object> sendMessage(@PathVariable String conversationId, @RequestParam String content) {
        return toMessageDto(chatService.sendMessage(currentUser(), conversationId, content));
    }

    @PostMapping("/conversations/{conversationId}/read")
    public void markAsRead(@PathVariable String conversationId) {
        chatService.markAsRead(currentUser(), conversationId);
    }

    private Map<String, Object> toConversationDto(Conversation c) {
        return Map.of(
                "id", c.getId(),
                "name", c.getName() != null ? c.getName() : "",
                "group", c.isGroup(),
                "participants", c.getParticipants().stream()
                        .map(u -> {
                            java.util.Map<String, Object> m = new java.util.HashMap<>();
                            m.put("id", u.getId());
                            m.put("username", u.getUsername());
                            m.put("email", u.getEmail());
                            m.put("avatarUrl", u.getAvatarUrl());
                            return m;
                        })
                        .toList(),
                "createdAt", c.getCreatedAt().toString()
        );
    }

    private Map<String, Object> toMessageDto(Message m) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", m.getId());
        dto.put("conversationId", m.getConversation().getId());
        dto.put("sender", Map.of("id", m.getSender().getId(), "username", m.getSender().getUsername(), "email", m.getSender().getEmail()));
        dto.put("content", m.getContent());
        dto.put("read", m.isRead());
        dto.put("createdAt", m.getCreatedAt().toString());
        dto.put("moderated", m.isModerated());
        dto.put("moderationReason", m.getModerationReason());
        return dto;
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return ((ApiAuthentication) auth).getUser();
    }
}
