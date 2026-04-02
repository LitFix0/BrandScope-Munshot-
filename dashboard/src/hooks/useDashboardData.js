
import { useState, useEffect, useMemo } from 'react';

const BRAND_COLORS = {
  'Safari':             '#7c8ff5',
  'Skybags':            '#5ec4a0',
  'American Tourister': '#e8a84c',
  'VIP':                '#a78bfa',
  'Aristocrat':         '#e05c5c',
  'Nasher Miles':       '#38bdf8',
};

export function useDashboardData() {
  const [raw, setRaw]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetch('/data/dashboard_data.json')
      .then(r => { if (!r.ok) throw new Error('Failed to load data'); return r.json(); })
      .then(d => { setRaw(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const data = useMemo(() => {
    if (!raw) return null;
    const brands = raw.brands.map(b => ({
      ...b,
      color: BRAND_COLORS[b.brand] || '#8b95a8',
      sentiment_score: b.avg_vader_score ?? 0,
      positive_pct: b.sentiment_pct?.positive ?? 0,
      negative_pct: b.sentiment_pct?.negative ?? 0,
      neutral_pct:  b.sentiment_pct?.neutral  ?? 0,
    }));
    return { meta: raw.meta, brands, generated_at: raw.generated_at };
  }, [raw]);

  return { data, loading, error };
}

export { BRAND_COLORS };
