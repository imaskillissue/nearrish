package com.nearrish.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

/**
 * Proxies reverse geocoding requests to the internal geo-service.
 * Keeps the geo-service off the public internet while providing caching at the geo-service layer.
 */
@RestController
@RequestMapping("/api/public/geo")
public class GeoProxyController {

    private static final Logger log = LoggerFactory.getLogger(GeoProxyController.class);

    private final String geoServiceUrl;
    private final HttpClient http = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .build();
    private final ObjectMapper mapper = new ObjectMapper();

    public GeoProxyController(@Value("${GEO_SERVICE_URL:http://geo-service:5002}") String geoServiceUrl) {
        this.geoServiceUrl = geoServiceUrl;
    }

    @GetMapping("/reverse")
    public Map<String, Object> reverse(@RequestParam double lat, @RequestParam double lng) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(geoServiceUrl + "/geo/reverse?lat=" + lat + "&lng=" + lng))
                    .GET()
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = mapper.readValue(response.body(), Map.class);
                return result;
            }
        } catch (Exception e) {
            log.warn("Geo-service reverse geocoding failed: {}", e.getMessage());
        }
        return Map.of("displayName", "", "latitude", lat, "longitude", lng);
    }
}
