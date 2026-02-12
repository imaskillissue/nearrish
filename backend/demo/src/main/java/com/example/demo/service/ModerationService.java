package com.example.demo.service;

import com.example.demo.dto.ModerationResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.util.Map;

@Service
public class ModerationService {

    private static final Logger log = LoggerFactory.getLogger(ModerationService.class);
    private final RestClient restClient;

    public ModerationService(@Value("${moderation.service.url}") String moderationUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);   // 5s to connect
        factory.setReadTimeout(30000);     // 30s for model inference
        this.restClient = RestClient.builder()
                .baseUrl(moderationUrl)
                .requestFactory(factory)
                .build();
    }

    /**
     * Call the Python moderation microservice.
     * Returns the moderation result, or a safe fallback if the service is down.
     */
    public ModerationResult moderate(String content, String userId, String contentType) {
        try {
            return restClient.post()
                    .uri("/moderate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "content", content,
                            "user_id", userId,
                            "content_type", contentType
                    ))
                    .retrieve()
                    .body(ModerationResult.class);
        } catch (Exception e) {
            log.error("Moderation service call failed: {}", e.getMessage());
            // Fail open with a warning — adjust policy as needed
            return new ModerationResult("error", 0, "Moderation service unavailable", "low", false, "none");
        }
    }
}
