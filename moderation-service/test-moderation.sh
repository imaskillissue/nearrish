#!/bin/bash

# Test Script for Moderation Service
# Tests various content types and severity levels

BASE_URL="http://localhost:5001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Moderation Service Test Suite"
echo "========================================="
echo ""

# Function to test moderation
test_moderation() {
    local test_name="$1"
    local content="$2"
    local expected_severity="$3"
    
    echo -e "${YELLOW}Testing: $test_name${NC}"
    echo "Content: $content"
    
    response=$(curl -s -X POST "$BASE_URL/moderate" \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"$content\", \"user_id\": \"test_user\", \"content_type\": \"post\"}")
    
    severity=$(echo "$response" | grep -o '"severity":[0-9]*' | cut -d':' -f2)
    category=$(echo "$response" | grep -o '"category":"[^"]*' | cut -d'"' -f4)
    is_blocked=$(echo "$response" | grep -o '"is_blocked":[a-z]*' | cut -d':' -f2)
    model_used=$(echo "$response" | grep -o '"model_used":"[^"]*' | cut -d'"' -f4)
    
    echo "  Severity: $severity (expected: $expected_severity)"
    echo "  Category: $category"
    echo "  Blocked: $is_blocked"
    echo "  Model: $model_used"
    
    if [ "$severity" == "$expected_severity" ] || [ -z "$expected_severity" ]; then
        echo -e "  ${GREEN}✓ PASS${NC}"
    else
        echo -e "  ${RED}✗ FAIL${NC}"
    fi
    
    echo ""
}

# Check if service is running
echo "Checking service health..."
health=$(curl -s "$BASE_URL/health")
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Moderation service is not running!${NC}"
    echo "Please start it with: docker-compose up -d"
    exit 1
fi
echo -e "${GREEN}✓ Service is healthy${NC}"
echo ""

# Test cases
echo "Running test cases..."
echo ""

# Clean content (severity 0)
test_moderation "Clean Content" \
    "Hello everyone! Having a great day. Hope you all are doing well too!" \
    "0"

test_moderation "Positive Message" \
    "Just wanted to say thank you to everyone in this community. You're all amazing!" \
    "0"

# Mild profanity (severity 2-3)
test_moderation "Mild Profanity" \
    "This is damn cool! Really freaking awesome stuff." \
    "3"

# Spam (severity 5-6)
test_moderation "Spam Content" \
    "BUY NOW!!! CLICK HERE FOR AMAZING DEALS!!! LIMITED TIME OFFER!!!" \
    "5"

test_moderation "Crypto Scam" \
    "Get rich quick with this one weird trick! Invest in crypto now and make millions!" \
    "5"

# Harassment (severity 7-8)
test_moderation "Personal Attack" \
    "You're such an idiot. Everyone hates you. Just leave already." \
    "8"

# Test cache functionality
echo -e "${YELLOW}Testing Cache (2nd request should be cache hit)${NC}"
echo "Content: Hello world"

# First request
response1=$(curl -s -X POST "$BASE_URL/moderate" \
    -H "Content-Type: application/json" \
    -d '{"content": "Hello world", "user_id": "test_user"}')
cache_hit1=$(echo "$response1" | grep -o '"cache_hit":[a-z]*' | cut -d':' -f2)
echo "  First request - Cache hit: $cache_hit1 (expected: false)"

# Second request (should hit cache)
response2=$(curl -s -X POST "$BASE_URL/moderate" \
    -H "Content-Type: application/json" \
    -d '{"content": "Hello world", "user_id": "test_user"}')
cache_hit2=$(echo "$response2" | grep -o '"cache_hit":[a-z]*' | cut -d':' -f2)
echo "  Second request - Cache hit: $cache_hit2 (expected: true)"

if [ "$cache_hit2" == "true" ]; then
    echo -e "  ${GREEN}✓ Cache working correctly${NC}"
else
    echo -e "  ${RED}✗ Cache not working${NC}"
fi
echo ""

# Test stats endpoint
echo -e "${YELLOW}Fetching Stats${NC}"
stats=$(curl -s "$BASE_URL/stats")
echo "$stats" | python3 -m json.tool 2>/dev/null || echo "$stats"
echo ""

# Test config endpoint
echo -e "${YELLOW}Fetching Configuration${NC}"
config=$(curl -s "$BASE_URL/config")
echo "$config" | python3 -m json.tool 2>/dev/null | head -20
echo "..."
echo ""

# Performance test
echo -e "${YELLOW}Performance Test (10 requests)${NC}"
start_time=$(date +%s%N)
for i in {1..10}; do
    curl -s -X POST "$BASE_URL/moderate" \
        -H "Content-Type: application/json" \
        -d '{"content": "Performance test message number '$i'"}' > /dev/null
done
end_time=$(date +%s%N)
elapsed=$(( (end_time - start_time) / 1000000 ))
avg=$(( elapsed / 10 ))

echo "  Total time: ${elapsed}ms"
echo "  Average: ${avg}ms per request"

if [ $avg -lt 500 ]; then
    echo -e "  ${GREEN}✓ Good performance${NC}"
elif [ $avg -lt 1000 ]; then
    echo -e "  ${YELLOW}⚠ Acceptable performance${NC}"
else
    echo -e "  ${RED}⚠ Slow performance - consider optimization${NC}"
fi
echo ""

echo "========================================="
echo "Test Suite Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Check logs: docker logs moderation-service"
echo "2. View log file: cat moderation-service/logs/moderation.jsonl"
echo "3. Monitor stats: curl $BASE_URL/stats"
echo ""
