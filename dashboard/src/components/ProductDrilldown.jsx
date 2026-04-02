import React, { useState, useMemo } from 'react';
import SentimentBar from './SentimentBar';

const CATEGORIES = ['All', 'Cabin', 'Check-in Medium', 'Check-in Large', 'Set/Combo', 'Other'];

export default function ProductDrilldown({ data }) {
  const { brands } = data;

  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('rating');
  const [minRating, setMinRating] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const allProducts = useMemo(() => {
    return brands.flatMap(b =>
      (b.products || []).map(p => ({
        ...p,
        brand_color: b.color,
        avg_vader_score: p.avg_vader_score ?? b.avg_vader_score ?? 0,
        positive_pct: b.positive_pct,
        negative_pct: b.negative_pct,
        neutral_pct:  b.neutral_pct,
      }))
    );
  }, [brands]);

  const filtered = useMemo(() => {
    return allProducts
      .filter(p => selectedBrand === 'All' || p.brand === selectedBrand)
      .filter(p => selectedCategory === 'All' || p.category === selectedCategory)
      .filter(p => (p.rating || 0) >= minRating)
      .sort((a, b) => {
        if (sortBy === 'rating')    return (b.rating || 0) - (a.rating || 0);
        if (sortBy === 'price')     return (b.price || 0) - (a.price || 0);
        if (sortBy === 'discount')  return (b.discount_pct || 0) - (a.discount_pct || 0);
        if (sortBy === 'sentiment') return (b.avg_vader_score || 0) - (a.avg_vader_score || 0);
        if (sortBy === 'reviews')   return (b.review_count || 0) - (a.review_count || 0);
        return 0;
      });
  }, [allProducts, selectedBrand, selectedCategory, sortBy, minRating]);

  const product = selectedProduct ? allProducts.find(p => p.asin === selectedProduct) : null;
  const brandData = product ? brands.find(b => b.brand === product.brand) : null;

  return (
    <div style={{ display: 'flex', gap: 14 }}>

      {/* Left: product list */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={selectedBrand} onChange={e => { setSelectedBrand(e.target.value); setSelectedProduct(null); }}>
            <option value="All">All brands</option>
            {brands.map(b => <option key={b.brand} value={b.brand}>{b.brand}</option>)}
          </select>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="rating">Sort: Rating</option>
            <option value="price">Sort: Price</option>
            <option value="discount">Sort: Discount</option>
            <option value="sentiment">Sort: Sentiment</option>
            <option value="reviews">Sort: Reviews</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>MIN ★</span>
            <input type="range" min="0" max="5" step="0.5" value={minRating}
              onChange={e => setMinRating(parseFloat(e.target.value))}
              style={{ width: 80, accentColor: 'var(--accent-blue)' }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', minWidth: 24 }}>{minRating}</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
            {filtered.length} products
          </span>
        </div>

        {/* Product cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
          {filtered.map(p => (
            <div key={p.asin} onClick={() => setSelectedProduct(p.asin === selectedProduct ? null : p.asin)}
              className="card" style={{
                cursor: 'pointer', transition: 'all 0.15s',
                borderLeft: `2px solid ${p.asin === selectedProduct ? p.brand_color : 'transparent'}`,
                background: p.asin === selectedProduct ? 'var(--bg-hover)' : 'var(--bg-card)',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: p.brand_color }}>{p.brand}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.category}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {(p.review_count || 0).toLocaleString()} reviews
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent-teal)' }}>
                      ₹{Math.round(p.price || 0).toLocaleString()}
                    </div>
                    {p.discount_pct > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                        {p.discount_pct.toFixed(0)}% off
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--accent-amber)' }}>
                    {(p.rating || 0).toFixed(1)}★
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <SentimentBar positive={p.positive_pct || 0} negative={p.negative_pct || 0} neutral={p.neutral_pct || 0} />
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              no products match filters
            </div>
          )}
        </div>
      </div>

      {/* Right: product detail panel */}
      {product && (
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="card" style={{ borderTop: `2px solid ${product.brand_color}` }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 8 }}>PRODUCT DETAIL</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 10 }}>{product.title}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: '10px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Price</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--accent-teal)' }}>
                  ₹{Math.round(product.price || 0).toLocaleString()}
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: '10px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>List price</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                  ₹{Math.round(product.list_price || 0).toLocaleString()}
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: '10px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Discount</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--accent-amber)' }}>
                  {(product.discount_pct || 0).toFixed(1)}%
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: '10px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Rating</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--accent-amber)' }}>
                  {(product.rating || 0).toFixed(1)}★
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 5 }}>SENTIMENT</div>
              <SentimentBar positive={product.positive_pct || 0} negative={product.negative_pct || 0} neutral={product.neutral_pct || 0} />
              <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                <span style={{ fontSize: 10, color: 'var(--accent-teal)' }}>+{(product.positive_pct || 0).toFixed(0)}%</span>
                <span style={{ fontSize: 10, color: 'var(--accent-red)' }}>-{(product.negative_pct || 0).toFixed(0)}%</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{(product.neutral_pct || 0).toFixed(0)}% neutral</span>
              </div>
            </div>

            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 5 }}>VADER SCORE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: (product.avg_vader_score || 0) >= 0 ? 'var(--accent-teal)' : 'var(--accent-red)', marginBottom: 12 }}>
              {(product.avg_vader_score || 0) >= 0 ? '+' : ''}{(product.avg_vader_score || 0).toFixed(3)}
            </div>

            <a href={product.url} target="_blank" rel="noreferrer"
              style={{ display: 'block', textAlign: 'center', background: 'rgba(124,143,245,0.12)', border: '0.5px solid rgba(124,143,245,0.3)', borderRadius: 6, padding: '8px', fontSize: 11, color: 'var(--accent-blue)', textDecoration: 'none' }}>
              View on Amazon ↗
            </a>
          </div>

          {/* Feature bullets */}
          {product.bullets?.length > 0 && (
            <div className="card">
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 8 }}>PRODUCT SPECS</div>
              {product.bullets.map((b, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5, paddingLeft: 10, borderLeft: '1.5px solid var(--border-hi)', lineHeight: 1.5 }}>
                  {b}
                </div>
              ))}
            </div>
          )}

          {/* Review samples */}
          {(product.review_samples?.length > 0 || brandData?.review_samples?.length > 0) && (
            <div className="card">
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 10 }}>REVIEW SAMPLES</div>
              {(product.review_samples?.length > 0 ? product.review_samples : brandData?.review_samples || []).slice(0, 4).map((r, i) => (
                <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < 3 ? '0.5px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: r.sentiment === 'positive' ? 'var(--accent-teal)' : r.sentiment === 'negative' ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                      {(r.rating || 0).toFixed(0)}★
                    </span>
                    {r.verified && <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>verified</span>}
                  </div>
                  {r.title && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3 }}>{r.title}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.body?.slice(0, 200)}{r.body?.length > 200 ? '…' : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
