"""
scraper_playwright.py — Single unified Amazon India scraper using Playwright
Scrapes both product listings AND reviews directly. No API key needed.

Usage:
    python scraper_playwright.py
    python scraper_playwright.py --brands Safari VIP
    python scraper_playwright.py --resume
"""

import asyncio
import json
import logging
import random
import re
import sys
import argparse
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright, TimeoutError as PWTimeout

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("../data/scraper.log", mode="a", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BRANDS = [
    "Safari",
    "Skybags",
    "American Tourister",
    "VIP",
    "Aristocrat",
    "Nasher Miles",
]

PRODUCTS_PER_BRAND = 10
REVIEW_PAGES       = 6

RAW_PRODUCTS_FILE  = "../data/raw_products.json"
RAW_REVIEWS_FILE   = "../data/raw_reviews.json"

DELAY_PAGE         = (2.0, 4.0)
DELAY_PRODUCT      = (3.0, 5.0)
DELAY_BRAND        = (5.0, 8.0)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def extract_asin(url):
    m = re.search(r"/dp/([A-Z0-9]{10})", url)
    return m.group(1) if m else None


def clean_price(text):
    if not text:
        return None
    digits = re.sub(r"[^\d.]", "", text.replace(",", ""))
    try:
        return float(digits)
    except Exception:
        return None


def infer_category(title, breadcrumbs=""):
    text = (title + " " + breadcrumbs).lower()
    if any(w in text for w in ["cabin", "carry-on", "carry on", "55 cm", "56 cm", "20 inch"]):
        return "Cabin"
    if any(w in text for w in ["large", "75 cm", "76 cm", "78 cm", "28 inch"]):
        return "Check-in Large"
    if any(w in text for w in ["medium", "65 cm", "66 cm", "67 cm", "68 cm", "24 inch"]):
        return "Check-in Medium"
    if any(w in text for w in ["set of", "combo", "3 piece", "2 piece"]):
        return "Set/Combo"
    if "backpack" in text:
        return "Backpack"
    return "Other"


async def scroll_page(page):
    for y in range(0, 3000, 500):
        await page.evaluate(f"window.scrollTo(0, {y})")
        await page.wait_for_timeout(random.randint(100, 200))


async def safe_text(page, selector, default=""):
    try:
        el = await page.query_selector(selector)
        return (await el.inner_text()).strip() if el else default
    except Exception:
        return default


async def dismiss_popups(page):
    for sel in ["[data-action='a-popover-close']", "#attach-close_sideSheet-link"]:
        try:
            btn = await page.query_selector(sel)
            if btn:
                await btn.click()
                await page.wait_for_timeout(300)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Browser context
# ---------------------------------------------------------------------------

async def make_context(pw):
    browser = await pw.chromium.launch(headless=False)
    context = await browser.new_context(
        viewport={"width": 1366, "height": 768},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        locale="en-IN",
        timezone_id="Asia/Kolkata",
        extra_http_headers={"Accept-Language": "en-IN,en;q=0.9"},
    )
    await context.add_init_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    return browser, context


# ---------------------------------------------------------------------------
# Manual login
# ---------------------------------------------------------------------------

async def manual_login(context):
    page = await context.new_page()
    await page.goto("https://www.amazon.in")
    await page.wait_for_timeout(2000)
    print("\n" + "="*55)
    print("  ACTION REQUIRED")
    print("  1. Log in to Amazon India in the browser window.")
    print("  2. Once fully logged in, come back here.")
    print("  3. Press ENTER to start scraping.")
    print("="*55 + "\n")
    input("  Press ENTER after logging in >>> ")
    await page.close()
    log.info("Login confirmed. Starting scrape...")


# ---------------------------------------------------------------------------
# Search for product URLs
# ---------------------------------------------------------------------------

async def search_products(context, brand):
    query = f"{brand} luggage trolley bag"
    url   = f"https://www.amazon.in/s?k={query.replace(' ', '+')}&rh=n%3A1984443031"
    urls  = []
    page  = await context.new_page()

    try:
        for pg in range(1, 4):
            paged_url = url + f"&page={pg}"
            log.info(f"  Search page {pg}: {brand}")

            for attempt in range(3):
                try:
                    await page.goto(paged_url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(random.randint(2000, 4000))
                    break
                except PWTimeout:
                    log.warning(f"    Timeout attempt {attempt+1}")
                    await asyncio.sleep(5)

            await scroll_page(page)
            await dismiss_popups(page)

            items = await page.query_selector_all('[data-component-type="s-search-result"]')
            log.info(f"  Found {len(items)} items on page {pg}")

            for item in items:
                try:
                    link = await item.query_selector("h2 a.a-link-normal")
                    if not link:
                        link = await item.query_selector("a[href*='/dp/']")
                    if not link:
                        continue
                    href = await link.get_attribute("href")
                    if not href or "/dp/" not in href:
                        continue

                    title_el = await item.query_selector("h2 span")
                    title    = (await title_el.inner_text()).lower() if title_el else ""
                    

                    full_url = "https://www.amazon.in" + href.split("?")[0] if href.startswith("/") else href.split("?")[0]
                    asin     = extract_asin(full_url)
                    if asin and full_url not in urls:
                        urls.append(full_url)

                except Exception as e:
                    log.debug(f"    Item parse error: {e}")
                    continue

            if len(urls) >= PRODUCTS_PER_BRAND:
                break

            await asyncio.sleep(random.uniform(*DELAY_PAGE))

    except Exception as e:
        log.error(f"  Search error for {brand}: {e}")
    finally:
        await page.close()

    result = urls[:PRODUCTS_PER_BRAND]
    log.info(f"  -> {len(result)} product URLs for {brand}")
    return result


# ---------------------------------------------------------------------------
# Scrape product detail page
# ---------------------------------------------------------------------------

async def scrape_product(context, url, brand):
    asin = extract_asin(url)
    if not asin:
        return None

    page = await context.new_page()
    try:
        for attempt in range(3):
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(random.randint(2000, 4000))
                break
            except PWTimeout:
                if attempt == 2:
                    return None
                await asyncio.sleep(5)

        await scroll_page(page)
        await dismiss_popups(page)

        title = await safe_text(page, "#productTitle")
        if not title:
            log.warning(f"  No title found for {asin}")
            return None

        price_raw = ""
        for sel in [
            ".a-price.aok-align-center .a-offscreen",
            "#priceblock_ourprice",
            "#priceblock_dealprice",
            ".a-price .a-offscreen",
        ]:
            price_raw = await safe_text(page, sel)
            if price_raw:
                break

        list_price_raw = await safe_text(page, ".a-price.a-text-price .a-offscreen")
        rating_raw     = await safe_text(page, "#acrPopover .a-icon-alt, span.a-icon-alt")
        review_ct_raw  = await safe_text(page, "#acrCustomerReviewText")

        bullet_els = await page.query_selector_all("#feature-bullets li span.a-list-item")
        bullets    = [(await el.inner_text()).strip() for el in bullet_els if (await el.inner_text()).strip()]

        bc_els      = await page.query_selector_all("#wayfinding-breadcrumbs_feature_div a")
        breadcrumbs = [(await el.inner_text()).strip() for el in bc_els]

        price      = clean_price(price_raw)
        list_price = clean_price(list_price_raw)
        discount   = 0.0
        if price and list_price and list_price > price:
            discount = round((list_price - price) / list_price * 100, 1)

        rating = None
        m = re.search(r"[\d.]+", rating_raw)
        if m:
            rating = float(m.group())

        review_count = None
        m2 = re.search(r"[\d,]+", review_ct_raw)
        if m2:
            review_count = int(m2.group().replace(",", ""))

        log.info(f"  ✓ {brand} — {title[:55]}  ₹{price}  {rating}★")

        return {
            "asin":         asin,
            "brand":        brand,
            "title":        title,
            "url":          f"https://www.amazon.in/dp/{asin}",
            "price":        price,
            "list_price":   list_price,
            "discount_pct": discount,
            "rating":       rating,
            "review_count": review_count,
            "category":     infer_category(title, " ".join(breadcrumbs)),
            "bullets":      bullets[:8],
            "breadcrumbs":  breadcrumbs,
            "scraped_at":   datetime.now().isoformat(),
        }

    except Exception as e:
        log.error(f"  Error scraping {asin}: {e}")
        return None
    finally:
        await page.close()


# ---------------------------------------------------------------------------
# Scrape reviews
# ---------------------------------------------------------------------------

async def scrape_reviews(context, asin, brand, title):
    reviews = []
    page    = await context.new_page()

    try:
        for pg in range(1, REVIEW_PAGES + 1):
            url = (
                f"https://www.amazon.in/product-reviews/{asin}"
                f"?reviewerType=all_reviews&sortBy=recent&pageNumber={pg}"
            )
            log.info(f"    Reviews page {pg}/{REVIEW_PAGES}: {asin}")

            loaded = False
            for attempt in range(3):
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(random.randint(3000, 5000))
                    loaded = True
                    break
                except PWTimeout:
                    log.warning(f"      Timeout attempt {attempt+1}")
                    await asyncio.sleep(5)

            if not loaded:
                break

            await scroll_page(page)

            content = await page.content()
            if "captcha" in content.lower() and '[data-hook="review"]' not in content:
                log.warning(f"      CAPTCHA on {asin} p{pg} — skipping")
                break

            review_els = await page.query_selector_all('[data-hook="review"]')
            if not review_els:
                log.info(f"      No reviews on page {pg}, stopping.")
                break

            for el in review_els:
                try:
                    r_el    = await el.query_selector('[data-hook="review-star-rating"] .a-icon-alt, [data-hook="cmps-review-star-rating"] .a-icon-alt')
                    r_text  = (await r_el.inner_text()).strip() if r_el else ""
                    r_match = re.search(r"[\d.]+", r_text)
                    rating  = float(r_match.group()) if r_match else None

                    t_el         = await el.query_selector('[data-hook="review-title"] span:not(.a-icon-alt)')
                    review_title = (await t_el.inner_text()).strip() if t_el else ""

                    b_el = await el.query_selector('[data-hook="review-body"] span')
                    body = (await b_el.inner_text()).strip() if b_el else ""
                    if len(body) < 10:
                        continue

                    d_el     = await el.query_selector('[data-hook="review-date"]')
                    date_raw = (await d_el.inner_text()).strip() if d_el else ""

                    v_el     = await el.query_selector('[data-hook="avp-badge"]')
                    verified = v_el is not None

                    h_el    = await el.query_selector('[data-hook="helpful-vote-statement"]')
                    helpful = (await h_el.inner_text()).strip() if h_el else ""

                    reviews.append({
                        "asin":          asin,
                        "brand":         brand,
                        "product_title": title,
                        "rating":        rating,
                        "title":         review_title,
                        "body":          body,
                        "date_raw":      date_raw,
                        "helpful":       helpful,
                        "verified":      verified,
                        "scraped_at":    datetime.now().isoformat(),
                    })

                except Exception as e:
                    log.debug(f"      Review parse error: {e}")

            log.info(f"      Got {len(review_els)} reviews on page {pg}")
            await asyncio.sleep(random.uniform(*DELAY_PAGE))

    except Exception as e:
        log.error(f"    Fatal review error for {asin}: {e}")
    finally:
        await page.close()

    log.info(f"    -> {len(reviews)} reviews for {asin}")
    return reviews


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

async def run(brands_to_scrape, resume):
    Path("../data").mkdir(exist_ok=True)

    all_products: list          = []
    all_reviews:  list          = []
    scraped_product_asins: set  = set()
    scraped_review_asins:  set  = set()

    if resume:
        if Path(RAW_PRODUCTS_FILE).exists():
            all_products = load_json(RAW_PRODUCTS_FILE)
            scraped_product_asins = {p["asin"] for p in all_products}
            log.info(f"Resume: {len(all_products)} products already scraped")
        if Path(RAW_REVIEWS_FILE).exists():
            all_reviews = load_json(RAW_REVIEWS_FILE)
            scraped_review_asins = {r["asin"] for r in all_reviews}
            log.info(f"Resume: reviews done for {len(scraped_review_asins)} ASINs")

    async with async_playwright() as pw:
        browser, context = await make_context(pw)

        try:
            await manual_login(context)

            for brand in brands_to_scrape:
                log.info(f"\n{'='*60}\nBrand: {brand}\n{'='*60}")

                product_urls = await search_products(context, brand)

                brand_new_products = []
                for i, url in enumerate(product_urls):
                    asin = extract_asin(url)
                    if resume and asin in scraped_product_asins:
                        log.info(f"  Skipping product {asin}")
                        continue

                    log.info(f"  Product {i+1}/{len(product_urls)}")
                    product = await scrape_product(context, url, brand)

                    if product:
                        brand_new_products.append(product)
                        all_products.append(product)
                        scraped_product_asins.add(product["asin"])
                        save_json(RAW_PRODUCTS_FILE, all_products)

                    await asyncio.sleep(random.uniform(*DELAY_PRODUCT))

                products_needing_reviews = brand_new_products + [
                    p for p in all_products
                    if p["brand"] == brand and p["asin"] not in scraped_review_asins
                ]

                for product in products_needing_reviews:
                    if product["asin"] in scraped_review_asins:
                        continue
                    reviews = await scrape_reviews(context, product["asin"], product["brand"], product["title"])
                    all_reviews.extend(reviews)
                    scraped_review_asins.add(product["asin"])
                    save_json(RAW_REVIEWS_FILE, all_reviews)
                    await asyncio.sleep(random.uniform(*DELAY_PRODUCT))

                log.info(
                    f"\n{brand}: {len(brand_new_products)} new products, "
                    f"{sum(1 for r in all_reviews if r['brand']==brand)} reviews total"
                )
                await asyncio.sleep(random.uniform(*DELAY_BRAND))

        finally:
            await browser.close()

    save_json(RAW_PRODUCTS_FILE, all_products)
    save_json(RAW_REVIEWS_FILE,  all_reviews)

    log.info(f"\n{'='*60}")
    log.info(f"Done! {len(all_products)} products, {len(all_reviews)} reviews")
    log.info("Next: cd ../pipeline && python process.py")
    log.info(f"{'='*60}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(description="Unified Amazon India Playwright scraper")
    parser.add_argument("--brands", nargs="+", default=BRANDS)
    parser.add_argument("--resume", action="store_true", help="Skip already-scraped ASINs")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    log.info(f"Starting scraper for: {args.brands}")
    asyncio.run(run(brands_to_scrape=args.brands, resume=args.resume))