"""
process.py — Clean and enrich raw scraped data
Reads raw_products.json + raw_reviews.json → writes cleaned_products.json + cleaned_reviews.json

Usage:  python process.py
"""

import json
import re
import logging
import sys
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s",
                    handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger(__name__)

RAW_PRODUCTS  = "../data/raw_products.json"
RAW_REVIEWS   = "../data/raw_reviews.json"
OUT_PRODUCTS  = "../data/cleaned_products.json"
OUT_REVIEWS   = "../data/cleaned_reviews.json"
OUT_PRODUCTS_CSV = "../data/cleaned_products.csv"
OUT_REVIEWS_CSV  = "../data/cleaned_reviews.csv"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_date(raw: str) -> str | None:
    """Parse Amazon date strings like 'Reviewed in India on 12 March 2024'."""
    m = re.search(r"(\d{1,2}\s+\w+\s+\d{4})", raw)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%d %B %Y").date().isoformat()
    except ValueError:
        return None


def price_band(price: float | None) -> str:
    if price is None:
        return "Unknown"
    if price < 2000:
        return "Budget (<₹2k)"
    if price < 4000:
        return "Value (₹2k–4k)"
    if price < 7000:
        return "Mid (₹4k–7k)"
    if price < 12000:
        return "Premium (₹7k–12k)"
    return "Luxury (₹12k+)"


def clean_text(text: str) -> str:
    """Strip extra whitespace and non-printable chars."""
    return re.sub(r"\s+", " ", text).strip()


# ---------------------------------------------------------------------------
# Product cleaning
# ---------------------------------------------------------------------------

def clean_products(raw: list[dict]) -> list[dict]:
    seen_asins: set[str] = set()
    cleaned = []

    for p in raw:
        asin = p.get("asin", "").strip()
        if not asin or asin in seen_asins:
            continue
        seen_asins.add(asin)

        price      = p.get("price")
        list_price = p.get("list_price")
        rating     = p.get("rating")
        rev_count  = p.get("review_count")

        # Sanity-check price: must be positive and < ₹1,00,000
        if price and (price <= 0 or price > 100000):
            price = None
        if list_price and (list_price <= 0 or list_price > 100000):
            list_price = None

        # Recalculate discount
        discount_pct = 0.0
        if price and list_price and list_price > price:
            discount_pct = round((list_price - price) / list_price * 100, 1)

        # Sanity-check rating
        if rating and (rating < 1 or rating > 5):
            rating = None

        cleaned.append({
            "asin":         asin,
            "brand":        p.get("brand", "Unknown").strip(),
            "title":        clean_text(p.get("title", "")),
            "url":          p.get("url", ""),
            "price":        price,
            "list_price":   list_price,
            "discount_pct": discount_pct,
            "rating":       rating,
            "review_count": rev_count,
            "category":     p.get("category", "Other"),
            "price_band":   price_band(price),
            "bullets":      [clean_text(b) for b in p.get("bullets", []) if b.strip()],
            "scraped_at":   p.get("scraped_at", ""),
        })

    log.info(f"Products: {len(raw)} raw → {len(cleaned)} clean (deduped)")
    return cleaned


# ---------------------------------------------------------------------------
# Review cleaning
# ---------------------------------------------------------------------------

def clean_reviews(raw: list[dict]) -> list[dict]:
    cleaned = []

    for r in raw:
        body = clean_text(r.get("body", ""))
        if len(body) < 10:          # skip empty / very short reviews
            continue

        rating = r.get("rating")
        if rating and (rating < 1 or rating > 5):
            rating = None

        cleaned.append({
            "asin":          r.get("asin", ""),
            "brand":         r.get("brand", "Unknown").strip(),
            "product_title": clean_text(r.get("product_title", "")),
            "rating":        rating,
            "title":         clean_text(r.get("title", "")),
            "body":          body,
            "date":          parse_date(r.get("date_raw", "")),
            "helpful":       r.get("helpful", ""),
            "verified":      bool(r.get("verified", False)),
            "scraped_at":    r.get("scraped_at", ""),
        })

    log.info(f"Reviews: {len(raw)} raw → {len(cleaned)} clean")
    return cleaned


# ---------------------------------------------------------------------------
# CSV export
# ---------------------------------------------------------------------------

def write_csv(data: list[dict], path: str) -> None:
    import csv
    if not data:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        for row in data:
            # Flatten lists to semicolon-separated strings for CSV
            flat = {
                k: ("; ".join(v) if isinstance(v, list) else v)
                for k, v in row.items()
            }
            writer.writerow(flat)
    log.info(f"CSV written: {path}")


# ---------------------------------------------------------------------------
# Summary stats
# ---------------------------------------------------------------------------

def print_summary(products: list[dict], reviews: list[dict]) -> None:
    from collections import defaultdict

    log.info("\n" + "="*60)
    log.info("DATA SUMMARY")
    log.info("="*60)

    brand_products: dict[str, list] = defaultdict(list)
    brand_reviews:  dict[str, list] = defaultdict(list)

    for p in products:
        brand_products[p["brand"]].append(p)
    for r in reviews:
        brand_reviews[r["brand"]].append(r)

    for brand in sorted(brand_products.keys()):
        bp = brand_products[brand]
        br = brand_reviews[brand]
        prices  = [p["price"] for p in bp if p["price"]]
        ratings = [p["rating"] for p in bp if p["rating"]]
        discounts = [p["discount_pct"] for p in bp]
        rev_ratings = [r["rating"] for r in br if r["rating"]]

        avg_price    = sum(prices) / len(prices) if prices else 0
        avg_rating   = sum(ratings) / len(ratings) if ratings else 0
        avg_discount = sum(discounts) / len(discounts) if discounts else 0
        avg_rev_rat  = sum(rev_ratings) / len(rev_ratings) if rev_ratings else 0

        log.info(f"\n  {brand}")
        log.info(f"    Products : {len(bp)} | Avg price: ₹{avg_price:,.0f} | Avg discount: {avg_discount:.1f}%")
        log.info(f"    Reviews  : {len(br)} | Avg product rating: {avg_rating:.2f}★ | Avg review rating: {avg_rev_rat:.2f}★")

    log.info("\n" + "="*60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    Path("../data").mkdir(exist_ok=True)

    # Load raw data
    with open(RAW_PRODUCTS) as f:
        raw_products = json.load(f)
    with open(RAW_REVIEWS, encoding="utf-8") as f:
        raw_reviews = json.load(f)

    # Clean
    products = clean_products(raw_products)
    reviews  = clean_reviews(raw_reviews)

    # Save JSON
    with open(OUT_PRODUCTS, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
    log.info(f"Saved: {OUT_PRODUCTS}")

    with open(OUT_REVIEWS, "w", encoding="utf-8") as f:
        json.dump(reviews, f, indent=2, ensure_ascii=False)
    log.info(f"Saved: {OUT_REVIEWS}")

    # Save CSV
    write_csv(products, OUT_PRODUCTS_CSV)
    write_csv(reviews,  OUT_REVIEWS_CSV)

    # Print summary
    print_summary(products, reviews)


if __name__ == "__main__":
    main()