package com.example.demo.controller;

import com.example.demo.dto.ChatMessageResponse;
import com.example.demo.dto.CreateChatRequest;
import com.example.demo.dto.ModerationResult;
import com.example.demo.model.ChatMessage;
import com.example.demo.repository.ChatMessageRepository;
import com.example.demo.service.ModerationService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "*")
public class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);
    private final ChatMessageRepository chatMessageRepository;
    private final ModerationService moderationService;

    public ChatController(ChatMessageRepository chatMessageRepository, ModerationService moderationService) {
        this.chatMessageRepository = chatMessageRepository;
        this.moderationService = moderationService;
    }

    @PostMapping
    public ResponseEntity<?> sendMessage(@Valid @RequestBody CreateChatRequest request) {
        ModerationResult moderation = moderationService.moderate(
                request.content(), request.senderUsername(), "chat");

        log.info("Chat moderation: severity={}, category={}", moderation.severity(), moderation.category());

        if (moderation.blocked()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "Message blocked by moderation",
                    "category", moderation.category(),
                    "reason", moderation.reason()
            ));
        }

        ChatMessage message = new ChatMessage(
                request.content(),
                request.senderUsername(),
                moderation.severity(),
                moderation.category()
        );
        message = chatMessageRepository.save(message);

        return ResponseEntity.status(HttpStatus.CREATED).body(ChatMessageResponse.from(message));
    }

    @GetMapping
    public List<ChatMessageResponse> getRecentMessages() {
        List<ChatMessageResponse> messages = new ArrayList<>(chatMessageRepository.findTop50ByOrderByCreatedAtDesc()
                .stream()
                .map(ChatMessageResponse::from)
                .toList());
        Collections.reverse(messages);
        return messages;
    }
}
