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

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/conversations")
    public List<Conversation> getConversations() {
        return chatService.getConversations(currentUser());
    }

    @PostMapping("/conversations/{userId}")
    public Conversation startConversation(@PathVariable String userId) {
        return chatService.getOrCreateConversation(currentUser(), userId);
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public List<Message> getMessages(@PathVariable String conversationId) {
        return chatService.getMessages(currentUser(), conversationId);
    }

    @PostMapping("/conversations/group")
    public Conversation createGroupConversation(@RequestParam String name, @RequestParam List<String> memberIds) {
        return chatService.createGroupConversation(currentUser(), name, memberIds);
    }

    @PostMapping("/conversations/{conversationId}/members/{userId}")
    public Conversation addGroupMember(@PathVariable String conversationId, @PathVariable String userId) {
        return chatService.addGroupMember(currentUser(), conversationId, userId);
    }

    @DeleteMapping("/conversations/{conversationId}/members/{userId}")
    public Conversation removeGroupMember(@PathVariable String conversationId, @PathVariable String userId) {
        return chatService.removeGroupMember(currentUser(), conversationId, userId);
    }

    @PostMapping("/conversations/{conversationId}/leave")
    public Conversation leaveGroupConversation(@PathVariable String conversationId) {
        return chatService.leaveGroupConversation(currentUser(), conversationId);
    }

    @PutMapping("/conversations/{conversationId}/name")
    public Conversation renameGroupConversation(@PathVariable String conversationId, @RequestParam String name) {
        return chatService.renameGroupConversation(currentUser(), conversationId, name);
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public Message sendMessage(@PathVariable String conversationId, @RequestParam String content) {
        return chatService.sendMessage(currentUser(), conversationId, content);
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return ((ApiAuthentication) auth).getUser();
    }
}
