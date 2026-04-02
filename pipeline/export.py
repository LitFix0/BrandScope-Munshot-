"""
export.py — Produce the final dashboard-ready JSON bundle
Merges brand_summary + per-product data + review samples into one file
the React dashboard reads.

Usage:  python export.py
"""

import json
import logging
import sys
import random
from pathlib import Path
from collections import defaultdict

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s",
                    handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger(__name__)

BRAND_SUMMARY   = "../data/brand_summary.json"
SENTIMENT_FILE  = "../data/sentiment_scores.json"
PRODUCTS_FILE   = "../data/cleaned_products.json"
OUT_DASHBOARD   = "../data/dashboard_data.json"


def load(path: str) -> list | dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def pick_review_samples(reviews: list[dict], n_pos=3, n_neg=3) -> list[dict]:
    """Return a small curated set of representative reviews."""
    positives = [r for r in reviews if r.get("vader_label") == "positive" and len(r.get("body","")) > 60]
    negatives = [r for r in reviews if r.get("vader_label") == "negative" and len(r.get("body","")) > 60]
    random.shuffle(positives)
    random.shuffle(negatives)
    samples = positives[:n_pos] + negatives[:n_neg]
    return [
        {"rating": r["rating"], "title": r["title"], "body": r["body"][:400],
         "verified": r["verified"], "date": r["date"], "sentiment": r["vader_label"]}
        for r in samples
    ]


def compute_value_score(brand: dict) -> float:
    """
    Composite value score: normalise sentiment + rating, then penalise by price band.
    Range 0–10.
    """
    vader  = brand.get("avg_vader_score") or 0      # -1 to +1
    rating = brand.get("avg_review_rating") or brand.get("avg_product_rating") or 3  # 1–5
    price  = brand.get("avg_price") or 5000

    norm_vader  = (vader + 1) / 2          # 0–1
    norm_rating = (rating - 1) / 4        # 0–1
    sentiment   = (norm_vader + norm_rating) / 2   # 0–1

    # Price penalty: cheaper = better value
    if price < 2000:   price_factor = 1.0
    elif price < 4000: price_factor = 0.85
    elif price < 7000: price_factor = 0.70
    elif price < 12000: price_factor = 0.55
    else:              price_factor = 0.40

    return round(sentiment * price_factor * 10, 2)


def main():
    brand_summary = load(BRAND_SUMMARY)
    sentiment_reviews = load(SENTIMENT_FILE)
    products = load(PRODUCTS_FILE)

    # Index reviews by brand
    reviews_by_brand: dict[str, list] = defaultdict(list)
    for r in sentiment_reviews:
        reviews_by_brand[r["brand"]].append(r)

    # Index products by ASIN
    products_by_asin: dict[str, dict] = {p["asin"]: p for p in products}

    # Build enriched brand entries
    enriched_brands = []
    for brand_data in brand_summary:
        brand = brand_data["brand"]
        br = reviews_by_brand.get(brand, [])

        brand_data["value_score"] = compute_value_score(brand_data)
        brand_data["review_samples"] = pick_review_samples(br)

        # Add per-product review samples + sentiment
        enriched_products = []
        for p in brand_data.get("products", []):
            asin = p["asin"]
            prod_reviews = [r for r in br if r.get("asin") == asin]
            vader_scores = [r["vader_compound"] for r in prod_reviews if r.get("vader_compound") is not None]
            avg_vader = round(sum(vader_scores) / len(vader_scores), 3) if vader_scores else None
            enriched_products.append({
                **p,
                "avg_vader_score":  avg_vader,
                "review_samples":   pick_review_samples(prod_reviews, 2, 2),
                "review_count_scraped": len(prod_reviews),
            })

        brand_data["products"] = enriched_products
        # Remove the raw "aspects" key if it's defaultdict-derived noise
        if "aspects" in brand_data:
            del brand_data["aspects"]

        enriched_brands.append(brand_data)

    # Global stats
    all_prices  = [b["avg_price"]  for b in enriched_brands if b.get("avg_price")]
    all_ratings = [b["avg_product_rating"] for b in enriched_brands if b.get("avg_product_rating")]

    dashboard_payload = {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "meta": {
            "total_brands":   len(enriched_brands),
            "total_products": sum(b["product_count"] for b in enriched_brands),
            "total_reviews":  len(sentiment_reviews),
            "avg_price_all_brands":  round(sum(all_prices)  / len(all_prices),  2) if all_prices  else None,
            "avg_rating_all_brands": round(sum(all_ratings) / len(all_ratings), 2) if all_ratings else None,
        },
        "brands": enriched_brands,
    }

    with open(OUT_DASHBOARD, "w", encoding="utf-8") as f:
        json.dump(dashboard_payload, f, indent=2, ensure_ascii=False)

    log.info(f"Dashboard bundle written: {OUT_DASHBOARD}")
    log.info(f"  Brands   : {dashboard_payload['meta']['total_brands']}")
    log.info(f"  Products : {dashboard_payload['meta']['total_products']}")
    log.info(f"  Reviews  : {dashboard_payload['meta']['total_reviews']}")
    log.info("\nAll done! Move dashboard_data.json to dashboard/src/data/ and run the React app.")


if __name__ == "__main__":
    main()