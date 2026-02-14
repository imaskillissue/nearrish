package com.example.demo.service;

import com.example.demo.dto.ModerationResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Service
public class ModerationService {

    private static final Logger log = LoggerFactory.getLogger(ModerationService.class);
    private final RestClient restClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ModerationService(@Value("${moderation.service.url}") String moderationUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);   // 5s to connect
        factory.setReadTimeout(300000);    // 5min for model inference (Phi-3 on CPU can be slow)
        // Add a StringHttpMessageConverter that also accepts application/json,
        // so .body(String.class) works regardless of response content-type
        StringHttpMessageConverter converter = new StringHttpMessageConverter(StandardCharsets.UTF_8);
        converter.setSupportedMediaTypes(List.of(MediaType.TEXT_PLAIN, MediaType.APPLICATION_JSON, MediaType.ALL));
        this.restClient = RestClient.builder()
                .baseUrl(moderationUrl)
                .requestFactory(factory)
                .messageConverters(converters -> {
                    // Put our permissive String converter first so it wins for String.class
                    converters.add(0, converter);
                })
                .build();
    }

    /**
     * Call the Python moderation microservice.
     * Returns the moderation result, or a safe fallback if the service is down.
     */
    public ModerationResult moderate(String content, String userId, String contentType) {
        try {
            String json = restClient.post()
                    .uri("/moderate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "content", content,
                            "user_id", userId,
                            "content_type", contentType
                    ))
                    .retrieve()
                    .body(String.class);
            return objectMapper.readValue(json, ModerationResult.class);
        } catch (Exception e) {
            log.error("Moderation service call failed: {}", e.getMessage());
            // Fail open with a warning — adjust policy as needed
            return new ModerationResult("error", 0, "Moderation service unavailable", "low", false, "none");
        }
    }
}
