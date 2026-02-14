package com.example.demo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateChatRequest(
    @NotBlank(message = "Content must not be blank")
    @Size(max = 2000, message = "Content must be at most 2000 characters")
    String content,

    @NotBlank(message = "Sender username must not be blank")
    String senderUsername
) {}
