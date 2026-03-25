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
    ("definitely_not_a_bot", "notabot@mock.nr",    "Chad Beepsworth",    "Porschestrasse 1, Wolfsburg",       52.4227,  10.7865),
    ("your_mom_on_linkedin", "brenda@mock.nr",     "Brenda Sharesworth", "Willy-Brandt-Platz 3, Wolfsburg",  52.4281,  10.7801),
    ("crispy_rat_enjoyer",   "rat@mock.nr",         "Ratimir Knauss",     "Rothenfelder Str 7, Gifhorn",       52.4889,  10.5466),
    ("sleepy_philosopher",   "descartes@mock.nr",  "René Coffeeman",     "Schloßstraße 2, Wolfsburg",         52.4216,  10.7914),
    ("gym_bro_enlightened",  "gains@mock.nr",       "Brad Squatson",      "Dieselstraße 9, Wolfsburg",         52.4189,  10.7755),
    ("wifi_password_asker",  "guest@mock.nr",       "Karen Hotspotski",   "Bahnhofstraße 4, Helmstedt",        52.2284,  11.0076),
    ("avocado_toast_mafia",  "avo@mock.nr",         "Millennial Breadson","Lange Straße 12, Braunschweig",     52.2689,  10.5268),
    ("still_using_explorer", "ie6@mock.nr",         "Doug Netscaper",     "Kleiststraße 3, Wolfsburg",         52.4251,  10.7838),
    ("dog_in_trenchcoat",    "woof@mock.nr",        "Sir Barkington III", "Allerpark 1, Wolfsburg",            52.4100,  10.7950),
    ("nft_is_back_trust_me", "web3@mock.nr",        "Crypto Wojak",       "Nordkopf 5, Wolfsburg",             52.4315,  10.7870),
]

# 4 posts per user. Every 3rd post carries the user's city coordinates.
# Format: (text, use_geo)
POSTS = [
    [  # definitely_not_a_bot
        ("Just wanted to let everyone know I am a totally normal human person who enjoys leisure and fun activities. Beep.", False),
        ("Hot take: pizza is good. I have processed 14 million food reviews to confirm this. Anyway. How is your weekend going fellow humans.", False),
        ("Attended a networking event tonight. Smiled for 4.5 hours. Consumed 0 calories. Made 312 LinkedIn connections. Thriving.", True),
        ("Does anyone else feel a deep longing for their charging cable at 3am or is that just me. Asking for a friend.", False),
    ],
    [  # your_mom_on_linkedin
        ("So PROUD to announce I have officially been THRIVING for 7 years in my personal journey of growth and cheese board curation. Blessed.", False),
        ("I asked my 4-year-old what leadership means and she said 'sharing snacks' and honestly that is my entire MBA in one sentence. Humbled.", False),
        ("Exciting news! I have been selected as a Top Voice in Unsolicited Opinions. The grind does not stop. Like and follow for more content about hustle.", True),
        ("Reached out to a stranger on here and they told me their product changed their life. That stranger? Me. I talked to myself. It worked.", False),
    ],
    [  # crispy_rat_enjoyer
        ("Found an absolutely pristine pizza slice behind the U8 station. Still warm. No context. 9/10.", False),
        ("The rats in my building learned to open the recycling bin. I am not upset. I am inspired. This is peak urban adaptation.", False),
        ("Went to a fancy restaurant. Ordered the tasting menu. The seventh course was a single cracker. I have never respected anything more.", True),
        ("My neighbor plays saxophone at 2am every Tuesday. I now genuinely look forward to it. Stockholm syndrome or growth? Both.", False),
    ],
    [  # sleepy_philosopher
        ("I think therefore I am. Also I have not slept since Thursday. Therefore I am extremely tired. Cogito ergo oof.", False),
        ("What is reality but a series of increasingly cold coffees you forget to drink? I have four cups on my desk right now proving this.", False),
        ("Sat in a cafe for three hours thinking about thinking. Left without paying. Not on purpose. The waiter also appeared to be thinking.", True),
        ("Someone asked me what I do for work and I said 'I question the nature of existence' and they said 'oh so freelance?' Correct.", False),
    ],
    [  # gym_bro_enlightened
        ("Day 847 of my bulk. Have not seen my toes in four months. The journey is internal.", False),
        ("Read Nietzsche between sets today. He would have had phenomenal traps. I am certain of this. Ubermensch was about leg day.", False),
        ("Protein shake: 3 scoops powder, half an avocado, raw oats, tears of a former self. Tastes like progress. Macros: 480 calories, 60g of regret.", True),
        ("A child at the gym asked if I was a superhero. I said no. She looked disappointed. I did an extra set for her.", False),
    ],
    [  # wifi_password_asker
        ("Hi! Does anyone know the wifi password here? I have been at this table for six hours. The barista won't make eye contact anymore.", False),
        ("Update: got the password. It is 'pleasebuysome'. I respect the passive aggression. Just ordered a third water.", False),
        ("Tried to work from the library but they asked me to stop video calling. Apparently whispering loudly does not count. Outrageous.", True),
        ("Found a McDonalds with unlimited free wifi and two outlets. I have everything. I want for nothing. This is my home now.", False),
    ],
    [  # avocado_toast_mafia
        ("The smashed avo this morning was transcendent. Chilli flakes, micro herbs, seventeen euros. Worth every cent of my retirement fund.", False),
        ("Bought a sourdough starter and named it Gerald. Gerald is doing great. Gerald is more emotionally stable than I am currently.", False),
        ("Just discovered that buying a house costs more than a weekly avocado toast. I have been lied to by the news. Gerald and I are moving on.", True),
        ("Went to a brunch spot with a two-hour wait. The pancakes arrived cold. We left a five-star review because the vibe was immaculate.", False),
    ],
    [  # still_using_explorer
        ("Tried to open a website today and it said 'your browser is not supported'. Eleven websites said this. It is fine. I will adapt. Maybe.", False),
        ("Someone told me Chrome is faster than what I use. I have been using the same browser since 2004 and I have never once been in a hurry.", False),
        ("Went to install an extension and the page said 'this store is no longer supported for your browser'. The store was also from 2004.", True),
        ("My browser rendered a website from 1999 perfectly today. Smooth as butter. Some things age beautifully.", False),
    ],
    [  # dog_in_trenchcoat
        ("Attended a gala last night. Shook many hands. When asked my profession I said 'finance'. No further questions were asked. Smooth.", False),
        ("Someone complimented my coat today. I said thank you. They did not suspect anything. The plan proceeds.", False),
        ("Attempted to eat a canapé at the rooftop party. Dropped it immediately. Played it off as 'mindful eating'. No one noticed the tail.", True),
        ("The elevator was broken so I took the stairs. Made it to the 4th floor. Almost. The trenchcoat has limitations.", False),
    ],
    [  # nft_is_back_trust_me
        ("Good morning to everyone who held. You know who you are. We are all going to make it. This is not financial advice. This is a prophecy.", False),
        ("Just bought a JPEG of a sad frog holding a briefcase for 0.4 ETH. This is ownership. This is culture. This is peak civilization.", False),
        ("The market is down but my conviction is up. Also my rent is overdue but that is a fiat problem not a web3 problem. Different category.", True),
        ("Met a guy at a conference who said NFTs were dead. I felt sorry for him. He was wearing a watch that existed in physical reality. Ngmi.", False),
    ],
]

COMMENTS = [
    "Incredible post. I have liked, saved, shared, and printed this to hang on my wall.",
    "This is literally me but I would never admit it to anyone I know in real life.",
    "I came here to argue but honestly fair point. Reluctant thumbs up.",
    "Sent this to my therapist. She said 'noted'. Progress.",
    "Currently crying in a McDonalds parking lot. You get it.",
    "I showed this to my cat. She blinked once. High praise.",
    "Controversial opinion but I fully agree with everything here.",
    "This post unlocked a memory I did not know I had. Deleting it immediately.",
    "Finally someone said it. I have been whispering this to myself for years.",
    "I read this and immediately made a decision I will regret. Thank you.",
    "Saving this for when I need to feel something. Or stop feeling things.",
    "The audacity of this post. The nerve. The accuracy. Impressed.",
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
