package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ModerationResult(
    String category,
    int severity,
    String reason,
    String confidence,
    @JsonProperty("is_blocked") boolean blocked,
    @JsonProperty("model_used") String modelUsed
) {}
