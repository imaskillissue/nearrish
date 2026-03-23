package com.nearrish.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests GeoProxyController with the geo-service intentionally unreachable
 * (GEO_SERVICE_URL points to a non-existent host), verifying the fallback path.
 */
@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "GEO_SERVICE_URL=http://localhost:19999"  // nothing listening here
})
class GeoProxyControllerTest {

    @Autowired
    private GeoProxyController geoProxyController;

    @Test
    void reverse_whenGeoServiceDown_returnsFallbackWithCoords() {
        Map<String, Object> result = geoProxyController.reverse(48.85, 2.35);

        assertNotNull(result);
        assertEquals("", result.get("displayName"));
        assertEquals(48.85, result.get("latitude"));
        assertEquals(2.35,  result.get("longitude"));
    }

    @Test
    void reverse_fallback_doesNotThrow() {
        assertDoesNotThrow(() -> geoProxyController.reverse(51.5, -0.1));
    }

    @Test
    void reverse_fallback_alwaysContainsAllThreeKeys() {
        Map<String, Object> result = geoProxyController.reverse(0.0, 0.0);

        assertTrue(result.containsKey("displayName"));
        assertTrue(result.containsKey("latitude"));
        assertTrue(result.containsKey("longitude"));
    }
}
