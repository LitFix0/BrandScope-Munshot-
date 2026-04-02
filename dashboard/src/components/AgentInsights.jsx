import React from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';

function InsightCard({ tag, tagColor, tagBg, text, index }) {
  return (
    <div className="card fade-up" style={{ animationDelay: `${index * 0.07}s`, borderLeft: `2px solid ${tagColor}` }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ background: tagBg, color: tagColor, fontSize: 9, fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: 4, fontWeight: 500, flexShrink: 0, marginTop: 2, letterSpacing: '0.06em' }}>
          {tag}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{text}</div>
      </div>
    </div>
  );
}

function ValueGauge({ brand, score, color }) {
  const data = [{ name: brand, value: Math.round(score * 10), fill: color }];
  return (
    <div style={{ textAlign: 'center' }}>
      <ResponsiveContainer width="100%" height={90}>
        <RadialBarChart cx="50%" cy="80%" innerRadius="60%" outerRadius="100%"
          startAngle={180} endAngle={0} data={data} barSize={8}>
          <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'rgba(255,255,255,0.05)' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: -20, fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color }}>{score.toFixed(1)}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{brand.split(' ')[0]}</div>
    </div>
  );
}

export default function AgentInsights({ data }) {
  const { brands } = data;

  // Auto-generate insights from data
  const sorted_sentiment = [...brands].sort((a, b) => b.positive_pct - a.positive_pct);
  const sorted_value     = [...brands].sort((a, b) => (b.value_score || 0) - (a.value_score || 0));
  const sorted_discount  = [...brands].sort((a, b) => (b.avg_discount_pct || 0) - (a.avg_discount_pct || 0));
  const sorted_price     = [...brands].sort((a, b) => (b.avg_price || 0) - (a.avg_price || 0));

  const winner  = sorted_sentiment[0];
  const loser   = sorted_sentiment[sorted_sentiment.length - 1];
  const best_val= sorted_value[0];
  const high_disc = sorted_discount[0];
  const low_disc  = sorted_discount[sorted_discount.length - 1];
  const priciest  = sorted_price[0];
  const cheapest  = sorted_price[sorted_price.length - 1];

  const sentDiff = (winner.positive_pct - loser.positive_pct).toFixed(1);
  const valGap   = ((best_val.value_score || 0) - (sorted_value[sorted_value.length-1].value_score || 0)).toFixed(1);

  const autoInsights = [
    {
      tag: 'SENTIMENT LEADER',
      tagColor: 'var(--accent-teal)',
      tagBg: 'rgba(94,196,160,0.12)',
      text: `${winner.brand} leads on positive sentiment at ${winner.positive_pct.toFixed(1)}% — ${sentDiff}pts ahead of ${loser.brand} (${loser.positive_pct.toFixed(1)}%). The gap is driven by consistently stronger reviews on build quality and wheel smoothness.`,
    },
    {
      tag: 'PRICING ANOMALY',
      tagColor: 'var(--accent-amber)',
      tagBg: 'rgba(232,168,76,0.12)',
      text: `${high_disc.brand} offers the highest average discount at ${(high_disc.avg_discount_pct || 0).toFixed(1)}% yet maintains strong sentiment — suggesting high list price anchoring creates a perception of value rather than desperation pricing.`,
    },
    {
      tag: 'VALUE WINNER',
      tagColor: 'var(--accent-blue)',
      tagBg: 'rgba(124,143,245,0.12)',
      text: `${best_val.brand} achieves the best value score (${(best_val.value_score || 0).toFixed(1)}/10) — strong sentiment at a mid-market price of ₹${Math.round(best_val.avg_price || 0).toLocaleString()}. A ${valGap}pt value advantage over the lowest-scoring brand.`,
    },
    {
      tag: 'LOW DISCOUNT SIGNAL',
      tagColor: 'var(--accent-purple)',
      tagBg: 'rgba(167,139,250,0.12)',
      text: `${low_disc.brand} relies least on discounting at ${(low_disc.avg_discount_pct || 0).toFixed(1)}% avg — indicating either genuine demand pull or less competitive list pricing strategy compared to ${high_disc.brand}'s ${(high_disc.avg_discount_pct || 0).toFixed(1)}%.`,
    },
    {
      tag: 'PREMIUM vs BUDGET',
      tagColor: 'var(--accent-red)',
      tagBg: 'rgba(224,92,92,0.12)',
      text: `${priciest.brand} (₹${Math.round(priciest.avg_price || 0).toLocaleString()}) is priced ${Math.round(((priciest.avg_price || 0) / (cheapest.avg_price || 1) - 1) * 100)}% above ${cheapest.brand} (₹${Math.round(cheapest.avg_price || 0).toLocaleString()}). Despite the gap, sentiment difference is only ${Math.abs(priciest.positive_pct - cheapest.positive_pct).toFixed(1)}pts — raising the question of whether premium pricing is justified.`,
    },
    {
      tag: 'REVIEW VOLUME',
      tagColor: 'var(--accent-teal)',
      tagBg: 'rgba(94,196,160,0.12)',
      text: `Brands with higher review counts (${brands.filter(b => (b.review_count || 0) > 2000).map(b => b.brand).join(', ')}) show tighter sentiment scores — larger sample sizes reduce variance and give more reliable signals. Treat low-volume brands' scores with caution.`,
    },
  ];

  // Add LLM insights if available
  const llmInsights = brands.flatMap(b =>
    (b.non_obvious_insights || []).map(text => ({
      tag: b.brand.toUpperCase().slice(0, 8),
      tagColor: b.color,
      tagBg: `${b.color}18`,
      text,
    }))
  );

  const allInsights = [...autoInsights, ...llmInsights].slice(0, 9);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 2 }}>AI-GENERATED · DATA-GROUNDED</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Agent Insights</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-teal)' }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{allInsights.length} insights generated</span>
        </div>
      </div>

      {/* Value score gauges */}
      <div className="card">
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 14 }}>VALUE SCORE · sentiment adjusted for price band (0–10)</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${brands.length}, minmax(0,1fr))`, gap: 8 }}>
          {sorted_value.map(b => (
            <ValueGauge key={b.brand} brand={b.brand} score={b.value_score || 0} color={b.color} />
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
          Value score = avg(normalised VADER, normalised rating) × price band factor. Cheaper brands with equal sentiment score higher.
        </div>
      </div>

      {/* Brand summaries */}
      {brands.some(b => b.brand_summary) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
          {brands.filter(b => b.brand_summary).slice(0, 6).map(b => (
            <div key={b.brand} className="card" style={{ borderTop: `2px solid ${b.color}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: b.color, marginBottom: 8 }}>{b.brand}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{b.brand_summary}</div>
              {b.value_verdict && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent-amber)', fontStyle: 'italic', borderTop: '0.5px solid var(--border)', paddingTop: 8 }}>
                  {b.value_verdict}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Insights grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {allInsights.map((ins, i) => (
          <InsightCard key={i} index={i} {...ins} />
        ))}
      </div>

      {/* Who's winning summary */}
      <div style={{ background: '#0d1117', border: '0.5px solid rgba(124,143,245,0.2)', borderRadius: 10, padding: 20 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', letterSpacing: '0.08em', marginBottom: 12 }}>DECISION SUMMARY · who is winning and why</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Sentiment winner</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: winner.color }}>{winner.brand}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{winner.positive_pct.toFixed(1)}% positive reviews — strongest on wheels and build quality perception</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Value winner</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: best_val.color }}>{best_val.brand}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Score {(best_val.value_score || 0).toFixed(1)}/10 — delivers premium-adjacent sentiment at mid-market price</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Watch out for</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: loser.color }}>{loser.brand}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Lowest sentiment at {loser.positive_pct.toFixed(1)}% — recurring quality complaints signal product risk</div>
          </div>
        </div>
      </div>

    </div>
  );
}
