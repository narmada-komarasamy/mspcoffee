content = open("src/app/(dashboard)/rainfall/page.tsx", "r").read()

# 1. Remove the Rainfall Trend chart section (lines 741-804 in original, now shifted by 17 due to seasonal insert)
# Find the chart section and YoY section boundaries
chart_start_marker = " {/* ─── Chart ──────────────────────────────────────────────────── */}"
yoy_start_marker = " {/* ─── YoY Delta Summary ──────────────────────────────────────── */}"

if chart_start_marker in content and yoy_start_marker in content:
 chart_idx = content.index(chart_start_marker)
 yoy_idx = content.index(yoy_start_marker)
 content = content[:chart_idx] + content[yoy_idx:]
 print("Removed Rainfall Trend chart")
else:
 print("Markers not found for chart removal")

# Now replace the YoY section
old_yoy = """ {/* ─── YoY Delta Summary ──────────────────────────────────────── */}
 {yoyDelta && (
 <>
 <div className={s.sectionLabel}>Year-over-Year — {priorYearNum} → {year}</div>
 <div className={s.yoyGrid}>
 {yoyDelta.map(({ estate, current, prior, delta, pct }) => {
 const color = theme.estates[estate];
 const up = delta >= 0;
 return (
 <div key={estate} className={s.yoyCard}>
 <div className={s.yoyCardHeader}>
 <span className={s.estateDot} style={{ backgroundColor: color }} />
 <span className={s.yoyEstate} style={{ color }}>{estate}</span>
 </div>
 <div className={s.yoyMetrics}>
 <div className={s.yoyMetric}>
 <div className={s.yoyMetricLabel}>{year}</div>
 <div className={s.yoyMetricVal}>{current}<span className={s.yoyMetricUnit}>{unitStr}</span></div>
 </div>
 <div className={s.yoyArrow}>→</div>
 <div className={s.yoyMetric}>
 <div className={s.yoyMetricLabel}>{priorYearNum}</div>
 <div className={s.yoyMetricVal}>{prior}<span className={s.yoyMetricUnit}>{unitStr}</span></div>
 </div>
 <div className={s.yoyDelta} style={{ color: up ? "#4ade80" : "#f87171" }}>
 {up ? "▲" : "▼"} {Math.abs(delta)}{unitStr}
 {pct !== null && <span className={s.yoyPct}>{up ? "+" : ""}{pct}%</span>}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </>
 )}"""

new_yoy = """ {/* ─── YoY Delta Summary ──────────────────────────────────────── */}
 {yoyDelta && (
 <>
 <div className={s.sectionLabel}>Year-over-Year ({priorYearNum} → {year})</div>
 <div className={s.yoyGrid}>
 {yoyDelta.map(({ estate, current, prior, delta, pct }) => {
 const color = theme.estates[estate];
 const up = delta >= 0;
 return (
 <div key={estate} className={s.yoyCard}>
 <div className={s.yoyCardHeader}>
 <span className={s.estateDot} style={{ backgroundColor: color }} />
 <span className={s.yoyEstate} style={{ color }}>{estate}</span>
 </div>
 <div className={s.yoyMetrics}>
 <div style={{ flex: "0 0 auto" }}>
 <div style={{ fontSize: "0.65rem", color: "var(--t-muted)", fontWeight: 700, fontFamily: "var(--t-font-mono)" }}>{year}</div>
 <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--t-heading)", lineHeight: 1 }}>{current}<span style={{ fontSize: "0.75rem", color: "var(--t-muted)" }}> {unitStr}</span></div>
 </div>
 <div className={s.yoyArrow}>→</div>
 <div style={{ flex: "0 0 auto" }}>
 <div style={{ fontSize: "0.65rem", color: "var(--t-muted)", fontWeight: 700, fontFamily: "var(--t-font-mono)" }}>{priorYearNum}</div>
 <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--t-muted)", lineHeight: 1 }}>{prior}<span style={{ fontSize: "0.7rem" }}> {unitStr}</span></div>
 </div>
 <div className={s.yoyDelta} style={{ color: up ? "#16a34a" : "#dc2626", fontSize: "0.82rem", fontWeight: 800, whiteSpace: "nowrap" }}>
 {up ? "▲" : "▼"} {Math.abs(delta)} {unitStr}
 {pct !== null && <span style={{ fontSize: "0.78rem", opacity: 0.85, marginLeft: 4 }}>({up ? "+" : ""}{pct}%)</span>}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </>
 )}"""

if old_yoy in content:
 content = content.replace(old_yoy, new_yoy, 1)
 print("Restyled YoY cards")
else:
 print("YoY section not found - checking...")
 # show what's there
 idx = content.find("YoY Delta Summary")
 if idx >= 0:
 print("Found at idx:", idx)
 print("Context:", repr(content[idx:idx+100]))

open("src/app/(dashboard)/rainfall/page.tsx", "w").write(content)
print("All changes saved")
