#!/usr/bin/env bash
# =============================================================================
# mock_data.sh — injects 10 mock users, 4 posts each, comments and likes
# Usage: ./scripts/mock_data.sh [API_BASE]
#   API_BASE defaults to http://localhost:8080
# =============================================================================
set -euo pipefail

API="${1:-http://localhost:8080}"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${CYAN}[mock]${NC} $*"; }
ok()   { echo -e "${GREEN}[mock]${NC} $*"; }
warn() { echo -e "${YELLOW}[mock]${NC} $*"; }
fail() { echo -e "${RED}[mock]${NC} $*" >&2; exit 1; }

# ── Wait for backend ──────────────────────────────────────────────────────────

log "Waiting for backend at $API ..."
for i in $(seq 1 30); do
  if curl -sf "$API/api/public/posts/feed" -o /dev/null 2>&1; then
    ok "Backend is up."
    break
  fi
  if [ "$i" -eq 30 ]; then
    fail "Backend did not respond after 60s. Is the stack running? (make up)"
  fi
  sleep 2
done

# ── Users ─────────────────────────────────────────────────────────────────────
# Format: "username:email:password:name:address"

declare -a USER_DEFS=(
  "alex_nearrish:alex@mock.nr:MockPass1!:Alex Fontaine:12 Rue de Rivoli, Paris"
  "sara_peaks:sara@mock.nr:MockPass2!:Sara Peaks:47 High Street, Edinburgh"
  "marco_via:marco@mock.nr:MockPass3!:Marco Via:Via Condotti 8, Rome"
  "linh_huynh:linh@mock.nr:MockPass4!:Linh Huynh:88 Nguyen Hue, Ho Chi Minh City"
  "jake_coastal:jake@mock.nr:MockPass5!:Jake Coastal:3 Ocean Drive, Sydney"
  "fatima_sol:fatima@mock.nr:MockPass6!:Fatima Sol:Calle Mayor 5, Madrid"
  "tom_wanderer:tom@mock.nr:MockPass7!:Tom Wanderer:Hauptstraße 22, Berlin"
  "yuki_shiro:yuki@mock.nr:MockPass8!:Yuki Shiro:1-2-3 Shibuya, Tokyo"
  "priya_dev:priya@mock.nr:MockPass9!:Priya Dev:MG Road 42, Bangalore"
  "leo_brix:leo@mock.nr:MockPass10!:Leo Brix:Stroget 11, Copenhagen"
)

# ── Posts (4 per user, some with geo coords) ──────────────────────────────────

declare -a POSTS_0=(
  "Just hiked up to the old fortress overlooking the city — the view at sunrise was absolutely worth the 5am wake-up."
  "Anyone know a good hidden bookshop around here? Found one last week with an entire floor dedicated to maps and atlases."
  "Cooked a ratatouille from scratch today. Took three hours. Ate it in four minutes. Zero regrets."
  "The neighbourhood market finally has those small-batch cheeses I've been hunting for. Tuesday mornings are sacred now."
)
declare -a POSTS_1=(
  "Peak season is over, trails are empty. Found a loch completely to myself this morning — still water, mist, total silence."
  "Came across an abandoned Victorian greenhouse on a walk. Half the glass intact, overgrown inside. Looked like a painting."
  "Started sketching again after years away from it. Muscle memory is real — hands remembered before the brain did."
  "Local bakery put sourdough back on the menu after a two-year hiatus. The queue wrapped around the block by 7am."
)
declare -a POSTS_2=(
  "Evening light on the cobblestones here is something else. Same street I've walked a thousand times, still catches me off guard."
  "Spent the afternoon in a tiny gallery tucked behind a church. Three rooms, twelve paintings. One of the best exhibitions I've seen."
  "Made cacio e pepe for the first time without the sauce breaking. Small victory but I'll take it."
  "Running the Tiber path at dawn before the city wakes up — this is why I moved here."
)
declare -a POSTS_3=(
  "Street food at the night market tonight: bánh mì, sugarcane juice, and something I couldn't identify but ate anyway. Perfect evening."
  "Rain season just started. The smell of wet asphalt and jasmine is one of those scents you can't describe but never forget."
  "Found a café that opens at 5am and plays no music. Just the sound of coffee machines and rain. My new office."
  "Took the long way home on my motorbike. Sometimes the detour is the point."
)
declare -a POSTS_4=(
  "Swam at sunrise in a cove I found on the map. Completely empty. Water so clear I could count the pebbles 4 metres down."
  "Spotted a pod of dolphins from the coastal path this morning. Spent twenty minutes just watching them."
  "Beach BBQ with neighbours — someone brought a guitar, someone else brought way too much halloumi. No complaints."
  "Finally got around to learning to surf. Day one: mostly paddling. Day one is not the day to judge."
)
declare -a POSTS_5=(
  "Mercado de San Miguel at opening time before the tour groups arrive — completely different energy. Worth the early alarm."
  "Flamenco show in a tiny venue last night. Forty seats. The performance was about three metres from my face. Unforgettable."
  "Made a proper tortilla española today — thick, eggy, barely set in the middle. It took four attempts. This one nailed it."
  "Walked the entire length of the city walls this morning. Every corner has a different century in it."
)
declare -a POSTS_6=(
  "Cycling the canal path to the forest before rush hour. Cold air, no cars, just the sound of tyres on wet leaves."
  "Found a concept store in Mitte with an entire floor of architecture books. Went in for five minutes. Left two hours later."
  "Currywurst at the legendary stand in Tempelhof after midnight. Some rituals are non-negotiable."
  "Street art walk through Kreuzberg — pieces I've walked past a hundred times suddenly look completely different at night."
)
declare -a POSTS_7=(
  "Sencha in a 200-year-old teahouse in Yanaka. The neighbourhood feels like Tokyo paused here on purpose."
  "Caught the sakura just before peak — slightly early, no crowds. Next week will be chaos. Glad I went today."
  "Ramen at 11pm in a six-seat place with no English menu. Pointed at the photo. Best decision of the trip."
  "Found a used record shop in Shimokitazawa with entire crates of city-pop from the 80s. Spent way too much."
)
declare -a POSTS_8=(
  "Monsoon hit properly today. Spent the afternoon coding to the sound of rain hammering a tin roof. Peak productivity."
  "Filter coffee at a third-wave roastery in Indiranagar — they grew the beans, roasted them on-site, explained every step. Worth every rupee."
  "Bangalore traffic at 6am vs 8am is two completely different cities. Chose wisely this morning."
  "Found a tiny gallery in Koramangala showing work from local photographers. Every frame had a story I needed to hear."
)
declare -a POSTS_9=(
  "Cycling along the harbour in November — everyone else stayed home. Got the whole waterfront to myself."
  "Open-face smørrebrød lunch followed by an accidental three-hour canal walk. This city refuses to let you rush."
  "Local jazz bar on a Wednesday night: five people in the audience, six in the band. The best kind of ratio."
  "Stumbled into a flea market near Nørrebro — left with a Danish lamp from 1967 and no regrets whatsoever."
)

# ── Comments ──────────────────────────────────────────────────────────────────

declare -a COMMENTS=(
  "This is exactly the kind of post I needed to see today."
  "That sounds absolutely amazing, I need to try this."
  "Been here too — the vibe is unreal at that time of day."
  "Following for the local recommendations, please keep posting."
  "How long did it take you to get there? Worth the commute?"
  "This made my morning, thank you for sharing it."
  "I've walked past this a hundred times and never noticed. Going this weekend."
  "The detail in this post is incredible. You should write more often."
  "Same experience here last month — the timing really does matter."
  "Genuinely jealous, this looks like a perfect afternoon."
  "Peak hours ruin everything. You made the right call going early."
  "This is why I follow people on Nearrish. Real finds, not tourist traps."
)

# ── Helpers ───────────────────────────────────────────────────────────────────

register_user() {
  local username="$1" email="$2" password="$3" name="$4" address="$5"
  local body
  body=$(printf '{"username":"%s","email":"%s","password":"%s","name":"%s","nickname":"%s","address":"%s"}' \
    "$username" "$email" "$password" "$name" "$username" "$address")
  curl -sf -X POST "$API/api/auth/registration" \
    -H "Content-Type: application/json" \
    -d "$body" 2>/dev/null || echo '{"success":false}'
}

login_user() {
  local username="$1" password="$2"
  local body
  body=$(printf '{"username":"%s","password":"%s"}' "$username" "$password")
  curl -sf -X POST "$API/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "$body" 2>/dev/null || echo '{}'
}

create_post() {
  local token="$1" text="$2" lat="${3:-}" lng="${4:-}"
  local url="$API/api/posts"
  if [ -n "$lat" ] && [ -n "$lng" ]; then
    curl -sf -X POST "$url" \
      -H "AUTH: $token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      --data-urlencode "text=$text" \
      --data-urlencode "latitude=$lat" \
      --data-urlencode "longitude=$lng" \
      --data-urlencode "visibility=PUBLIC" 2>/dev/null || echo '{}'
  else
    curl -sf -X POST "$url" \
      -H "AUTH: $token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      --data-urlencode "text=$text" \
      --data-urlencode "visibility=PUBLIC" 2>/dev/null || echo '{}'
  fi
}

add_comment() {
  local token="$1" post_id="$2" content="$3"
  local body
  body=$(printf '{"content":"%s"}' "$content")
  curl -sf -X POST "$API/api/posts/$post_id/comments" \
    -H "AUTH: $token" \
    -H "Content-Type: application/json" \
    -d "$body" 2>/dev/null || echo '{}'
}

like_post() {
  local token="$1" post_id="$2"
  curl -sf -X POST "$API/api/posts/$post_id/like" \
    -H "AUTH: $token" 2>/dev/null || true
}

extract_json() {
  # Minimal JSON field extractor without jq dependency
  local json="$1" field="$2"
  echo "$json" | grep -o "\"${field}\":\"[^\"]*\"" | head -1 | sed "s/\"${field}\":\"//;s/\"//"
}

# ── Geo coordinates (one geo post per user) ──────────────────────────────────
# Realistic city coordinates matching the user profiles above

declare -a GEO_LAT=(48.8566  55.9533  41.9028  10.8231 -33.8688  40.4168  52.5200  35.6762  12.9716  55.6761)
declare -a GEO_LNG=( 2.3522  -3.1883  12.4964 106.6297 151.2093  -3.7038  13.4050 139.6503  77.5946  12.5683)

# ── Main ──────────────────────────────────────────────────────────────────────

declare -a TOKENS=()
declare -a POST_IDS=()

log "Registering 10 users..."
for i in "${!USER_DEFS[@]}"; do
  IFS=':' read -r username email password name address <<< "${USER_DEFS[$i]}"
  resp=$(register_user "$username" "$email" "$password" "$name" "$address")
  token=$(extract_json "$resp" "token")

  if [ -z "$token" ]; then
    # Already exists — try login
    warn "  $username already exists, logging in..."
    resp=$(login_user "$username" "$password")
    token=$(extract_json "$resp" "token")
  fi

  if [ -z "$token" ]; then
    fail "Could not register or login as $username"
  fi

  TOKENS[$i]="$token"
  ok "  [$((i+1))/10] $username — ready"
done

log "Creating 4 posts per user..."
for i in "${!USER_DEFS[@]}"; do
  IFS=':' read -r username _ _ _ _ <<< "${USER_DEFS[$i]}"
  token="${TOKENS[$i]}"
  posts_var="POSTS_${i}[@]"
  posts=("${!posts_var}")

  for j in "${!posts[@]}"; do
    text="${posts[$j]}"
    if [ "$j" -eq 2 ]; then
      # Third post gets geo coordinates
      resp=$(create_post "$token" "$text" "${GEO_LAT[$i]}" "${GEO_LNG[$i]}")
    else
      resp=$(create_post "$token" "$text")
    fi
    post_id=$(extract_json "$resp" "id")
    if [ -n "$post_id" ]; then
      POST_IDS+=("$post_id")
    fi
  done
  ok "  4 posts created for $username"
done

TOTAL_POSTS=${#POST_IDS[@]}
log "Created $TOTAL_POSTS posts total. Adding comments and likes..."

# ── Cross-comments: each user comments on 6 random posts from other users ─────

for i in "${!TOKENS[@]}"; do
  token="${TOKENS[$i]}"
  # Comment on posts at offset positions relative to this user's own posts
  # to ensure cross-user interaction (skip posts i*4 .. i*4+3)
  commented=0
  for offset in 3 7 12 18 25 33; do
    idx=$(( (i * 4 + offset) % TOTAL_POSTS ))
    post_id="${POST_IDS[$idx]}"
    comment_text="${COMMENTS[$(( (i + offset) % ${#COMMENTS[@]} ))]}"
    add_comment "$token" "$post_id" "$comment_text" > /dev/null
    commented=$((commented + 1))
  done
done
ok "  Comments added."

# ── Cross-likes: each user likes ~8 posts from other users ───────────────────

for i in "${!TOKENS[@]}"; do
  token="${TOKENS[$i]}"
  for offset in 1 5 9 14 20 28 35 38; do
    idx=$(( (i * 4 + offset) % TOTAL_POSTS ))
    post_id="${POST_IDS[$idx]}"
    like_post "$token" "$post_id"
  done
done
ok "  Likes added."

echo ""
ok "Mock data injected successfully!"
echo -e "  ${CYAN}→${NC} 10 users registered"
echo -e "  ${CYAN}→${NC} $TOTAL_POSTS posts created (with geo coordinates on one post per user)"
echo -e "  ${CYAN}→${NC} Cross-user comments and likes applied"
echo -e "  ${CYAN}→${NC} Password for all mock users: ${YELLOW}MockPass<N>!${NC} (e.g. MockPass1! for alex_nearrish)"
