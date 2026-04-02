"""
sentiment.py — Sentiment scoring + aspect-level theme extraction
Uses VADER for fast scoring + optionally calls an LLM for deep theme extraction.

Usage:
    python sentiment.py                  # full run (VADER + LLM themes)
    python sentiment.py --no-llm         # VADER only (fast, no API key needed)
"""

import json
import logging
import sys
import re
import argparse
from collections import defaultdict
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s",
                    handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger(__name__)

CLEANED_REVIEWS  = "../data/cleaned_reviews.json"
OUT_SENTIMENT    = "../data/sentiment_scores.json"
OUT_THEMES       = "../data/themes.json"
OUT_BRAND_SUMMARY = "../data/brand_summary.json"


# ---------------------------------------------------------------------------
# VADER sentiment (no API key required)
# ---------------------------------------------------------------------------

def vader_score(text: str, sid) -> dict:
    scores = sid.polarity_scores(text)
    label = "positive" if scores["compound"] >= 0.05 else (
            "negative" if scores["compound"] <= -0.05 else "neutral")
    return {"compound": round(scores["compound"], 4), "label": label}


def run_vader(reviews: list[dict]) -> list[dict]:
    try:
        import nltk
        from nltk.sentiment.vader import SentimentIntensityAnalyzer
        nltk.download("vader_lexicon", quiet=True)
        sid = SentimentIntensityAnalyzer()
    except ImportError:
        log.error("NLTK not installed. Run: pip install nltk --break-system-packages")
        sys.exit(1)

    enriched = []
    for r in reviews:
        text = f"{r.get('title', '')} {r.get('body', '')}".strip()
        scores = vader_score(text, sid)
        enriched.append({**r, "vader_compound": scores["compound"], "vader_label": scores["label"]})

    log.info(f"VADER scored {len(enriched)} reviews")
    return enriched


# ---------------------------------------------------------------------------
# Aspect keywords — luggage-specific
# ---------------------------------------------------------------------------

ASPECTS = {
    "wheels":    ["wheel", "rolling", "rolls", "spinner", "castor", "wheeling", "smooth roll"],
    "handle":    ["handle", "trolley handle", "grip", "retractable", "telescopic", "extendable"],
    "zipper":    ["zipper", "zip", "zips", "closure", "lock", "tsa lock"],
    "material":  ["material", "fabric", "polycarbonate", "abs", "polypropylene", "hardshell",
                  "softside", "shell", "texture", "scratch", "durable", "strong", "quality"],
    "size":      ["size", "capacity", "spacious", "fits", "cabin", "check-in", "large", "small",
                  "medium", "inches", "litre", "liter"],
    "weight":    ["weight", "lightweight", "heavy", "light", "kg", "grams"],
    "price":     ["price", "value", "worth", "expensive", "cheap", "affordable", "money"],
    "delivery":  ["delivery", "shipping", "arrived", "packaging", "packed", "damaged in transit"],
    "customer_service": ["customer service", "support", "refund", "return", "exchange", "response"],
}

SENTIMENT_KEYWORDS = {
    "positive": ["good", "great", "excellent", "amazing", "love", "perfect", "best", "nice",
                 "awesome", "fantastic", "sturdy", "solid", "smooth", "easy", "happy",
                 "satisfied", "recommend", "worth", "quality"],
    "negative": ["bad", "poor", "worst", "broke", "broken", "damaged", "issue", "problem",
                 "complaint", "disappoint", "defect", "crack", "loose", "stuck", "cheap",
                 "flimsy", "terrible", "horrible", "waste", "regret", "return"],
}


def extract_aspect_mentions(text: str) -> dict[str, bool]:
    text_lower = text.lower()
    return {aspect: any(kw in text_lower for kw in kws) for aspect, kws in ASPECTS.items()}


def extract_simple_themes(reviews: list[dict]) -> dict[str, dict]:
    """
    Rule-based theme extraction. Groups reviews by brand and counts
    aspect mentions alongside positive/negative sentiment signals.
    """
    brand_data: dict[str, dict] = defaultdict(lambda: {
        "total": 0, "positive": 0, "negative": 0, "neutral": 0,
        "aspects": defaultdict(lambda: {"positive": 0, "negative": 0, "mentions": 0}),
        "top_complaints": defaultdict(int),
        "top_praises":    defaultdict(int),
    })

    for r in reviews:
        brand = r["brand"]
        text  = f"{r.get('title', '')} {r.get('body', '')}".lower()
        label = r.get("vader_label", "neutral")

        bd = brand_data[brand]
        bd["total"] += 1
        bd[label]   += 1

        aspects = extract_aspect_mentions(text)
        for aspect, mentioned in aspects.items():
            if not mentioned:
                continue
            bd["aspects"][aspect]["mentions"] += 1
            if label == "positive":
                bd["aspects"][aspect]["positive"] += 1
            elif label == "negative":
                bd["aspects"][aspect]["negative"] += 1

        # Build complaint/praise buckets
        is_neg = label == "negative"
        is_pos = label == "positive"
        for aspect, mentioned in aspects.items():
            if mentioned:
                if is_neg:
                    bd["top_complaints"][aspect] += 1
                elif is_pos:
                    bd["top_praises"][aspect] += 1

    # Serialize defaultdicts
    result = {}
    for brand, data in brand_data.items():
        total = max(data["total"], 1)
        result[brand] = {
            "total_reviews":    data["total"],
            "positive_count":   data["positive"],
            "negative_count":   data["negative"],
            "neutral_count":    data["neutral"],
            "sentiment_pct": {
                "positive": round(data["positive"] / total * 100, 1),
                "negative": round(data["negative"] / total * 100, 1),
                "neutral":  round(data["neutral"]  / total * 100, 1),
            },
            "aspects": {
                asp: dict(vals)
                for asp, vals in data["aspects"].items()
            },
            "top_complaints": sorted(data["top_complaints"].items(), key=lambda x: -x[1])[:5],
            "top_praises":    sorted(data["top_praises"].items(),    key=lambda x: -x[1])[:5],
        }

    return result


# ---------------------------------------------------------------------------
# LLM-powered theme extraction (optional — requires ANTHROPIC_API_KEY)
# ---------------------------------------------------------------------------

def run_llm_themes(reviews_by_brand: dict[str, list[dict]]) -> dict[str, dict]:
    """
    Call Claude to synthesize the top themes per brand from a random sample.
    Requires ANTHROPIC_API_KEY in environment.
    """
    import os
    import anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        log.warning("ANTHROPIC_API_KEY not set — skipping LLM theme extraction")
        return {}

    client = anthropic.Anthropic(api_key=api_key)
    llm_output = {}

    for brand, reviews in reviews_by_brand.items():
        # Sample up to 80 reviews to stay within context limits
        sample = reviews[:80]
        review_texts = "\n".join(
            f"[{r.get('vader_label','?').upper()}] ({r.get('rating','?')}★) {r.get('title','')} — {r.get('body','')[:250]}"
            for r in sample
        )

        prompt = f"""You are a product analyst. Analyse the following {len(sample)} Amazon India customer reviews for {brand} luggage and return a JSON object with:
- "summary": 2-3 sentence brand summary
- "top_praises": list of 5 specific recurring positives (be concrete: "smooth spinner wheels", not "good quality")
- "top_complaints": list of 5 specific recurring negatives
- "aspect_sentiment": dict with keys wheels, handle, zipper, material, size, weight — each with "sentiment" ("positive"/"negative"/"mixed"/"not mentioned") and "key_phrase"
- "non_obvious_insights": list of 3 surprising or non-obvious insights a decision-maker would want to know
- "value_verdict": one sentence on value-for-money perception

Return ONLY the JSON object, no markdown, no explanation.

REVIEWS:
{review_texts}"""

        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1200,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()
            # Strip possible markdown fences
            raw = re.sub(r"^```json\s*|```$", "", raw, flags=re.MULTILINE).strip()
            llm_output[brand] = json.loads(raw)
            log.info(f"LLM themes extracted for {brand}")
        except Exception as e:
            log.error(f"LLM error for {brand}: {e}")

    return llm_output


# ---------------------------------------------------------------------------
# Brand summary aggregator
# ---------------------------------------------------------------------------

def build_brand_summary(
    products: list[dict],
    reviews_enriched: list[dict],
    themes: dict[str, dict],
    llm_themes: dict[str, dict],
) -> list[dict]:
    from collections import defaultdict

    brand_products: dict[str, list] = defaultdict(list)
    brand_reviews:  dict[str, list] = defaultdict(list)

    for p in products:
        brand_products[p["brand"]].append(p)
    for r in reviews_enriched:
        brand_reviews[r["brand"]].append(r)

    summaries = []
    for brand in sorted(brand_products.keys()):
        bp = brand_products[brand]
        br = brand_reviews[brand]

        prices    = [p["price"]        for p in bp if p.get("price")]
        lp_list   = [p["list_price"]   for p in bp if p.get("list_price")]
        discounts = [p["discount_pct"] for p in bp if p.get("discount_pct") is not None]
        ratings   = [p["rating"]       for p in bp if p.get("rating")]
        rev_counts= [p["review_count"] for p in bp if p.get("review_count")]

        vader_scores = [r["vader_compound"] for r in br if r.get("vader_compound") is not None]
        rev_ratings  = [r["rating"]         for r in br if r.get("rating")]

        def avg(lst): return round(sum(lst) / len(lst), 2) if lst else None

        t = themes.get(brand, {})
        lt = llm_themes.get(brand, {})

        summaries.append({
            "brand":              brand,
            "product_count":      len(bp),
            "review_count":       len(br),
            "avg_price":          avg(prices),
            "min_price":          min(prices) if prices else None,
            "max_price":          max(prices) if prices else None,
            "avg_list_price":     avg(lp_list),
            "avg_discount_pct":   avg(discounts),
            "avg_product_rating": avg(ratings),
            "avg_review_rating":  avg(rev_ratings),
            "total_review_count": sum(rev_counts) if rev_counts else 0,
            "avg_vader_score":    avg(vader_scores),
            "sentiment_pct":      t.get("sentiment_pct", {}),
            "top_praises":        lt.get("top_praises") or [x[0] for x in t.get("top_praises", [])],
            "top_complaints":     lt.get("top_complaints") or [x[0] for x in t.get("top_complaints", [])],
            "aspect_sentiment":   lt.get("aspect_sentiment", t.get("aspects", {})),
            "brand_summary":      lt.get("summary", ""),
            "non_obvious_insights": lt.get("non_obvious_insights", []),
            "value_verdict":      lt.get("value_verdict", ""),
            "products":           bp,
        })

    return summaries


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-llm", action="store_true", help="Skip LLM theme extraction")
    args = parser.parse_args()

    # Install deps if needed
    try:
        import nltk
    except ImportError:
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "nltk", "--break-system-packages", "-q"])

    with open(CLEANED_REVIEWS, encoding="utf-8") as f:
        reviews = json.load(f)
    with open("../data/cleaned_products.json", encoding="utf-8") as f:
        products = json.load(f)

    log.info(f"Loaded {len(reviews)} reviews, {len(products)} products")

    # VADER scoring
    reviews_enriched = run_vader(reviews)

    with open(OUT_SENTIMENT, "w", encoding="utf-8") as f:
        json.dump(reviews_enriched, f, indent=2, ensure_ascii=False)
    log.info(f"Saved: {OUT_SENTIMENT}")

    # Rule-based themes
    themes = extract_simple_themes(reviews_enriched)
    with open(OUT_THEMES, "w", encoding="utf-8") as f:
        json.dump(themes, f, indent=2, ensure_ascii=False)
    log.info(f"Saved: {OUT_THEMES}")

    # Optional LLM themes
    llm_themes = {}
    if not args.no_llm:
        from collections import defaultdict
        reviews_by_brand: dict[str, list] = defaultdict(list)
        for r in reviews_enriched:
            reviews_by_brand[r["brand"]].append(r)
        llm_themes = run_llm_themes(dict(reviews_by_brand))

    # Brand summary
    brand_summary = build_brand_summary(products, reviews_enriched, themes, llm_themes)
    with open(OUT_BRAND_SUMMARY, "w", encoding="utf-8") as f:
        json.dump(brand_summary, f, indent=2, ensure_ascii=False)
    log.info(f"Saved: {OUT_BRAND_SUMMARY}")

    log.info("\nSentiment pipeline complete!")
    log.info(f"  Reviews scored : {len(reviews_enriched)}")
    log.info(f"  Brands covered : {len(brand_summary)}")


if __name__ == "__main__":
    main()