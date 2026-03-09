package com.nearrish.backend.controller;

import com.nearrish.backend.entity.Conversation;
import com.nearrish.backend.entity.Message;
import com.nearrish.backend.entity.User;
import com.nearrish.backend.security.ApiAuthentication;
import com.nearrish.backend.service.ChatService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/conversations")
    public List<Map<String, Object>> getConversations() {
        return chatService.getConversations(currentUser()).stream()
                .map(this::toConversationDto)
                .toList();
    }

    @PostMapping("/conversations/{userId}")
    public Map<String, Object> startConversation(@PathVariable String userId) {
        return toConversationDto(chatService.getOrCreateConversation(currentUser(), userId));
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public List<Map<String, Object>> getMessages(@PathVariable String conversationId) {
        return chatService.getMessages(currentUser(), conversationId).stream()
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

    private Map<String, Object> toConversationDto(Conversation c) {
        return Map.of(
                "id", c.getId(),
                "name", c.getName() != null ? c.getName() : "",
                "group", c.isGroup(),
                "participants", c.getParticipants().stream()
                        .map(u -> Map.of("id", u.getId(), "username", u.getUsername(), "email", u.getEmail()))
                        .toList(),
                "createdAt", c.getCreatedAt().toString()
        );
    }

    private Map<String, Object> toMessageDto(Message m) {
        return Map.of(
                "id", m.getId(),
                "conversationId", m.getConversation().getId(),
                "sender", Map.of("id", m.getSender().getId(), "username", m.getSender().getUsername(), "email", m.getSender().getEmail()),
                "content", m.getContent(),
                "read", m.isRead(),
                "createdAt", m.getCreatedAt().toString()
        );
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return ((ApiAuthentication) auth).getUser();
    }
}
