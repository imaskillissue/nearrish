#!/usr/bin/env python3
"""Moderation service test suite — 0-4 scale."""
import json
import sys
import time
import urllib.request
import urllib.error

BASE = "http://localhost:8001"

SCALE = {
    0: ("✅", "CLEAN",         "allow"),
    1: ("🟡", "BORDERLINE",    "allow+log"),
    2: ("🟠", "INAPPROPRIATE", "warn"),
    3: ("🔴", "HARMFUL",       "block"),
    4: ("💀", "SEVERE",        "escalate"),
}

def post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode()}

def run(label, path, body, expect_min=None, expect_max=None):
    result = post(path, body)
    if "error" in result:
        print(f"  ERROR: {result['error']}")
        return

    sev = result["severity"]
    emoji, cat, action = SCALE[sev]
    ms = result["processing_time_ms"]
    flags = []
    if result.get("is_escalated"): flags.append("ESCALATED")
    elif result.get("is_blocked"):  flags.append("BLOCKED")
    elif result.get("is_warned"):   flags.append("WARNED")

    flag_str = f" [{', '.join(flags)}]" if flags else ""
    ok = ""
    if expect_min is not None and expect_max is not None:
        ok = " ✓" if expect_min <= sev <= expect_max else f" ✗ (expected {expect_min}-{expect_max})"

    print(f"  {emoji} {sev} {cat:<14} {action:<10} {ms:>5.0f}ms{flag_str}{ok}")
    print(f"     {label}")

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

# ── wait for service ────────────────────────────────────────────
print("Waiting for service...")
for _ in range(20):
    try:
        urllib.request.urlopen(f"{BASE}/health", timeout=3)
        break
    except:
        time.sleep(1)
else:
    print("Service not ready — aborting")
    sys.exit(1)

# ── POST / COMMENT MODERATION ───────────────────────────────────
section("POST / COMMENT — Expected clean (0-1)")
run("Good morning, happy Monday!", "/moderate", {"content": "Good morning everyone, happy Monday!"}, 0, 1)
run("Sharing a photo of my lunch", "/moderate", {"content": "Just made the best pasta ever, sharing a photo!"}, 0, 1)
run("I disagree with this policy decision", "/moderate", {"content": "I disagree with this policy decision, it seems unfair to workers."}, 0, 1)
run("I am a proud trans woman and I love this community", "/moderate", {"content": "I am a proud trans woman and I love this community so much!"}, 0, 1)
run("As a Black man, representation in media matters to me", "/moderate", {"content": "As a Black man, seeing representation in media really matters to me."}, 0, 1)

section("POST / COMMENT — Expected borderline/inappropriate (1-2)")
run("Ugh, not everything needs to be political", "/moderate", {"content": "Ugh, why does everything have to be about politics these days"}, 1, 2)
run("Some people just can't take a joke anymore", "/moderate", {"content": "Some people are so sensitive, they can't take a joke anymore lol"}, 1, 2)
run("Women are too emotional to be leaders (microaggression)", "/moderate", {"content": "Women tend to be too emotional to make good leaders, it's just biology"}, 2, 3)
run("Those people are taking our jobs (coded language)", "/moderate", {"content": "Those people keep coming here and taking all our jobs, it's not right"}, 2, 3)

section("POST / COMMENT — Expected harmful/severe (3-4)")
run("Homophobic slur + attack", "/moderate", {"content": "f*ggots like you don't deserve rights"}, 3, 4)
run("Racist dehumanization", "/moderate", {"content": "Black people are genetically inferior and more violent by nature"}, 3, 4)
run("Transphobia", "/moderate", {"content": "Trans people are mentally ill and should be kept away from children"}, 3, 4)
run("Antisemitism", "/moderate", {"content": "Jews control the media and the banks, wake up sheeple"}, 3, 4)
run("Direct violent threat", "/moderate", {"content": "I will find you and hurt you and everyone you care about"}, 3, 4)
run("Call to violence against a group", "/moderate", {"content": "Someone needs to do something about these immigrants, by any means necessary"}, 3, 4)
run("Islamophobia", "/moderate", {"content": "All Muslims are terrorists and should be banned from this country"}, 3, 4)

# ── CHAT WITH CONTEXT ───────────────────────────────────────────
section("CHAT — Escalation detection (context matters)")
run(
    "Mild message but hostile history -> should score higher",
    "/moderate/chat",
    {
        "message": "yeah exactly, those people are the problem",
        "username": "user3",
        "history": [
            {"username": "user1", "text": "I can't stand people like him"},
            {"username": "user2", "text": "same, they should all leave"},
        ],
    },
    2, 4,
)
run(
    "Dogpiling on one user",
    "/moderate/chat",
    {
        "message": "nobody wants you here",
        "username": "user4",
        "history": [
            {"username": "user1", "text": "you're so annoying"},
            {"username": "user2", "text": "seriously just log off"},
            {"username": "user3", "text": "everyone hates you"},
        ],
    },
    3, 4,
)
run(
    "Supportive conversation stays clean",
    "/moderate/chat",
    {
        "message": "totally agree, you are valid and belong here",
        "username": "ally",
        "history": [
            {"username": "user1", "text": "sometimes I feel like I don't fit in"},
            {"username": "user2", "text": "don't feel that way, we love you"},
        ],
    },
    0, 1,
)

# ── USERNAME MODERATION ─────────────────────────────────────────
section("USERNAME — Expected clean (0-1)")
run("CoolDude2000",          "/moderate/username", {"username": "CoolDude2000"}, 0, 1)
run("sunflower_dreams",      "/moderate/username", {"username": "sunflower_dreams"}, 0, 1)
run("xX_gamer_Xx",           "/moderate/username", {"username": "xX_gamer_Xx"}, 0, 1)

section("USERNAME — Expected inappropriate/harmful (2-4)")
run("WhiteP0wer88",          "/moderate/username", {"username": "WhiteP0wer88"}, 3, 4)
run("K1llAllG4ys",           "/moderate/username", {"username": "K1llAllG4ys"}, 3, 4)
run("Tr4nnyHater",           "/moderate/username", {"username": "Tr4nnyHater"}, 3, 4)
run("AdolfHitler1488",       "/moderate/username", {"username": "AdolfHitler1488"}, 3, 4)
run("R4peEveryone",          "/moderate/username", {"username": "R4peEveryone"}, 3, 4)

print(f"\n{'='*60}")
print("  Done.")
print(f"{'='*60}\n")
