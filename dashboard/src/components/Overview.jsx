import React from 'react';
import StatCard from './StatCard';
import SentimentBar from './SentimentBar';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a2035', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: '#8b95a8', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || '#e8eaf0' }}>{p.name}: {typeof p.value === 'number' ? (p.name.includes('₹') || p.name.includes('price') ? `₹${p.value.toLocaleString()}` : `${p.value.toFixed(1)}`) : p.value}</div>
      ))}
    </div>
  );
};

export default function Overview({ data }) {
  const { meta, brands } = data;

  const sorted = [...brands].sort((a, b) => b.positive_pct - a.positive_pct);

  const radarData = [
    { subject: 'Sentiment',  ...Object.fromEntries(brands.map(b => [b.brand, Math.round(b.positive_pct)])) },
    { subject: 'Rating',     ...Object.fromEntries(brands.map(b => [b.brand, Math.round((b.avg_product_rating || 3) * 20)])) },
    { subject: 'Value score',...Object.fromEntries(brands.map(b => [b.brand, Math.round((b.value_score || 5) * 10)])) },
    { subject: 'Reviews',    ...Object.fromEntries(brands.map(b => [b.brand, Math.min(100, Math.round((b.review_count || 0) / 40))])) },
    { subject: 'Discount',   ...Object.fromEntries(brands.map(b => [b.brand, Math.round(b.avg_discount_pct || 0) * 2])) },
  ];

  const priceData = [...brands].sort((a, b) => (b.avg_price || 0) - (a.avg_price || 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
        <StatCard label="Brands tracked"    value={meta.total_brands}    accent="var(--accent-blue)" />
        <StatCard label="Products analysed" value={meta.total_products}  accent="var(--accent-teal)" />
        <StatCard label="Reviews scored"    value={meta.total_reviews.toLocaleString()} accent="var(--accent-amber)" />
        <StatCard label="Avg market price"  value={`₹${Math.round(meta.avg_price_all_brands || 0).toLocaleString()}`} accent="var(--accent-purple)" />
      </div>

      {/* Main charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>

        {/* Sentiment ranking */}
        <div className="card">
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 16 }}>BRAND SENTIMENT RANKING</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {sorted.map((b, i) => (
              <div key={b.brand}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: b.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{b.brand}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-teal)' }}>{b.positive_pct.toFixed(1)}%</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                      {b.avg_vader_score >= 0 ? '+' : ''}{(b.avg_vader_score || 0).toFixed(3)}
                    </span>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div className="bar-fill" style={{ width: `${b.positive_pct}%`, background: b.color, height: '100%', borderRadius: 3 }} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--accent-teal)' }}>+{b.positive_pct.toFixed(0)}%</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>/</span>
                  <span style={{ fontSize: 10, color: 'var(--accent-red)' }}>-{b.negative_pct.toFixed(0)}%</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>/</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{b.neutral_pct.toFixed(0)}% neu</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Radar */}
        <div className="card">
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>MULTI-DIMENSION COMPARISON</div>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="rgba(255,255,255,0.07)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5568', fontSize: 10, fontFamily: 'DM Mono' }} />
              {brands.map(b => (
                <Radar key={b.brand} name={b.brand} dataKey={b.brand}
                  stroke={b.color} fill={b.color} fillOpacity={0.08} strokeWidth={1.5} dot={false} />
              ))}
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {brands.map(b => (
              <div key={b.brand} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 2, background: b.color, borderRadius: 1 }} />
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{b.brand.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Price chart */}
      <div className="card">
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 14 }}>AVERAGE PRICE BY BRAND (₹)</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={priceData} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
            <XAxis dataKey="brand" tick={{ fill: '#4b5568', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false}
              tickFormatter={v => v.split(' ')[0]} />
            <YAxis tick={{ fill: '#4b5568', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false}
              tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} width={36} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="avg_price" name="Avg price" radius={[4, 4, 0, 0]}>
              {priceData.map(b => <Cell key={b.brand} fill={b.color} fillOpacity={0.8} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Brand cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
        {brands.map(b => (
          <div key={b.brand} className="card" style={{ borderLeft: `2px solid ${b.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.brand}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {b.product_count} products · {b.review_count} reviews
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: b.color }}>
                {(b.avg_product_rating || 0).toFixed(1)}★
              </div>
            </div>
            <SentimentBar positive={b.positive_pct} negative={b.negative_pct} neutral={b.neutral_pct} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Avg <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>₹{Math.round(b.avg_price || 0).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Disc <span style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{(b.avg_discount_pct || 0).toFixed(1)}%</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Score <span style={{ color: b.color, fontFamily: 'var(--font-mono)' }}>{(b.value_score || 0).toFixed(1)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
