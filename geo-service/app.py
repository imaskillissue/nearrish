"""
Geo-service: Geolocation microservice for Nearrish.
Handles spatial queries, clustering, and reverse geocoding.
"""

import os
import math
import logging
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

# Database config from environment
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "database"),
    "port": int(os.environ.get("DB_PORT", 5432)),
    "dbname": os.environ.get("DB_NAME", "social_media"),
    "user": os.environ.get("DB_USER", "social_user"),
    "password": os.environ.get("DB_PASSWORD", "change_this_in_production"),
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


@app.route("/geo/reverse", methods=["GET"])
@limiter.limit("60 per minute")
def reverse_geocode():
    """
    Simple reverse geocoding: find the nearest post to given coordinates
    and provide approximate location context.
    Query params: lat, lng
    """
    lat = request.args.get("lat", type=float)
    lng = request.args.get("lng", type=float)

    if lat is None or lng is None:
        return jsonify({"error": "lat and lng query params required"}), 400

    try:
        conn = get_db()
        cur = conn.cursor()
        # Find posts near this location and count them
        cur.execute(
            """
            SELECT COUNT(*) as nearby_count
            FROM posts
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
              AND latitude BETWEEN %s AND %s
              AND longitude BETWEEN %s AND %s
            """,
            (lat - 0.01, lat + 0.01, lng - 0.01, lng + 0.01),
        )
        row = cur.fetchone()
        nearby_count = row["nearby_count"] if row else 0

        # Get broader area stats
        cur.execute(
            """
            SELECT COUNT(*) as area_count
            FROM posts
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
              AND latitude BETWEEN %s AND %s
              AND longitude BETWEEN %s AND %s
            """,
            (lat - 0.1, lat + 0.1, lng - 0.1, lng + 0.1),
        )
        area_row = cur.fetchone()
        area_count = area_row["area_count"] if area_row else 0

        cur.close()
        conn.close()

        # Determine activity level
        if nearby_count > 10:
            activity = "high"
        elif nearby_count > 3:
            activity = "medium"
        elif nearby_count > 0:
            activity = "low"
        else:
            activity = "none"

        return jsonify({
            "latitude": lat,
            "longitude": lng,
            "nearbyPosts": nearby_count,
            "areaPosts": area_count,
            "activity": activity,
        }), 200

    except Exception as e:
        logger.error("Reverse geocode failed: %s", e)
        return jsonify({"error": "Reverse geocode failed"}), 500


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
