"""
Geo-service: Geolocation microservice for Nearrish.
Handles spatial queries, clustering, and reverse geocoding.
"""

import os
import math
import logging
import time
import requests as http_requests
from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Rate limiting
limiter = Limiter(get_remote_address, app=app, default_limits=["200 per minute"])

# Read DB password from Docker secret file, fallback to env var
def _read_db_password():
    secret_file = os.environ.get("DB_PASSWORD_FILE", "/run/secrets/db_password")
    try:
        with open(secret_file, "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        return os.environ.get("DB_PASSWORD", "change_this_in_production")

# Database config from environment
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "database"),
    "port": int(os.environ.get("DB_PORT", 5432)),
    "dbname": os.environ.get("DB_NAME", "social_media"),
    "user": os.environ.get("DB_USER", "social_user"),
    "password": _read_db_password(),
}


def get_db():
    """Get a database connection."""
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    try:
        conn = get_db()
        conn.close()
        return jsonify({"status": "healthy", "service": "geo-service"}), 200
    except Exception as e:
        logger.error("Health check failed: %s", e)
        return jsonify({"status": "unhealthy", "error": str(e)}), 503


@app.route("/geo/search", methods=["POST"])
@limiter.limit("100 per minute")
def search():
    """
    Search posts within a bounding box.
    Body: { "south": float, "north": float, "west": float, "east": float, "limit": int }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    south = data.get("south")
    north = data.get("north")
    west = data.get("west")
    east = data.get("east")
    limit = min(data.get("limit", 200), 1000)

    if None in (south, north, west, east):
        return jsonify({"error": "south, north, west, east are required"}), 400

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, content, author_id, moderation_severity, moderation_category,
                   created_at, latitude, longitude
            FROM posts
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
              AND latitude BETWEEN %s AND %s
              AND longitude BETWEEN %s AND %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (south, north, west, east, limit),
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        posts = []
        for r in rows:
            posts.append({
                "id": r["id"],
                "content": r["content"],
                "authorId": r["author_id"],
                "moderationSeverity": r["moderation_severity"],
                "moderationCategory": r["moderation_category"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
                "latitude": float(r["latitude"]) if r["latitude"] else None,
                "longitude": float(r["longitude"]) if r["longitude"] else None,
            })

        return jsonify({"posts": posts, "count": len(posts)}), 200

    except Exception as e:
        logger.error("Search failed: %s", e)
        return jsonify({"error": "Search failed"}), 500


@app.route("/geo/radius", methods=["POST"])
@limiter.limit("100 per minute")
def radius_search():
    """
    Search posts within a radius (in km) from a center point.
    Body: { "lat": float, "lng": float, "radius_km": float, "limit": int }
    Uses Haversine formula approximation.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    lat = data.get("lat")
    lng = data.get("lng")
    radius_km = data.get("radius_km", 10)
    limit = min(data.get("limit", 200), 1000)

    if lat is None or lng is None:
        return jsonify({"error": "lat and lng are required"}), 400

    try:
        conn = get_db()
        cur = conn.cursor()
        # Haversine distance in SQL (approximate, good enough for short distances)
        cur.execute(
            """
            SELECT id, content, author_id, moderation_severity, moderation_category,
                   created_at, latitude, longitude,
                   (6371 * acos(
                       cos(radians(%s)) * cos(radians(latitude))
                       * cos(radians(longitude) - radians(%s))
                       + sin(radians(%s)) * sin(radians(latitude))
                   )) AS distance_km
            FROM posts
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            HAVING (6371 * acos(
                       cos(radians(%s)) * cos(radians(latitude))
                       * cos(radians(longitude) - radians(%s))
                       + sin(radians(%s)) * sin(radians(latitude))
                   )) <= %s
            ORDER BY distance_km ASC
            LIMIT %s
            """,
            (lat, lng, lat, lat, lng, lat, radius_km, limit),
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        posts = []
        for r in rows:
            posts.append({
                "id": r["id"],
                "content": r["content"],
                "authorId": r["author_id"],
                "moderationSeverity": r["moderation_severity"],
                "moderationCategory": r["moderation_category"],
                "createdAt": r["created_at"].isoformat() if r["created_at"] else None,
                "latitude": float(r["latitude"]) if r["latitude"] else None,
                "longitude": float(r["longitude"]) if r["longitude"] else None,
                "distanceKm": round(float(r["distance_km"]), 2),
            })

        return jsonify({"posts": posts, "count": len(posts), "center": {"lat": lat, "lng": lng}, "radiusKm": radius_km}), 200

    except Exception as e:
        logger.error("Radius search failed: %s", e)
        return jsonify({"error": "Radius search failed"}), 500


@app.route("/geo/cluster", methods=["POST"])
@limiter.limit("60 per minute")
def cluster():
    """
    Cluster posts into grid cells for map overview at low zoom levels.
    Body: { "south": float, "north": float, "west": float, "east": float, "grid_size": int }
    grid_size = number of cells per axis (default 8, so 8x8 = 64 cells)
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    south = data.get("south")
    north = data.get("north")
    west = data.get("west")
    east = data.get("east")
    grid_size = min(data.get("grid_size", 8), 20)

    if None in (south, north, west, east):
        return jsonify({"error": "south, north, west, east are required"}), 400

    lat_step = (north - south) / grid_size
    lng_step = (east - west) / grid_size

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT latitude, longitude
            FROM posts
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
              AND latitude BETWEEN %s AND %s
              AND longitude BETWEEN %s AND %s
            """,
            (south, north, west, east),
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        # Build grid clusters
        clusters = {}
        for r in rows:
            lat = float(r["latitude"])
            lng = float(r["longitude"])
            cell_y = min(int((lat - south) / lat_step), grid_size - 1) if lat_step > 0 else 0
            cell_x = min(int((lng - west) / lng_step), grid_size - 1) if lng_step > 0 else 0
            key = (cell_x, cell_y)
            if key not in clusters:
                clusters[key] = {"count": 0, "lat_sum": 0.0, "lng_sum": 0.0}
            clusters[key]["count"] += 1
            clusters[key]["lat_sum"] += lat
            clusters[key]["lng_sum"] += lng

        result = []
        for key, c in clusters.items():
            result.append({
                "latitude": round(c["lat_sum"] / c["count"], 6),
                "longitude": round(c["lng_sum"] / c["count"], 6),
                "count": c["count"],
            })

        return jsonify({"clusters": result, "totalPosts": len(rows), "gridSize": grid_size}), 200

    except Exception as e:
        logger.error("Clustering failed: %s", e)
        return jsonify({"error": "Clustering failed"}), 500


# ── Reverse geocoding via Nominatim (OpenStreetMap) ──────────────────────────
# Simple in-memory cache: round coordinates to ~110m precision to avoid
# hammering the API for nearby pins. Entries expire after 24h.
_geocode_cache: dict[tuple[float, float], tuple[dict, float]] = {}
_CACHE_TTL = 86400  # 24 hours
_NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"


def _round_coords(lat: float, lng: float) -> tuple[float, float]:
    """Round to 3 decimal places (~110m) for cache key."""
    return (round(lat, 3), round(lng, 3))


def _nominatim_reverse(lat: float, lng: float) -> dict:
    """Call Nominatim reverse geocoding API and return a clean result."""
    key = _round_coords(lat, lng)
    now = time.time()

    # Check cache
    if key in _geocode_cache:
        cached, ts = _geocode_cache[key]
        if now - ts < _CACHE_TTL:
            return cached

    try:
        resp = http_requests.get(
            _NOMINATIM_URL,
            params={"lat": lat, "lon": lng, "format": "json", "zoom": 18,
                    "addressdetails": 1, "accept-language": "de,en"},
            headers={"User-Agent": "Nearrish/1.0 (student project)"},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()

        addr = data.get("address", {})
        # Build a short, human-readable name
        # Priority: tourism/building > road > suburb > city
        name_parts = []
        for field in ("tourism", "building", "amenity", "shop", "leisure",
                      "historic", "natural"):
            if field in addr:
                name_parts.append(addr[field])
                break
        road = addr.get("road")
        if road:
            house = addr.get("house_number", "")
            name_parts.append(f"{road} {house}".strip())
        suburb = addr.get("suburb") or addr.get("neighbourhood")
        if suburb:
            name_parts.append(suburb)
        city = addr.get("city") or addr.get("town") or addr.get("village")
        if city:
            name_parts.append(city)

        display_name = ", ".join(name_parts) if name_parts else data.get("display_name", "")

        result = {
            "displayName": display_name,
            "fullAddress": data.get("display_name", ""),
            "address": addr,
        }
        _geocode_cache[key] = (result, now)
        return result

    except Exception as e:
        logger.warning("Nominatim reverse geocoding failed: %s", e)
        return {"displayName": "", "fullAddress": "", "address": {}}


@app.route("/geo/reverse", methods=["GET"])
@limiter.limit("60 per minute")
def reverse_geocode():
    """
    Reverse geocoding: convert lat/lng to a human-readable place name.
    Query params: lat, lng
    Returns: { latitude, longitude, displayName, fullAddress, address }
    """
    lat = request.args.get("lat", type=float)
    lng = request.args.get("lng", type=float)

    if lat is None or lng is None:
        return jsonify({"error": "lat and lng query params required"}), 400

    geo = _nominatim_reverse(lat, lng)

    return jsonify({
        "latitude": lat,
        "longitude": lng,
        **geo,
    }), 200


@app.route("/geo/stats", methods=["GET"])
@limiter.limit("30 per minute")
def stats():
    """Global geo statistics."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                COUNT(*) as total_posts,
                COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) as geo_posts,
                MIN(latitude) as min_lat, MAX(latitude) as max_lat,
                MIN(longitude) as min_lng, MAX(longitude) as max_lng
            FROM posts
            """
        )
        row = cur.fetchone()
        cur.close()
        conn.close()

        return jsonify({
            "totalPosts": row["total_posts"],
            "geoPosts": row["geo_posts"],
            "bounds": {
                "south": float(row["min_lat"]) if row["min_lat"] else None,
                "north": float(row["max_lat"]) if row["max_lat"] else None,
                "west": float(row["min_lng"]) if row["min_lng"] else None,
                "east": float(row["max_lng"]) if row["max_lng"] else None,
            } if row["min_lat"] else None,
        }), 200

    except Exception as e:
        logger.error("Stats failed: %s", e)
        return jsonify({"error": "Stats failed"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)
