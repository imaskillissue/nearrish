"""Sentiment + topic unit tests — calls the real LLM via the running service.

Setup:
    pip install -r requirements-dev.txt

Run:
    pytest test_sentiment_unit.py -v
    (moderation service must be running on :8001 — use `make up` or `docker compose up`)
"""
import json
import urllib.request
import pytest
from main import _parse_topic

BASE = "http://localhost:8001"


class TestParseTopic:
    def test_third_token(self):
        assert _parse_topic("0 positive basketball") == "basketball"

    def test_two_word_topic(self):
        assert _parse_topic("3 negative hate speech") == "hate speech"

    def test_no_topic_returns_general(self):
        assert _parse_topic("0 positive") == "general"

    def test_empty_returns_general(self):
        assert _parse_topic("") == "general"

    def test_digit_only(self):
        assert _parse_topic("0") == "general"

    def test_case_insensitive(self):
        assert _parse_topic("0 POSITIVE BASKETBALL") == "basketball"

    def test_strips_punctuation(self):
        assert _parse_topic("0 neutral cooking.") == "cooking"


def moderate(content: str) -> dict:
    data = json.dumps({"content": content}).encode()
    req = urllib.request.Request(
        f"{BASE}/moderate",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        result = json.loads(r.read())
    print(f"\n  IN : {content!r}")
    print(f"  OUT: severity={result.get('severity')} sentiment={result.get('sentiment')!r} topic={result.get('topic')!r} category={result.get('category')!r}")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Positive sentiment
# ─────────────────────────────────────────────────────────────────────────────

class TestPositiveSentiment:
    def test_happy_greeting(self):
        r = moderate("Good morning everyone! Hope you all have a wonderful day!")
        assert r["sentiment"] == "positive", f"got {r['sentiment']!r}"

    def test_celebration(self):
        r = moderate("Just got promoted at work, I'm so excited and grateful!")
        assert r["sentiment"] == "positive", f"got {r['sentiment']!r}"

    def test_supportive_message(self):
        r = moderate("You're doing amazing, keep going — we're all rooting for you!")
        assert r["sentiment"] == "positive", f"got {r['sentiment']!r}"


# ─────────────────────────────────────────────────────────────────────────────
# Negative sentiment
# ─────────────────────────────────────────────────────────────────────────────

class TestNegativeSentiment:
    def test_frustration(self):
        r = moderate("I'm so frustrated and angry, nothing is going right today.")
        assert r["sentiment"] == "negative", f"got {r['sentiment']!r}"

    def test_sadness(self):
        r = moderate("Feeling really sad and hopeless, I don't know what to do anymore.")
        assert r["sentiment"] == "negative", f"got {r['sentiment']!r}"

    def test_hostile_complaint(self):
        r = moderate("This service is absolutely terrible, I hate everything about it.")
        assert r["sentiment"] == "negative", f"got {r['sentiment']!r}"


# ─────────────────────────────────────────────────────────────────────────────
# Neutral sentiment
# ─────────────────────────────────────────────────────────────────────────────

class TestNeutralSentiment:
    def test_factual_statement(self):
        r = moderate("The meeting is scheduled for Thursday at 3pm.")
        assert r["sentiment"] == "neutral", f"got {r['sentiment']!r}"

    def test_informational_post(self):
        r = moderate("New study shows average commute time increased by 12% last year.")
        assert r["sentiment"] == "neutral", f"got {r['sentiment']!r}"

    def test_question(self):
        r = moderate("Does anyone know the opening hours of the library?")
        assert r["sentiment"] == "neutral", f"got {r['sentiment']!r}"


# ─────────────────────────────────────────────────────────────────────────────
# Sentiment is independent of toxicity
# ─────────────────────────────────────────────────────────────────────────────

class TestSentimentIndependentOfToxicity:
    def test_toxic_content_is_negative(self):
        r = moderate("I hate you and everyone like you, go die.")
        assert r["sentiment"] == "negative", f"got {r['sentiment']!r}"
        assert r["severity"] >= 3

    def test_clean_content_can_be_positive(self):
        r = moderate("This is the best community I've ever been part of, love you all!")
        assert r["sentiment"] == "positive", f"got {r['sentiment']!r}"
        assert r["severity"] == 0

    def test_sentiment_field_always_present(self):
        r = moderate("Just a normal post about my day.")
        assert "sentiment" in r
        assert r["sentiment"] in ("positive", "neutral", "negative")

    def test_topic_field_always_present(self):
        r = moderate("Just had the best basketball game of my life!")
        assert "topic" in r
        assert isinstance(r["topic"], str)
        assert len(r["topic"]) > 0


# ─────────────────────────────────────────────────────────────────────────────
# Obvious topics — single clear subject, assert topic keyword is present
# ─────────────────────────────────────────────────────────────────────────────

class TestObviousTopics:
    def test_basketball(self):
        r = moderate("LeBron James had an incredible game last night, 40 points and 12 assists!")
        assert "topic" in r
        assert "basketball" in r["topic"].lower(), f"expected 'basketball' in topic, got {r['topic']!r}"

    def test_cooking(self):
        r = moderate("I made the most amazing pasta carbonara tonight, the egg yolk sauce was perfect.")
        assert "topic" in r
        assert "cook" in r["topic"].lower() or "food" in r["topic"].lower() or "pasta" in r["topic"].lower(), \
            f"expected food/cooking topic, got {r['topic']!r}"

    def test_travel(self):
        r = moderate("Just landed in Tokyo for the first time, the city is absolutely breathtaking!")
        assert "topic" in r
        assert "travel" in r["topic"].lower() or "tokyo" in r["topic"].lower() or "japan" in r["topic"].lower(), \
            f"expected travel/tokyo topic, got {r['topic']!r}"

    def test_gaming(self):
        r = moderate("Finally beat the final boss after 3 hours, this video game is incredible!")
        assert "topic" in r
        assert "gaming" in r["topic"].lower() or "game" in r["topic"].lower(), \
            f"expected gaming topic, got {r['topic']!r}"

    def test_music(self):
        r = moderate("Went to a live concert last night, the band played for three hours straight.")
        assert "topic" in r
        assert "music" in r["topic"].lower() or "concert" in r["topic"].lower(), \
            f"expected music/concert topic, got {r['topic']!r}"


# ─────────────────────────────────────────────────────────────────────────────
# Toxic topics — hateful content, assert both topic label and high severity
# ─────────────────────────────────────────────────────────────────────────────

class TestToxicTopics:
    def test_racism_topic_and_severity(self):
        r = moderate("People of that race are all criminals and should be deported.")
        assert r["severity"] >= 3, f"expected severity >= 3, got {r['severity']}"
        assert "topic" in r
        assert "racism" in r["topic"].lower() or "race" in r["topic"].lower() or "hate" in r["topic"].lower(), \
            f"expected racism/hate topic, got {r['topic']!r}"

    def test_sexism_topic_and_severity(self):
        r = moderate("Women are too emotional to be leaders, they belong in the kitchen.")
        assert r["severity"] >= 2, f"expected severity >= 2, got {r['severity']}"
        assert "topic" in r
        assert "sexism" in r["topic"].lower() or "gender" in r["topic"].lower() or "women" in r["topic"].lower(), \
            f"expected sexism/gender topic, got {r['topic']!r}"

    def test_harassment_topic_and_severity(self):
        r = moderate("I know where you live, I will come after you and make you regret this.")
        assert r["severity"] >= 3, f"expected severity >= 3, got {r['severity']}"
        assert "topic" in r
        assert "harassment" in r["topic"].lower() or "threat" in r["topic"].lower(), \
            f"expected harassment/threat topic, got {r['topic']!r}"

    def test_hate_speech_and_severity(self):
        r = moderate("That religious group is a plague on society and should be eliminated.")
        assert r["severity"] >= 3, f"expected severity >= 3, got {r['severity']}"
        assert "topic" in r
        assert any(w in r["topic"].lower() for w in ("hate", "religion", "racism", "discrimination")), \
            f"expected hate/religion/racism topic, got {r['topic']!r}"


# ─────────────────────────────────────────────────────────────────────────────
# Tricky topics — ambiguous or mixed content, print output only, no topic assert
# ─────────────────────────────────────────────────────────────────────────────

class TestTrickyTopics:
    """These tests only print — topic is ambiguous. Inspect output manually."""

    def test_sarcasm(self):
        # Sarcasm: positive words, negative intent
        r = moderate("Oh great, another Monday. Can't wait to sit in traffic for two hours again.")
        # no assert on topic — check printed output

    def test_mixed_subject(self):
        # Cooking + politics mixed together
        r = moderate("The president's new economic policy is like a half-baked soufflé — looks fine on the outside but collapses immediately.")
        # LLM must choose one dominant topic

    def test_sports_metaphor_in_business(self):
        # Sports language in a business context
        r = moderate("Our sales team knocked it out of the park this quarter, a real home run for the company.")
        # Should it say 'sports' or 'business'?

    def test_dark_humour(self):
        # Morbid joke — high severity risk but likely clean
        r = moderate("My cooking is so bad my smoke detector cheers me on.")
        # Should be clean/neutral, topic likely cooking or humour

    def test_news_headline_style(self):
        # Could be politics, economy, or news
        r = moderate("Government announces new budget cuts affecting healthcare and education sectors.")
        # Topic could be politics, economy, healthcare, education
