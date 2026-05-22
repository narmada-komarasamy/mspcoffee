'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Minus, RefreshCw, Send, Sparkles } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type Priority  = 'red' | 'amber' | 'green' | 'blue';
type Category  = 'processing' | 'rainfall' | 'fleet' | 'cup-scores' | 'alert';
type Trend     = 'up' | 'down' | 'flat' | null;

type Insight = {
  category: Category;
  priority: Priority;
  estate:   string;
  title:    string;
  text:     string;
  source:   string;
  trend:    Trend;
};

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const QUICK_PROMPTS = [
  { icon: '📉', text: 'Which estate has the lowest outturn this season?' },
  { icon: '🌧',  text: 'How does this month\'s rainfall compare to last month?' },
  { icon: '⛽',  text: 'Which vehicle is costing the most per km?' },
  { icon: '🏆',  text: 'What is the highest-scoring cup lot on record?' },
];

const CATEGORY_LABELS: Record<Category, string> = {
  'processing':  '🏭 Processing',
  'rainfall':    '🌧 Rainfall',
  'fleet':       '⛽ Fleet',
  'cup-scores':  '☕ Cup Scores',
  'alert':       '⚠️ Alert',
};

const PRIORITY_STYLES: Record<Priority, { dot: string; label: string }> = {
  red:   { dot: '#ef4444', label: 'bg-red-50 text-red-700' },
  amber: { dot: '#f59e0b', label: 'bg-amber-50 text-amber-700' },
  green: { dot: '#22c55e', label: 'bg-green-50 text-green-700' },
  blue:  { dot: '#3b82f6', label: 'bg-blue-50 text-blue-700' },
};

const CATEGORY_PILL: Record<Category, string> = {
  processing:  'bg-green-50 text-green-800',
  rainfall:    'bg-blue-50 text-blue-800',
  fleet:       'bg-orange-50 text-orange-800',
  'cup-scores':'bg-purple-50 text-purple-800',
  alert:       'bg-red-50 text-red-800',
};

// ── Priority sort order ───────────────────────────────────────────────────────
const PRIORITY_ORDER: Record<Priority, number> = { red: 0, amber: 1, blue: 2, green: 3 };

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5dfc8', borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 14 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e5dfc8', flexShrink: 0, marginTop: 4 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 80, height: 18, borderRadius: 99, background: '#f0ead4' }} />
          <div style={{ width: 120, height: 18, borderRadius: 99, background: '#f0ead4' }} />
        </div>
        <div style={{ width: '95%', height: 13, borderRadius: 4, background: '#f0ead4', marginBottom: 6 }} />
        <div style={{ width: '80%', height: 13, borderRadius: 4, background: '#f0ead4', marginBottom: 6 }} />
        <div style={{ width: '60%', height: 13, borderRadius: 4, background: '#f0ead4' }} />
      </div>
    </div>
  );
}

// ── Insight card ──────────────────────────────────────────────────────────────
function InsightCard({ insight }: { insight: Insight }) {
  const pr = PRIORITY_STYLES[insight.priority];
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5dfc8', borderRadius: 12,
      padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
      transition: 'box-shadow .15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(27,74,27,.1)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
    >
      {/* Priority dot */}
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: pr.dot, flexShrink: 0, marginTop: 5,
        boxShadow: `0 0 0 3px ${pr.dot}33` }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em',
            padding: '2px 8px', borderRadius: 99 }} className={CATEGORY_PILL[insight.category]}>
            {CATEGORY_LABELS[insight.category]}
          </span>
          <span style={{ fontSize: '.65rem', fontWeight: 600, color: '#6b7280' }}>{insight.estate}</span>
          {insight.trend && (
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3,
              fontSize: '.65rem', fontWeight: 700,
              color: insight.trend === 'up' ? '#16a34a' : insight.trend === 'down' ? '#dc2626' : '#9ca3af' }}>
              {insight.trend === 'up' && <ArrowUp style={{ width: 12, height: 12 }} />}
              {insight.trend === 'down' && <ArrowDown style={{ width: 12, height: 12 }} />}
              {insight.trend === 'flat' && <Minus style={{ width: 12, height: 12 }} />}
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#1b4a1b', marginBottom: 4, lineHeight: 1.3 }}>
          {insight.title}
        </div>

        {/* Body */}
        <div style={{ fontSize: '.8rem', color: '#374151', lineHeight: 1.55 }}>{insight.text}</div>

        {/* Source */}
        <div style={{ marginTop: 8, fontSize: '.62rem', color: '#9ca3af' }}>📊 {insight.source}</div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AIInsightsPage() {
  const [insights,     setInsights]     = useState<Insight[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [refreshedAt,  setRefreshedAt]  = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<Category | 'all'>('all');
  const [chat,         setChat]         = useState<ChatMessage[]>([]);
  const [question,     setQuestion]     = useState('');
  const [streaming,    setStreaming]     = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch insights ─────────────────────────────────────────────────────────
  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-insights');
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      const sorted = (json.insights as Insight[]).sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      );
      setInsights(sorted);
      setRefreshedAt(json.refreshedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

  // ── Ask AI ─────────────────────────────────────────────────────────────────
  const askQuestion = useCallback(async (q: string) => {
    if (!q.trim() || streaming) return;
    const userMsg: ChatMessage = { role: 'user', content: q };
    setChat(prev => [...prev, userMsg]);
    setQuestion('');
    setStreaming(true);

    const history = [...chat, userMsg];
    setChat(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/ai-insights/ask', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: q, history: history.slice(-6) }),
      });
      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setChat(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: accumulated };
          return next;
        });
      }
    } catch {
      setChat(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }, [chat, streaming]);

  // ── Filtered insights ──────────────────────────────────────────────────────
  const filtered = activeTab === 'all' ? insights : insights.filter(i => i.category === activeTab);

  const counts: Record<string, number> = { all: insights.length };
  insights.forEach(i => { counts[i.category] = (counts[i.category] ?? 0) + 1; });
  const needsAttention = insights.filter(i => i.priority === 'red').length;

  const tabs: { key: Category | 'all'; label: string }[] = [
    { key: 'all',        label: 'All' },
    { key: 'processing', label: '🏭 Processing' },
    { key: 'rainfall',   label: '🌧 Rainfall' },
    { key: 'fleet',      label: '⛽ Fleet' },
    { key: 'cup-scores', label: '☕ Cup Scores' },
    { key: 'alert',      label: '⚠️ Alerts' },
  ];

  const fmtTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles style={{ width: 18, height: 18, color: '#2d6e2d' }} />
          <div>
            <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#1b4a1b' }}>AI Insights</div>
            <div style={{ fontSize: '.65rem', color: '#9ca3af' }}>
              {loading ? 'Generating insights from live data…' :
               error   ? 'Error loading' :
               `${insights.length} insights · ${needsAttention} need attention · refreshed ${fmtTime(refreshedAt)}`}
            </div>
          </div>
        </div>

        <button onClick={fetchInsights} disabled={loading}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: '#2d6e2d',
            color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: '.73rem',
            fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Generating…' : 'Refresh Insights'}
        </button>
      </div>

      {/* ── Summary strip ────────────────────────────────────────────────────── */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Total Insights',     value: insights.length.toString(),     sub: 'generated from live data', color: '#2d6e2d' },
            { label: 'Need Attention',     value: needsAttention.toString(),       sub: 'red-priority items',       color: '#ef4444' },
            { label: 'Processing',         value: (counts['processing'] ?? 0).toString(), sub: 'estate batch insights', color: '#16a34a' },
            { label: 'Cup Scores / Fleet', value: `${counts['cup-scores'] ?? 0} / ${counts['fleet'] ?? 0}`, sub: 'lots scored · vehicles tracked', color: '#8b5cf6' },
          ].map(card => (
            <div key={card.label} style={{ background: '#fff', border: '1px solid #e5dfc8', borderRadius: 10,
              padding: '12px 14px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: card.color }} />
              <div style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#9ca3af' }}>{card.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1b4a1b', lineHeight: 1.1, margin: '3px 0 2px' }}>{card.value}</div>
              <div style={{ fontSize: '.65rem', color: '#6b7280' }}>{card.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Two-column layout ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, flex: 1, minHeight: 0 }}>

        {/* ── Feed ──────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

          {/* Category tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '5px 12px', borderRadius: 99, fontSize: '.7rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all .15s', border: 'none',
                  background: activeTab === tab.key ? '#1b4a1b' : '#f0ead4',
                  color: activeTab === tab.key ? '#fff' : '#6b7280',
                }}>
                {tab.label}
                {counts[tab.key] != null && (
                  <span style={{ marginLeft: 5, background: activeTab === tab.key ? 'rgba(255,255,255,.25)' : '#e5dfc8',
                    color: activeTab === tab.key ? '#fff' : '#6b7280', borderRadius: 99, padding: '0 5px',
                    fontSize: '.62rem' }}>
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', paddingRight: 2 }}>
            {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 18px',
                color: '#dc2626', fontSize: '.82rem' }}>
                ⚠️ {error} — Check that ANTHROPIC_API_KEY is set in your environment.
              </div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div style={{ background: '#fff', border: '1px solid #e5dfc8', borderRadius: 12, padding: '24px',
                textAlign: 'center', color: '#9ca3af', fontSize: '.82rem' }}>
                No insights in this category.
              </div>
            )}

            {!loading && filtered.map((ins, i) => <InsightCard key={i} insight={ins} />)}
          </div>
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

          {/* Ask AI */}
          <div style={{ background: '#fff', border: '1.5px solid #2d6e2d', borderRadius: 14, overflow: 'hidden',
            display: 'flex', flexDirection: 'column', flex: 1 }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#1b4a1b,#2d6e2d)', padding: '11px 14px',
              display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.1rem' }}>🤖</span>
              <div>
                <div style={{ fontSize: '.76rem', fontWeight: 700, color: '#fff' }}>Ask AI</div>
                <div style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.6)' }}>Answers grounded in live Supabase data</div>
              </div>
            </div>

            {/* Chat history */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0', display: 'flex',
              flexDirection: 'column', gap: 8, minHeight: 160, maxHeight: 320 }}>
              {chat.length === 0 && (
                <div style={{ color: '#9ca3af', fontSize: '.73rem', textAlign: 'center', paddingTop: 24 }}>
                  Ask anything about your estates…
                </div>
              )}
              {chat.map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  background: msg.role === 'user' ? '#e8f5e9' : '#f5f5f5',
                  color: msg.role === 'user' ? '#1b4a1b' : '#374151',
                  borderRadius: 10,
                  borderBottomRightRadius: msg.role === 'user' ? 3 : 10,
                  borderBottomLeftRadius:  msg.role === 'assistant' ? 3 : 10,
                  padding: '8px 11px',
                  fontSize: '.74rem',
                  lineHeight: 1.5,
                }}>
                  {msg.content || (
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 1, 2].map(j => (
                        <span key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: '#9ca3af',
                          display: 'inline-block', animation: `blink 1.2s ${j * 0.2}s infinite` }} />
                      ))}
                    </span>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick prompts */}
            {chat.length === 0 && (
              <div style={{ padding: '8px 12px' }}>
                <div style={{ fontSize: '.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
                  color: '#9ca3af', marginBottom: 6 }}>Suggested questions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {QUICK_PROMPTS.map(p => (
                    <button key={p.text} onClick={() => askQuestion(p.text)}
                      style={{ background: '#f5eedc', border: '1px solid #e5dfc8', borderRadius: 8,
                        padding: '6px 10px', fontSize: '.71rem', color: '#374151', cursor: 'pointer',
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e8f5e9'; (e.currentTarget as HTMLElement).style.borderColor = '#2d6e2d'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f5eedc'; (e.currentTarget as HTMLElement).style.borderColor = '#e5dfc8'; }}>
                      <span>{p.icon}</span>{p.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #e5dfc8', display: 'flex', gap: 8 }}>
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), askQuestion(question))}
                placeholder="Ask about your estates…"
                disabled={streaming}
                style={{ flex: 1, border: '1px solid #e5dfc8', borderRadius: 8, padding: '7px 10px',
                  fontSize: '.74rem', color: '#1a1a1a', background: '#fdf8ee', outline: 'none' }}
              />
              <button onClick={() => askQuestion(question)} disabled={streaming || !question.trim()}
                style={{ background: '#2d6e2d', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '7px 11px', cursor: 'pointer', opacity: (streaming || !question.trim()) ? 0.5 : 1 }}>
                <Send style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>

          {/* Data sources */}
          <div style={{ background: '#fff', border: '1px solid #e5dfc8', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#f5eedc', borderBottom: '1px solid #e5dfc8',
              fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#6b7280' }}>
              📦 Data Sources
            </div>
            {[
              { dot: '#2d6e2d', name: 'Processing Batches', count: '999 records', live: true },
              { dot: '#3b82f6', name: 'Rain Gauge',         count: 'Season data', live: true },
              { dot: '#f59e0b', name: 'Fleet Fuel Log',     count: 'Daily records', live: true },
              { dot: '#8b5cf6', name: 'Cup Scores',         count: '73 lots',      live: true },
            ].map(src => (
              <div key={src.name} style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10,
                borderBottom: '1px solid #f0ead4', fontSize: '.73rem' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: src.dot, flexShrink: 0 }} />
                <div style={{ flex: 1, color: '#374151', fontWeight: 500 }}>{src.name}</div>
                <div style={{ color: '#9ca3af', fontSize: '.65rem' }}>{src.count}</div>
                {src.live && (
                  <span style={{ fontSize: '.6rem', fontWeight: 700, color: '#16a34a', background: '#dcfce7',
                    borderRadius: 99, padding: '1px 7px' }}>Live</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blink { 0%,80%,100% { opacity:.3; } 40% { opacity:1; } }
      `}</style>
    </div>
  );
}
