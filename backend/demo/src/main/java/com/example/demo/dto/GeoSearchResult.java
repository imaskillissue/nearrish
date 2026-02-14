package com.example.demo.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GeoSearchResult(
    List<GeoPost> posts,
    int count
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record GeoPost(
        Long id,
        String content,
        String authorId,
        int moderationSeverity,
        String moderationCategory,
        String createdAt,
        Double latitude,
        Double longitude,
        Double distanceKm
    ) {}
}
