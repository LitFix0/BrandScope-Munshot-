import React, { useState } from 'react';
import SentimentBar from './SentimentBar';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, CartesianGrid, Legend,
} from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: '#1a2035', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: d?.color || '#e8eaf0', fontWeight: 600, marginBottom: 4 }}>{d?.brand}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: '#8b95a8' }}>
          {p.name}: <span style={{ color: '#e8eaf0' }}>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const ASPECTS = ['wheels', 'handle', 'zipper', 'material', 'size', 'weight', 'price'];

export default function BrandComparison({ data }) {
  const { brands } = data;
  const [sortBy, setSortBy] = useState('positive_pct');
  const [selectedBrands, setSelectedBrands] = useState(brands.map(b => b.brand));

  const filtered = brands.filter(b => selectedBrands.includes(b.brand));
  const sorted   = [...filtered].sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0));

  const toggleBrand = brand => {
    setSelectedBrands(prev =>
      prev.includes(brand) ? (prev.length > 1 ? prev.filter(b => b !== brand) : prev) : [...prev, brand]
    );
  };

  const scatterData = brands.map(b => ({
    brand: b.brand, color: b.color,
    x: Math.round(b.avg_price || 0),
    y: parseFloat((b.positive_pct || 0).toFixed(1)),
    z: b.review_count || 100,
  }));

  const discountData = [...brands].sort((a, b) => (b.avg_discount_pct || 0) - (a.avg_discount_pct || 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>FILTER:</span>
        {brands.map(b => (
          <button key={b.brand} onClick={() => toggleBrand(b.brand)}
            style={{
              background: selectedBrands.includes(b.brand) ? `${b.color}22` : 'transparent',
              border: `0.5px solid ${selectedBrands.includes(b.brand) ? b.color : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 6, padding: '4px 12px', fontSize: 11, color: selectedBrands.includes(b.brand) ? b.color : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-display)',
            }}>
            {b.brand}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>SORT BY:</span>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="positive_pct">Sentiment</option>
          <option value="avg_price">Price</option>
          <option value="avg_discount_pct">Discount</option>
          <option value="avg_product_rating">Rating</option>
          <option value="value_score">Value score</option>
        </select>
      </div>

      {/* Comparison table */}
      <div className="card">
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 14 }}>BRAND BENCHMARK TABLE</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Avg price</th>
                <th>List price</th>
                <th>Discount</th>
                <th>Rating</th>
                <th>Reviews</th>
                <th>Positive %</th>
                <th>Negative %</th>
                <th>VADER</th>
                <th>Value score</th>
                <th>Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(b => (
                <tr key={b.brand}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
                      <span style={{ fontWeight: 500 }}>{b.brand}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-teal)' }}>₹{Math.round(b.avg_price || 0).toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>₹{Math.round(b.avg_list_price || 0).toLocaleString()}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 7px', borderRadius: 4,
                      background: 'rgba(232,168,76,0.15)', color: 'var(--accent-amber)' }}>
                      {(b.avg_discount_pct || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{(b.avg_product_rating || 0).toFixed(2)}★</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{(b.review_count || 0).toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-teal)' }}>{(b.positive_pct || 0).toFixed(1)}%</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-red)' }}>{(b.negative_pct || 0).toFixed(1)}%</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: b.sentiment_score >= 0 ? 'var(--accent-teal)' : 'var(--accent-red)' }}>
                    {b.sentiment_score >= 0 ? '+' : ''}{(b.sentiment_score || 0).toFixed(3)}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: b.color, fontWeight: 600 }}>
                      {(b.value_score || 0).toFixed(1)}
                    </span>
                  </td>
                  <td style={{ minWidth: 100 }}>
                    <SentimentBar positive={b.positive_pct} negative={b.negative_pct} neutral={b.neutral_pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Price vs sentiment scatter */}
        <div className="card">
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 12 }}>PRICE vs SENTIMENT</div>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <XAxis dataKey="x" name="Avg price" type="number"
                tick={{ fill: '#4b5568', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v/1000).toFixed(0)}k`}
                label={{ value: 'Avg price (₹)', position: 'insideBottom', offset: -12, fill: '#4b5568', fontSize: 10 }} />
              <YAxis dataKey="y" name="Positive %" type="number"
                tick={{ fill: '#4b5568', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`} width={36} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.05)' }} />
              <Scatter data={scatterData}>
                {scatterData.map((d, i) => (
                  <Cell key={i} fill={d.color} fillOpacity={0.8} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {scatterData.map(d => (
              <div key={d.brand} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{d.brand.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Discount chart */}
        <div className="card">
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 12 }}>AVG DISCOUNT % · demand dependency</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={discountData} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
              <XAxis type="number" tick={{ fill: '#4b5568', fontSize: 10, fontFamily: 'DM Mono' }}
                axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="brand" tick={{ fill: '#8b95a8', fontSize: 10, fontFamily: 'DM Mono' }}
                axisLine={false} tickLine={false} width={90} tickFormatter={v => v.split(' ')[0]} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="avg_discount_pct" name="Avg discount %" radius={[0, 4, 4, 0]}>
                {discountData.map(b => <Cell key={b.brand} fill={b.color} fillOpacity={0.7} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Aspect sentiment grid */}
      <div className="card">
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 14 }}>ASPECT-LEVEL SENTIMENT · per brand</div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Brand</th>
                {ASPECTS.map(a => <th key={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const asp = b.aspect_sentiment || {};
                return (
                  <tr key={b.brand}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 1, background: b.color }} />
                        <span style={{ fontWeight: 500 }}>{b.brand}</span>
                      </div>
                    </td>
                    {ASPECTS.map(a => {
                      const d = asp[a];
                      const pos = d?.positive || 0;
                      const neg = d?.negative || 0;
                      const men = d?.mentions || pos + neg;
                      const sentiment = men === 0 ? 'none' : pos > neg * 1.5 ? 'pos' : neg > pos * 1.5 ? 'neg' : 'mix';
                      const colors = { pos: 'var(--accent-teal)', neg: 'var(--accent-red)', mix: 'var(--accent-amber)', none: 'var(--text-muted)' };
                      const labels = { pos: 'pos', neg: 'neg', mix: 'mix', none: '—' };
                      return (
                        <td key={a}>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 10,
                            color: colors[sentiment],
                            padding: '2px 6px', borderRadius: 3,
                            background: sentiment !== 'none' ? `${colors[sentiment]}18` : 'transparent',
                          }}>
                            {labels[sentiment]}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pros / Cons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
        {filtered.slice(0, 6).map(b => (
          <div key={b.brand} className="card" style={{ borderTop: `2px solid ${b.color}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: b.color, marginBottom: 10 }}>{b.brand}</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-teal)', marginBottom: 5 }}>TOP PRAISES</div>
              {(b.top_praises || []).slice(0, 3).map((p, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, paddingLeft: 8, borderLeft: '1.5px solid rgba(94,196,160,0.3)' }}>
                  {typeof p === 'string' ? p : p[0]}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-red)', marginBottom: 5 }}>TOP COMPLAINTS</div>
              {(b.top_complaints || []).slice(0, 3).map((c, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, paddingLeft: 8, borderLeft: '1.5px solid rgba(224,92,92,0.3)' }}>
                  {typeof c === 'string' ? c : c[0]}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
