import React from 'react';
export default function SentimentBar({ positive, negative }) {
  const p = Math.round(positive);
  const n = Math.round(negative);
  return (
    <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
      <div style={{ width: p + '%', background: 'var(--accent-teal)', borderRadius: 3 }} />
      <div style={{ width: Math.max(0, 100 - p - n) + '%', background: 'rgba(139,149,168,0.3)', borderRadius: 3 }} />
      <div style={{ width: n + '%', background: 'var(--accent-red)', borderRadius: 3 }} />
    </div>
  );
}
