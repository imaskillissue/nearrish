package com.nearrish.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

@Service
public class ModerationClient {

    private static final Logger log = LoggerFactory.getLogger(ModerationClient.class);

    @Value("${MODERATION_ENABLED:true}")
    private boolean enabled;

    private final String baseUrl;
    private final HttpClient http = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .build();
    private final ObjectMapper mapper = new ObjectMapper();

    public ModerationClient(@Value("${MODERATION_URL:http://moderation-service:8001}") String baseUrl) {
        this.baseUrl = baseUrl;
    }

    // ── Result ─────────────────────────────────────────────────────────────────

    public record Result(String category, String action, int severity, String reason,
                         boolean isBlocked, boolean isWarned, boolean isEscalated) {
        static Result allow() {
            return new Result("clean", "allow", 0, null, false, false, false);
        }
    }

    public record ChatMessage(String username, String text) {}

    // ── Public API ─────────────────────────────────────────────────────────────

    public Result moderateText(String content) {
        if (!enabled) return Result.allow();
        try {
            return call("/moderate", Map.of("content", content, "content_type", "post"));
        } catch (Exception e) {
            log.warn("Moderation service unavailable (text): {}", e.getMessage());
            return Result.allow();
        }
    }

    public Result moderateComment(String content) {
        if (!enabled) return Result.allow();
        try {
            return call("/moderate", Map.of("content", content, "content_type", "comment"));
        } catch (Exception e) {
            log.warn("Moderation service unavailable (comment): {}", e.getMessage());
            return Result.allow();
        }
    }

    public Result moderateUsername(String username) {
        if (!enabled) return Result.allow();
        try {
            return call("/moderate/username", Map.of("username", username));
        } catch (Exception e) {
            log.warn("Moderation service unavailable (username): {}", e.getMessage());
            return Result.allow();
        }
    }

    public Result moderateChat(String message, String senderUsername, List<ChatMessage> history) {
        if (!enabled) return Result.allow();
        try {
            return call("/moderate/chat", Map.of(
                    "message", message,
                    "username", senderUsername,
                    "history", history
            ));
        } catch (Exception e) {
            log.warn("Moderation service unavailable (chat): {}", e.getMessage());
            return Result.allow();
        }
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Result call(String path, Object body) throws Exception {
        String json = mapper.writeValueAsString(body);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("HTTP " + response.statusCode() + ": " + response.body());
        }

        Map<String, Object> raw = mapper.readValue(response.body(), Map.class);

        int severity      = raw.get("severity") instanceof Number n ? n.intValue() : 0;
        String category   = (String) raw.getOrDefault("category", "clean");
        String action     = (String) raw.getOrDefault("action", "allow");
        String reason     = (String) raw.getOrDefault("reason", null);
        boolean blocked   = Boolean.TRUE.equals(raw.get("is_blocked"));
        boolean warned    = Boolean.TRUE.equals(raw.get("is_warned"));
        boolean escalated = Boolean.TRUE.equals(raw.get("is_escalated"));

        return new Result(category, action, severity, reason, blocked, warned, escalated);
    }
}
