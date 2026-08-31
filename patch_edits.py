import re

with open("src/app/(dashboard)/rainfall/page.tsx", "r") as f:
 content = f.read()

# 1. Remove the Rainfall Trend chart section entirely
# Find from " {/* ─── Chart" to the closing </div> of chartSection
chart_section_pattern = r" /\* ─── Chart ─.*?\n </div>\n\n"
content = re.sub(chart_section_pattern, "", content, flags=re.DOTALL)
print("Removed Rainfall Trend chart section")

# 2. Restyle the YoY section - update title and card layout
old_yoy_title = '<div className={s.sectionLabel}>Year-over-Year — {priorYearNum} → {year}</div>'
new_yoy_title = '<div className={s.sectionLabel}>Year-over-Year ({priorYearNum} → {year})</div>'
content = content.replace(old_yoy_title, new_yoy_title)
print("Updated YoY title")

# 3. Restyle YoY card internals - make it match the preview
old_card_inner = """ <div className={s.yoyMetrics}>
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
 </div>"""

new_card_inner = """ <div className={s.yoyMetrics}>
 <div style={{ flex: "0 0 auto" }}>
 <div style={{ fontSize: "0.65rem", color: "var(--t-muted)", fontWeight: 700, fontFamily: "var(--t-font-mono)" }}>{year}</div>
 <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--t-heading)", lineHeight: 1 }}>{current}<span style={{ fontSize: "0.75rem", color: "var(--t-muted)" }}> {unitStr}</span></div>
 </div>
 <div className={s.yoyArrow}>→</div>
 <div style={{ flex: "0 0 auto" }}>
 <div style={{ fontSize: "0.65rem", color: "var(--t-muted)", fontWeight: 700, fontFamily: "var(--t-font-mono)" }}>{priorYearNum}</div>
 <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--t-muted)", lineHeight: 1 }}>{prior}<span style={{ fontSize: "0.7rem" }}> {unitStr}</span></div>
 </div>
 <div style={{ fontSize: "0.82rem", fontWeight: 800, color: up ? "#16a34a" : "#dc2626", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
 {up ? "▲" : "▼"} {Math.abs(delta)} {unitStr}
 {pct !== null && <span style={{ fontSize: "0.78rem", opacity: 0.85 }}>({up ? "+" : ""}{pct}%)</span>}
 </div>
 </div>"""

if old_card_inner in content:
 content = content.replace(old_card_inner, new_card_inner)
 print("Restyled YoY cards")
else:
 print("WARNING: YoY card inner not found - skipping")

with open("src/app/(dashboard)/rainfall/page.tsx", "w") as f:
 f.write(content)
print("All changes saved")
