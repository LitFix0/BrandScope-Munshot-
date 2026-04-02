import React, { useState } from 'react';
import { useDashboardData } from './hooks/useDashboardData';
import Overview       from './components/Overview';
import BrandComparison from './components/BrandComparison';
import ProductDrilldown from './components/ProductDrilldown';
import AgentInsights   from './components/AgentInsights';

const VIEWS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'comparison',  label: 'Brand Comparison' },
  { id: 'products',    label: 'Product Drilldown' },
  { id: 'insights',    label: 'Agent Insights' },
];

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-blue)',
            animation: `pulse 1.2s ease ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
        LOADING INTELLIGENCE DATA...
      </div>
    </div>
  );
}

function ErrorState({ error }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-red)', letterSpacing: '0.08em' }}>DATA LOAD ERROR</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
        {error}. Make sure <code style={{ background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>dashboard_data.json</code> is in <code style={{ background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>public/data/</code>.
      </div>
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState('overview');
  const { data, loading, error } = useDashboardData();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>

      {/* Top nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(8,10,15,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid var(--border)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', height: 52,
        gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {['var(--accent-red)', 'var(--accent-amber)', 'var(--accent-teal)'].map((c, i) => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: c, opacity: 0.8 }} />
            ))}
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            LUGGAGE INTEL
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em', background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 4 }}>
            Amazon India
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {VIEWS.map(v => (
            <button key={v.id} className={`nav-btn ${activeView === v.id ? 'active' : ''}`}
              onClick={() => setActiveView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {data && (
            <>
              <div className="pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-teal)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                {data.meta.total_brands} brands · {data.meta.total_reviews.toLocaleString()} reviews
              </span>
            </>
          )}
        </div>
      </nav>

      {/* Content */}
      <main style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
        {loading && <Loader />}
        {error   && <ErrorState error={error} />}
        {data && !loading && (
          <>
            {activeView === 'overview'   && <Overview        data={data} />}
            {activeView === 'comparison' && <BrandComparison data={data} />}
            {activeView === 'products'   && <ProductDrilldown data={data} />}
            {activeView === 'insights'   && <AgentInsights   data={data} />}
          </>
        )}
      </main>

      {/* Footer */}
      {data && (
        <footer style={{ borderTop: '0.5px solid var(--border)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
            Generated {new Date(data.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
            Moonshot · Competitive Intelligence · Amazon India Luggage Market
          </span>
        </footer>
      )}
    </div>
  );
}
