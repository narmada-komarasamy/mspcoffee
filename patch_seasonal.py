content = open("src/app/(dashboard)/rainfall/page.tsx", "r").read()

insertion_marker = " {/* —— Estate Comparison Cards"

if insertion_marker in content:
 idx = content.index(insertion_marker)
 before = content[:idx]
 marker = " </div>\n\n"
 last_idx = before.rfind(marker)

 seasonal_block = """ </div>

 {/* ─── Seasonal Profile ──────────────────────────────────────── */}
 <div className={s.sectionLabel}>Seasonal Rainfall Profile</div>
 <div className={s.seasonGrid}>
 {[
 { emoji: "🌧️", name: "Southwest Monsoon", range: "Jun–Sep", rangeColor: "#2563eb", note: "Peak: Jul–Aug · Avg 280–340 mm" },
 { emoji: "🌦️", name: "Northeast Monsoon", range: "Oct–Dec", rangeColor: "#0891b2", note: "Peak: Oct–Nov · Avg 180–260 mm" },
 { emoji: "☀️", name: "Winter / Dry", range: "Jan–Feb", rangeColor: "#d97706", note: "Minimal rainfall · Avg 15–35 mm" },
 { emoji: "🔥", name: "Summer / Pre-monsoon", range: "Mar–May", rangeColor: "#dc2626", note: "Dry spells · Avg 40–80 mm" },
 ].map((s) => (
 <div key={s.name} className={s.seasonCard}>
 <div className={s.seasonEmoji}>{s.emoji}</div>
 <div className={s.seasonName}>{s.name}</div>
 <div className={s.seasonRange} style={{ color: s.rangeColor }}>{s.range}</div>
 <div className={s.seasonNote}>{s.note}</div>
 </div>
 ))}
 </div>

"""
 content = content[:last_idx + len(marker)] + seasonal_block + content[last_idx + len(marker):]
 open("src/app/(dashboard)/rainfall/page.tsx", "w").write(content)
 print("Inserted seasonal profile successfully")
else:
 print("Marker not found")
 lines = content.split("\n")
 for li in range(670, 676):
 ln = li + 1
 print(str(ln) + ": " + repr(lines[li]))
