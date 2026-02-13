package com.example.demo.service;

import com.example.demo.dto.GeoSearchResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Service
public class GeoService {

    private static final Logger log = LoggerFactory.getLogger(GeoService.class);
    private final RestClient restClient;

    public GeoService(@Value("${geo.service.url}") String geoUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        this.restClient = RestClient.builder()
                .baseUrl(geoUrl)
                .requestFactory(factory)
                .build();
    }

    public GeoSearchResult searchBounds(double south, double north, double west, double east, int limit) {
        try {
            return restClient.post()
                    .uri("/geo/search")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "south", south,
                            "north", north,
                            "west", west,
                            "east", east,
                            "limit", limit
                    ))
                    .retrieve()
                    .body(GeoSearchResult.class);
        } catch (Exception e) {
            log.error("Geo service search failed: {}", e.getMessage());
            return null;
        }
    }

    public GeoSearchResult searchRadius(double lat, double lng, double radiusKm, int limit) {
        try {
            return restClient.post()
                    .uri("/geo/radius")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "lat", lat,
                            "lng", lng,
                            "radius_km", radiusKm,
                            "limit", limit
                    ))
                    .retrieve()
                    .body(GeoSearchResult.class);
        } catch (Exception e) {
            log.error("Geo service radius search failed: {}", e.getMessage());
            return null;
        }
    }
}
