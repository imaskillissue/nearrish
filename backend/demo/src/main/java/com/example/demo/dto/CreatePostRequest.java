package com.example.demo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// --- Request DTOs ---

public record CreatePostRequest(
    @NotBlank(message = "Content must not be blank")
    @Size(max = 5000, message = "Content must be at most 5000 characters")
    String content,

    @NotBlank(message = "Author ID must not be blank")
    String authorId,

    Double latitude,
    Double longitude
) {}
