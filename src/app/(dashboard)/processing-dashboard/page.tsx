'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { EmailReportButton } from '@/components/email/EmailReportButton';

// ── Static KPI data per season ────────────────────────────────────────────────
type EstateData = {
  name: string;
  code: string;
  icon: string;
  href: string;
  accent: string;
  batches: number;
  ripeCherry: number;  // kg
  dryParchment: number; // kg
  outturn: number;     // percentage
};

type SeasonData = {
  label: string;
  estates: EstateData[];
  naturals: number;
  washed: number;
  honeyPsd: number;
  robusta: number;
};

const SEASONS: SeasonData[] = [
  {
    label: '2025 – 2026',
    estates: [
      { name: 'Stanmore Estate',     code: 'SE · Yercaud',  icon: '🌿', href: '/processing-dashboard/stanmore-estate',     accent: '#1b5e20', batches: 265, ripeCherry: 113291, dryParchment: 28143, outturn: 24.8 },
      { name: 'Moganad Estate',      code: 'ME · Yercaud',  icon: '☕', href: '/processing-dashboard/moganad-estate',      accent: '#1a237e', batches: 227, ripeCherry: 116852, dryParchment: 31835, outturn: 27.2 },
      { name: 'Orchardale Estate',   code: 'OE · Yercaud',  icon: '🌱', href: '/processing-dashboard/orchardale-estate',   accent: '#4a148c', batches:  64, ripeCherry:  30291, dryParchment:  8116, outturn: 26.8 },
      { name: 'Bison Valley Estate', code: 'BVE · Yercaud', icon: '🦬', href: '/processing-dashboard/bve',                accent: '#e65100', batches:  90, ripeCherry:  30749, dryParchment:  7236, outturn: 23.5 },
      { name: 'Hidden Falls Estate', code: 'HFE · Yercaud', icon: '🌊', href: '/processing-dashboard/hidden-falls-estate', accent: '#006064', batches: 149, ripeCherry:  52161, dryParchment: 12614, outturn: 24.2 },
    ],
    naturals: 628,
    washed:   141,
    honeyPsd:  26,
    robusta:    0,
  },
  {
    label: '2024 – 2025',
    estates: [
      { name: 'Stanmore Estate',     code: 'SE · Yercaud',  icon: '🌿', href: '/processing-dashboard/2024-2025/stanmore-estate',     accent: '#1b5e20', batches: 199, ripeCherry:  95028, dryParchment: 24697, outturn: 26.0 },
      { name: 'Moganad Estate',      code: 'ME · Yercaud',  icon: '☕', href: '/processing-dashboard/2024-2025/moganad-estate',      accent: '#1a237e', batches: 156, ripeCherry: 127316, dryParchment: 35079, outturn: 27.6 },
      { name: 'Orchardale Estate',   code: 'OE · Yercaud',  icon: '🌱', href: '/processing-dashboard/2024-2025/orchardale-estate',   accent: '#4a148c', batches: 152, ripeCherry:  82242, dryParchment: 24805, outturn: 30.2 },
      { name: 'Bison Valley Estate', code: 'BVE · Yercaud', icon: '🦬', href: '/processing-dashboard/2024-2025/bve',                accent: '#e65100', batches:  64, ripeCherry:  52371, dryParchment: 10573, outturn: 20.2 },
      { name: 'Hidden Falls Estate', code: 'HFE · Yercaud', icon: '🌊', href: '/processing-dashboard/2024-2025/hidden-falls-estate', accent: '#006064', batches: 100, ripeCherry:  28822, dryParchment:  8214, outturn: 28.5 },
    ],
    naturals: 462,
    washed:   167,
    honeyPsd:  42,
    robusta:    0,
  },
  {
    label: '2023 – 2024',
    estates: [
      { name: 'Stanmore Estate',     code: 'SE · Yercaud',  icon: '🌿', href: '/processing-dashboard/2023-2024/stanmore-estate',     accent: '#1b5e20', batches: 120, ripeCherry:  71557, dryParchment: 18513, outturn: 25.9 },
      { name: 'Moganad Estate',      code: 'ME · Yercaud',  icon: '☕', href: '/processing-dashboard/2023-2024/moganad-estate',      accent: '#1a237e', batches: 139, ripeCherry:  58953, dryParchment: 14027, outturn: 23.8 },
      { name: 'Orchardale Estate',   code: 'OE · Yercaud',  icon: '🌱', href: '/processing-dashboard/2023-2024/orchardale-estate',   accent: '#4a148c', batches:  91, ripeCherry:  42808, dryParchment: 10583, outturn: 24.7 },
      { name: 'Bison Valley Estate', code: 'BVE · Yercaud', icon: '🦬', href: '/processing-dashboard/2023-2024/bve',                accent: '#e65100', batches:  82, ripeCherry:  30326, dryParchment:  6179, outturn: 20.4 },
      { name: 'Hidden Falls Estate', code: 'HFE · Yercaud', icon: '🌊', href: '/processing-dashboard/2023-2024/hidden-falls-estate', accent: '#006064', batches: 144, ripeCherry:  35310, dryParchment:  8134, outturn: 23.0 },
    ],
    naturals: 340,
    washed:   230,
    honeyPsd:   6,
    robusta:    0,
  },
  {
    label: '2022 – 2023',
    estates: [
      { name: 'Stanmore Estate',     code: 'SE · Yercaud',  icon: '🌿', href: '/processing-dashboard/2022-2023/stanmore-estate',     accent: '#1b5e20', batches: 167, ripeCherry:  99931, dryParchment: 27847, outturn: 27.9 },
      { name: 'Moganad Estate',      code: 'ME · Yercaud',  icon: '☕', href: '/processing-dashboard/2022-2023/moganad-estate',      accent: '#1a237e', batches: 131, ripeCherry:  82963, dryParchment: 23178, outturn: 27.9 },
      { name: 'Orchardale Estate',   code: 'OE · Yercaud',  icon: '🌱', href: '/processing-dashboard/2022-2023/orchardale-estate',   accent: '#4a148c', batches: 128, ripeCherry:  54037, dryParchment: 13863, outturn: 25.7 },
      { name: 'Bison Valley Estate', code: 'BVE · Yercaud', icon: '🦬', href: '/processing-dashboard/2022-2023/bve',                accent: '#e65100', batches:  80, ripeCherry:  45041, dryParchment:  9990, outturn: 22.2 },
      { name: 'Hidden Falls Estate', code: 'HFE · Yercaud', icon: '🌊', href: '/processing-dashboard/2022-2023/hidden-falls-estate', accent: '#006064', batches: 106, ripeCherry:  34769, dryParchment: 11347, outturn: 32.6 },
    ],
    naturals: 549,
    washed:    45,
    honeyPsd:  18,
    robusta:    0,
  },
  {
    label: '2021 – 2022',
    estates: [
      { name: 'Stanmore Estate',     code: 'SE · Yercaud',  icon: '🌿', href: '/processing-dashboard/2021-2022/stanmore-estate',     accent: '#1b5e20', batches: 168, ripeCherry:  72564, dryParchment: 18018, outturn: 24.8 },
      { name: 'Moganad Estate',      code: 'ME · Yercaud',  icon: '☕', href: '/processing-dashboard/2021-2022/moganad-estate',      accent: '#1a237e', batches: 154, ripeCherry:  68612, dryParchment: 18888, outturn: 27.5 },
      { name: 'Orchardale Estate',   code: 'OE · Yercaud',  icon: '🌱', href: '/processing-dashboard/2021-2022/orchardale-estate',   accent: '#4a148c', batches: 152, ripeCherry:  61490, dryParchment: 15557, outturn: 25.3 },
      { name: 'Bison Valley Estate', code: 'BVE · Yercaud', icon: '🦬', href: '/processing-dashboard/2021-2022/bve',                accent: '#e65100', batches: 107, ripeCherry:  32431, dryParchment:  7098, outturn: 21.9 },
      { name: 'Hidden Falls Estate', code: 'HFE · Yercaud', icon: '🌊', href: '/processing-dashboard/2021-2022/hidden-falls-estate', accent: '#006064', batches: 191, ripeCherry:  41909, dryParchment: 10819, outturn: 25.8 },
    ],
    naturals: 740,
    washed:     0,
    honeyPsd:  32,
    robusta:    0,
  },
  {
    label: '2020 – 2021',
    estates: [
      { name: 'Stanmore Estate',     code: 'SE · Yercaud',  icon: '🌿', href: '/processing-dashboard/2020-2021/stanmore-estate',     accent: '#1b5e20', batches: 156, ripeCherry:  74658, dryParchment: 17620, outturn: 23.6 },
      { name: 'Moganad Estate',      code: 'ME · Yercaud',  icon: '☕', href: '/processing-dashboard/2020-2021/moganad-estate',      accent: '#1a237e', batches: 304, ripeCherry:  67528, dryParchment: 15119, outturn: 22.4 },
      { name: 'Orchardale Estate',   code: 'OE · Yercaud',  icon: '🌱', href: '/processing-dashboard/2020-2021/orchardale-estate',   accent: '#4a148c', batches: 129, ripeCherry:  39936, dryParchment: 10825, outturn: 27.1 },
      { name: 'Bison Valley Estate', code: 'BVE · Yercaud', icon: '🦬', href: '/processing-dashboard/2020-2021/bve',                accent: '#e65100', batches: 155, ripeCherry:  36145, dryParchment: 11266, outturn: 31.2 },
      { name: 'Hidden Falls Estate', code: 'HFE · Yercaud', icon: '🌊', href: '/processing-dashboard/2020-2021/hidden-falls-estate', accent: '#006064', batches: 147, ripeCherry:  37693, dryParchment:  9244, outturn: 24.5 },
    ],
    naturals: 746,
    washed:    89,
    honeyPsd:  56,
    robusta:    0,
  },
];

function fmtIN(n: number) {
  return n.toLocaleString('en-IN');
}

function pct(n: number) {
  return n.toFixed(1) + '%';
}

export default function ProcessingDashboardPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const season = SEASONS[activeIdx];

  const totalBatches      = season.estates.reduce((s, e) => s + e.batches, 0);
  const totalRipe         = season.estates.reduce((s, e) => s + e.ripeCherry, 0);
  const totalDry          = season.estates.reduce((s, e) => s + e.dryParchment, 0);
  const avgOutturn        = (totalDry / totalRipe) * 100;
  const totalProcessBatch = season.naturals + season.washed + season.honeyPsd + season.robusta;
  const reportPayload = {
    type: 'production_report' as const,
    reportTitle: `Processing Summary ${season.label}`,
    sourcePath: '/processing-dashboard',
    subject: `MSP Coffee Processing Summary - ${season.label}`,
    attachmentName: `processing-summary-${season.label.replace(/\s/g, '')}.html`,
    data: {
      summary: [
        { label: 'Total Batches', value: fmtIN(totalBatches), detail: 'Across all 5 estates' },
        { label: 'Ripe Cherry', value: `${fmtIN(totalRipe)} kg`, detail: 'Season input' },
        { label: 'Dry Parchment', value: `${fmtIN(totalDry)} kg`, detail: 'Season output' },
        { label: 'Average Outturn', value: pct(avgOutturn), detail: 'Cherry to dry parchment' },
      ],
      sections: [
        {
          title: 'Estate Performance',
          rows: season.estates.map((estate) => ({
            label: estate.name,
            value: `${fmtIN(estate.dryParchment)} kg dry parchment`,
            detail: `${fmtIN(estate.ripeCherry)} kg ripe cherry, ${estate.batches} batches, ${pct(estate.outturn)} outturn`,
          })),
        },
        {
          title: 'Process Breakdown',
          rows: [
            { label: 'Naturals', value: fmtIN(season.naturals), detail: 'Batches' },
            { label: 'Washed', value: fmtIN(season.washed), detail: 'Batches' },
            { label: 'Honey / PSD', value: fmtIN(season.honeyPsd), detail: 'Batches' },
            { label: 'Robusta', value: fmtIN(season.robusta), detail: 'Batches' },
          ],
        },
      ],
    },
  };

  return (
    <div style={{ color: '#1a1a1a' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, color: '#1b4a1b', fontSize: '1.45rem', fontWeight: 800 }}>Processing Data</h1>
          <p style={{ margin: '3px 0 0', color: '#6b7280', fontSize: '.84rem' }}>Review estate production and share season summaries.</p>
        </div>
        <EmailReportButton payload={reportPayload} />
      </div>

      {/* ── Season tabs ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5dfc8', marginBottom: 20, background: '#f5eedc', borderRadius: '10px 10px 0 0', overflow: 'hidden' }}>
        {SEASONS.map((s, i) => (
          <button
            key={s.label}
            onClick={() => setActiveIdx(i)}
            style={{
              padding: '10px 22px',
              fontSize: '.78rem',
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: activeIdx === i ? '#1b4a1b' : '#6b7280',
              background: 'transparent',
              border: 'none',
              borderBottom: activeIdx === i ? '3px solid #2d6e2d' : '3px solid transparent',
              cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Summary strip ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Total Batches',  value: fmtIN(totalBatches), sub: 'across all 5 estates' },
          { label: 'Ripe Cherry',    value: fmtIN(totalRipe),    sub: 'kg input this season' },
          { label: 'Dry Parchment',  value: fmtIN(totalDry),     sub: 'kg output this season' },
          { label: 'Avg Outturn',    value: pct(avgOutturn),     sub: 'cherry to dry parchment' },
        ].map((card) => (
          <div key={card.label} style={{
            background: '#fff',
            border: '1px solid #e5dfc8',
            borderRadius: 10,
            padding: '14px 18px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#2d6e2d' }} />
            <div style={{ fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', color: '#6b7280', marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 700, color: '#1b4a1b', lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: '.7rem', color: '#9ca3af', marginTop: 4 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Estates ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#374151', whiteSpace: 'nowrap' }}>Estates</h2>
        <div style={{ flex: 1, height: 1, background: '#e5dfc8' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        {season.estates.map((estate) => (
          <Link
            key={estate.href}
            href={estate.href}
            style={{
              background: '#fff',
              border: '1px solid #e5dfc8',
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 2px 14px rgba(27,74,27,.07)',
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
              transition: 'transform .15s, box-shadow .15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(27,74,27,.14)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = '';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 14px rgba(27,74,27,.07)';
            }}
          >
            {/* Card top */}
            <div style={{ padding: '18px 18px 14px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: estate.accent }} />
              <div style={{ fontSize: '1.6rem', marginBottom: 8, marginTop: 4 }}>{estate.icon}</div>
              <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#1b4a1b', lineHeight: 1.25, marginBottom: 2 }}>{estate.name}</div>
              <div style={{ fontSize: '.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#9ca3af' }}>{estate.code}</div>
            </div>

            {/* KPI grid */}
            <div style={{ padding: '12px 18px 14px', borderTop: '1px solid #f0ead4', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Batches',     value: fmtIN(estate.batches),      unit: 'this season' },
                { label: 'Ripe Cherry', value: fmtIN(estate.ripeCherry),   unit: 'kg input' },
                { label: 'Dry Parch',   value: fmtIN(estate.dryParchment), unit: 'kg output' },
                { label: 'Outturn',     value: pct(estate.outturn),        unit: 'avg' },
              ].map((kpi) => (
                <div key={kpi.label}>
                  <div style={{ fontSize: '.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#9ca3af' }}>{kpi.label}</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1b4a1b', lineHeight: 1.1 }}>{kpi.value}</div>
                  <div style={{ fontSize: '.6rem', color: '#6b7280' }}>{kpi.unit}</div>
                </div>
              ))}
            </div>

            {/* Outturn bar */}
            <div style={{ padding: '0 18px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#9ca3af', marginBottom: 4 }}>
                <span>Outturn</span><span>{pct(estate.outturn)}</span>
              </div>
              <div style={{ height: 5, background: '#f0ead4', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#2d6e2d,#4a9e4a)', width: `${Math.min(estate.outturn * 2, 100)}%` }} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '6px 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#2d6e2d', display: 'flex', alignItems: 'center', gap: 4 }}>
                Open Dashboard <ArrowRight style={{ width: 12, height: 12 }} />
              </span>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4a9e4a' }} />
            </div>
          </Link>
        ))}
      </div>

      {/* ── Process breakdown ────────────────────────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#374151', whiteSpace: 'nowrap' }}>Season Breakdown by Process</h2>
          <div style={{ flex: 1, height: 1, background: '#e5dfc8' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { icon: '🌿', bg: '#e8f5e9', name: 'Naturals',   count: season.naturals  },
            { icon: '💧', bg: '#e3f2fd', name: 'Washed',     count: season.washed    },
            { icon: '🍯', bg: '#fff8e1', name: 'Honey / PSD',count: season.honeyPsd  },
            { icon: '☕', bg: '#f3e5f5', name: 'Robusta',    count: season.robusta   },
          ].map((p) => (
            <div key={p.name} style={{
              background: '#fff',
              border: '1px solid #e5dfc8',
              borderRadius: 10,
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: p.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                {p.icon}
              </div>
              <div>
                <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.06em' }}>{p.name}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1b4a1b', lineHeight: 1.1 }}>{fmtIN(p.count)}</div>
                <div style={{ fontSize: '.63rem', color: '#9ca3af' }}>batches · {Math.round((p.count / totalProcessBatch) * 100)}% of season</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
