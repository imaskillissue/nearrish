#!/usr/bin/env python3
"""
Injects 10 mock users (4 posts each, cross-comments, cross-likes) directly
into the database via docker exec psql.

Usage:
    python3 scripts/mock_data.py          # reads .env for DB_USER / DB_NAME
    make mock
"""

import base64, hashlib, os, subprocess, sys, uuid
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent

def read_env(key, default=""):
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith(key + "="):
                return line.split("=", 1)[1].strip()
    return default

DB_USER      = read_env("DB_USER", "postgres")
DB_NAME      = read_env("DB_NAME", "transcendence")
CONTAINER    = "nearrish-database-1"
MOCK_PASSWORD = "MockPass1!"

# ── Password hashing ──────────────────────────────────────────────────────────
# Matches Spring Security SCryptPasswordEncoder.defaultsForSpringSecurity_v5_8()
# N=65536, r=8, p=1, keyLength=32, saltLength=16  →  params tag "$100801$"

def scrypt_encode(password: str) -> str:
    salt = os.urandom(16)
    dk   = hashlib.scrypt(password.encode(), salt=salt, n=65536, r=8, p=1, dklen=32, maxmem=128*1024*1024)
    return f"$100801${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"

# ── Mock users ────────────────────────────────────────────────────────────────
# (username, email, name, address, lat, lng)

USERS = [
    ("alex_nearrish", "alex@mock.nr",   "Alex Fontaine",  "12 Rue de Rivoli, Paris",          48.8566,   2.3522),
    ("sara_peaks",    "sara@mock.nr",   "Sara Peaks",     "47 High Street, Edinburgh",         55.9533,  -3.1883),
    ("marco_via",     "marco@mock.nr",  "Marco Via",      "Via Condotti 8, Rome",              41.9028,  12.4964),
    ("linh_huynh",    "linh@mock.nr",   "Linh Huynh",     "88 Nguyen Hue, Ho Chi Minh City",  10.8231, 106.6297),
    ("jake_coastal",  "jake@mock.nr",   "Jake Coastal",   "3 Ocean Drive, Sydney",            -33.8688, 151.2093),
    ("fatima_sol",    "fatima@mock.nr", "Fatima Sol",     "Calle Mayor 5, Madrid",             40.4168,  -3.7038),
    ("tom_wanderer",  "tom@mock.nr",    "Tom Wanderer",   "Hauptstrasse 22, Berlin",           52.5200,  13.4050),
    ("yuki_shiro",    "yuki@mock.nr",   "Yuki Shiro",     "1-2-3 Shibuya, Tokyo",             35.6762, 139.6503),
    ("priya_dev",     "priya@mock.nr",  "Priya Dev",      "MG Road 42, Bangalore",            12.9716,  77.5946),
    ("leo_brix",      "leo@mock.nr",    "Leo Brix",       "Stroget 11, Copenhagen",           55.6761,  12.5683),
]

# 4 posts per user. Every 3rd post carries the user's city coordinates.
# Format: (text, use_geo)
POSTS = [
    [  # alex
        ("Just hiked up to the old fortress overlooking the city. The view at sunrise was absolutely worth the 5am wake-up.", False),
        ("Anyone know a good hidden bookshop around here? Found one last week with an entire floor of maps and atlases.", False),
        ("Cooked a ratatouille from scratch today. Took three hours. Ate it in four minutes. Zero regrets.", True),
        ("The neighbourhood market finally has those small-batch cheeses I have been hunting for. Tuesday mornings are sacred.", False),
    ],
    [  # sara
        ("Peak season is over and the trails are empty. Found a loch completely to myself this morning. Total silence.", False),
        ("Came across an abandoned Victorian greenhouse on a walk. Half the glass intact, overgrown inside. Like a painting.", False),
        ("Started sketching again after years away from it. Muscle memory is real — hands remembered before the brain did.", True),
        ("Local bakery put sourdough back on the menu after a two-year hiatus. The queue wrapped around the block by 7am.", False),
    ],
    [  # marco
        ("Evening light on the cobblestones here is something else. Same street I have walked a thousand times, still catches me.", False),
        ("Spent the afternoon in a tiny gallery behind a church. Three rooms, twelve paintings. One of the best shows I have seen.", False),
        ("Made cacio e pepe for the first time without the sauce breaking. Small victory but I will take it.", True),
        ("Running the river path at dawn before the city wakes up. This is why I moved here.", False),
    ],
    [  # linh
        ("Street food at the night market: banh mi, sugarcane juice, and something I could not identify but ate anyway. Perfect.", False),
        ("Rain season just started. The smell of wet asphalt and jasmine is one of those scents you can never forget.", False),
        ("Found a cafe that opens at 5am and plays no music. Just coffee machines and rain. My new office.", True),
        ("Took the long way home on my motorbike. Sometimes the detour is the whole point.", False),
    ],
    [  # jake
        ("Swam at sunrise in a cove I found on the map. Completely empty. Water so clear I could count the pebbles four metres down.", False),
        ("Spotted a pod of dolphins from the coastal path this morning. Spent twenty minutes just watching them.", False),
        ("Beach BBQ with neighbours — someone brought a guitar, someone else brought way too much halloumi. No complaints.", True),
        ("Finally got around to learning to surf. Day one: mostly paddling. Day one is not the day to judge.", False),
    ],
    [  # fatima
        ("Mercado de San Miguel at opening time before the tour groups arrive. Completely different energy. Worth the early alarm.", False),
        ("Flamenco show in a tiny venue last night. Forty seats. The performance was three metres from my face. Unforgettable.", False),
        ("Made a proper tortilla espanola today — thick, barely set in the middle. Took four attempts. This one nailed it.", True),
        ("Walked the entire length of the city walls this morning. Every corner has a different century in it.", False),
    ],
    [  # tom
        ("Cycling the canal path to the forest before rush hour. Cold air, no cars, just the sound of tyres on wet leaves.", False),
        ("Found a concept store in Mitte with an entire floor of architecture books. Went in for five minutes. Left two hours later.", False),
        ("Currywurst at the legendary stand after midnight. Some rituals are non-negotiable.", True),
        ("Street art walk through Kreuzberg — pieces I have walked past a hundred times look completely different at night.", False),
    ],
    [  # yuki
        ("Sencha in a 200-year-old teahouse in Yanaka. The neighbourhood feels like the city paused here on purpose.", False),
        ("Caught the sakura just before peak — slightly early, no crowds. Next week will be chaos. Glad I went today.", False),
        ("Ramen at 11pm in a six-seat place with no English menu. Pointed at the photo. Best decision of the trip.", True),
        ("Found a used record shop in Shimokitazawa with entire crates of city-pop from the 80s. Spent way too much.", False),
    ],
    [  # priya
        ("Monsoon hit properly today. Spent the afternoon coding to the sound of rain hammering a tin roof. Peak productivity.", False),
        ("Filter coffee at a third-wave roastery — they grew the beans, roasted on-site, explained every step. Worth every rupee.", False),
        ("Bangalore traffic at 6am vs 8am is two completely different cities. Chose wisely this morning.", True),
        ("Found a tiny gallery showing work from local photographers. Every frame had a story I needed to hear.", False),
    ],
    [  # leo
        ("Cycling along the harbour in November — everyone else stayed home. Got the whole waterfront to myself.", False),
        ("Open-face smorrebrod lunch followed by an accidental three-hour canal walk. This city refuses to let you rush.", False),
        ("Local jazz bar on a Wednesday: five people in the audience, six in the band. The best kind of ratio.", True),
        ("Stumbled into a flea market near Norrebro — left with a Danish lamp from 1967 and no regrets whatsoever.", False),
    ],
]

COMMENTS = [
    "This is exactly the kind of post I needed to see today.",
    "That sounds incredible, I need to try this.",
    "Been here too — the vibe is completely different at that time of day.",
    "Following for the local recommendations, please keep posting.",
    "How long did it take you to get there? Worth the commute?",
    "This made my morning, thank you for sharing it.",
    "I have walked past this a hundred times and never noticed. Going this weekend.",
    "Genuinely jealous, this looks like a perfect afternoon.",
    "Peak hours ruin everything. You made the right call going early.",
    "This is why I follow people on Nearrish. Real finds, not tourist traps.",
    "Same experience here last month — the timing really does matter.",
    "The detail in this is incredible. You should write more often.",
]

# ── SQL generation ────────────────────────────────────────────────────────────

def q(s):
    """Escape a string for SQL single-quote context."""
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def build_sql():
    lines = ["-- nearrish mock data\n"]
    now_ms = int(__import__("time").time() * 1000)

    user_ids  = [str(uuid.uuid4()) for _ in USERS]
    post_ids  = []   # flat list, matches order of POSTS[i][j]

    # ── Users ─────────────────────────────────────────────────────────────────
    lines.append("-- Users")
    for i, (username, email, name, address, lat, lng) in enumerate(USERS):
        uid = user_ids[i]
        pw  = scrypt_encode(MOCK_PASSWORD)
        lines.append(
            f"INSERT INTO users (id, username, email, password_hash, name, nickname, address, last_online) "
            f"SELECT {q(uid)}, {q(username)}, {q(email)}, {q(pw)}, {q(name)}, {q(username)}, {q(address)}, {now_ms} "
            f"WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = {q(username)});"
        )
    lines.append("")

    # ── Re-fetch user_ids from DB in case some already existed ────────────────
    # (we re-use the generated IDs; if a user already existed with a different ID
    #  the posts/comments/likes will use the correct ID after the SELECT below)
    lines.append("-- Resolve actual user IDs (handles pre-existing users)")
    for i, (username, email, name, address, lat, lng) in enumerate(USERS):
        uid = user_ids[i]
        # Update our working ID to match whatever is in DB (no-op if we just inserted)
        # We do this by using a subquery in subsequent inserts instead of hardcoded IDs.
        # (The IDs are baked in below, so we just rely on the insert above being correct.)
        pass
    lines.append("")

    # ── Posts ─────────────────────────────────────────────────────────────────
    lines.append("-- Posts")
    for i, (username, email, name, address, lat, lng) in enumerate(USERS):
        uid = user_ids[i]
        for j, (text, use_geo) in enumerate(POSTS[i]):
            pid = str(uuid.uuid4())
            post_ids.append(pid)
            ts  = now_ms - (len(USERS) * 4 - i * 4 - j) * 3_600_000  # stagger by 1h
            uid_expr = f"(SELECT id FROM users WHERE username = {q(username)})"
            if use_geo:
                lines.append(
                    f"INSERT INTO post (id, text, author_id, timestamp, visibility, moderated, latitude, longitude) "
                    f"SELECT {q(pid)}, {q(text)}, {uid_expr}, {ts}, 'PUBLIC', false, {lat}, {lng} "
                    f"WHERE NOT EXISTS (SELECT 1 FROM post WHERE id = {q(pid)});"
                )
            else:
                lines.append(
                    f"INSERT INTO post (id, text, author_id, timestamp, visibility, moderated) "
                    f"SELECT {q(pid)}, {q(text)}, {uid_expr}, {ts}, 'PUBLIC', false "
                    f"WHERE NOT EXISTS (SELECT 1 FROM post WHERE id = {q(pid)});"
                )
    lines.append("")

    total_posts = len(post_ids)

    # ── Comments — each user comments on 6 posts from other users ─────────────
    lines.append("-- Comments")
    for i, (username, *_) in enumerate(USERS):
        for k, offset in enumerate([3, 7, 12, 18, 25, 33]):
            idx  = (i * 4 + offset) % total_posts
            pid  = post_ids[idx]
            text = COMMENTS[(i + k) % len(COMMENTS)]
            cid  = str(uuid.uuid4())
            uid_expr = f"(SELECT id FROM users WHERE username = {q(username)})"
            lines.append(
                f"INSERT INTO comments (id, post_id, author_id, content, moderated, created_at) "
                f"SELECT {q(cid)}, {q(pid)}, {uid_expr}, {q(text)}, false, NOW() "
                f"WHERE NOT EXISTS (SELECT 1 FROM comments WHERE id = {q(cid)});"
            )
    lines.append("")

    # ── Likes — each user likes 8 posts from other users ─────────────────────
    lines.append("-- Likes")
    for i, (username, *_) in enumerate(USERS):
        uid_expr = f"(SELECT id FROM users WHERE username = {q(username)})"
        for offset in [1, 5, 9, 14, 20, 28, 35, 38]:
            idx = (i * 4 + offset) % total_posts
            pid = post_ids[idx]
            lid = str(uuid.uuid4())
            lines.append(
                f"INSERT INTO user_likes (id, user_id, post_id, created_at) "
                f"SELECT {q(lid)}, {uid_expr}, {q(pid)}, NOW() "
                f"WHERE NOT EXISTS (SELECT 1 FROM user_likes WHERE user_id = {uid_expr} AND post_id = {q(pid)});"
            )
    lines.append("")

    return "\n".join(lines)

# ── Run ───────────────────────────────────────────────────────────────────────

def main():
    print(f"[mock] Building SQL for 10 users × 4 posts + comments + likes...")
    sql = build_sql()

    print(f"[mock] Injecting into {CONTAINER} ({DB_USER}/{DB_NAME}) via docker exec...")
    result = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME],
        input=sql.encode(),
        capture_output=True,
    )

    if result.returncode != 0:
        print(result.stderr.decode(), file=sys.stderr)
        sys.exit(result.returncode)

    output = result.stdout.decode()
    inserts  = output.count("INSERT 0 1")
    skipped  = output.count("INSERT 0 0")

    print(f"[mock] Done.")
    print(f"  → {inserts} rows inserted, {skipped} skipped (already existed)")
    print(f"  → Password for all mock accounts: {MOCK_PASSWORD}")

if __name__ == "__main__":
    main()
