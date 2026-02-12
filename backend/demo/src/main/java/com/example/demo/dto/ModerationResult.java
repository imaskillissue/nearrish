package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ModerationResult(
    String category,
    int severity,
    String reason,
    String confidence,
    @JsonProperty("is_blocked") boolean blocked,
    @JsonProperty("model_used") String modelUsed
) {}
