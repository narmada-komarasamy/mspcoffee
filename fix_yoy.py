with open("src/app/(dashboard)/rainfall/page.tsx", "r") as f:
 content = f.read()

# Fix the broken YoY metrics block - find and replace the entire broken section
old_block = """<div className={s.yoyMetrics}>
<div className={s.yoyMetrics}> style={{ flex: "0 0 auto" }}>
<div className={s.yoyMetrics}> style={{ fontSize: "0.65rem", color: "var(--t-muted)", fontWeight: 700, fontFamily: "var(--t-font-mono)" }}>{year}</div>
<div className={s.yoyMetrics}> style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--t-heading)", lineHeight: 1 }}>{current}<span style={{ fontSize: "0.75rem", color: "var(--t-muted)" }}> {unitStr}</span></div>
 </div>
 <div className={s.yoyArrow}>→</div>
<div className={s.yoyMetrics}> style={{ flex: "0 0 auto" }}>
<div className={s.yoyMetrics}> style={{ fontSize: "0.65rem", color: "var(--t-muted)", fontWeight: 700, fontFamily: "var(--t-font-mono)" }}>{priorYearNum}</div>
<div className={s.yoyMetrics}> style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--t-muted)", lineHeight: 1 }}>{prior}<span style={{ fontSize: "0.7rem" }}> {unitStr}</span></div>
 </div>
<div className={s.yoyMetrics}> style={{ fontSize: "0.82rem", fontWeight: 800, color: up ? "#16a34a" : "#dc2626", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
 {up ? "▲" : "▼"} {Math.abs(delta)} {unitStr}
 {pct !== null && <span style={{ fontSize: "0.78rem", opacity: 0.85 }}>({up ? "+" : ""}{pct}%)</span>}
 </div>
 </div>"""

new_block = """ <div className={s.yoyMetrics}>
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

if old_block in content:
 content = content.replace(old_block, new_block, 1)
 print("Fixed YoY card block")
else:
 print("Block not found, checking...")
 idx = content.find("yoyMetrics")
 print("Found at:", idx)
 print("Context:", repr(content[idx:idx+200]))

with open("src/app/(dashboard)/rainfall/page.tsx", "w") as f:
 f.write(content)
print("Saved")
