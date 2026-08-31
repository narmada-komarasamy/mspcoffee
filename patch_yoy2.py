with open("src/app/(dashboard)/rainfall/page.tsx", "r") as f:
 lines = f.readlines()

new_lines = []
skip_until = -1
for i, line in enumerate(lines):
 if skip_until >= 0 and i <= skip_until:
 continue
 skip_until = -1

 # Replace yoyMetric block (lines 817-825) and yoyDelta block (826-830)
 if i == 816 and "yoyMetrics" in line:
 new_lines.append(line)
 # Insert new layout replacing yoyMetric divs
 indent = " "
 new_lines.append(indent + "<div style={{ flex: \"0 0 auto\" }}>\n")
 new_lines.append(indent + " <div style={{ fontSize: \"0.65rem\", color: \"var(--t-muted)\", fontWeight: 700, fontFamily: \"var(--t-font-mono)\" }}>{year}</div>\n")
 new_lines.append(indent + " <div style={{ fontSize: \"1.3rem\", fontWeight: 900, color: \"var(--t-heading)\", lineHeight: 1 }}>{current}<span style={{ fontSize: \"0.75rem\", color: \"var(--t-muted)\" }}> {unitStr}</span></div>\n")
 new_lines.append(indent + "</div>\n")
 new_lines.append(lines[821]) # yoyArrow
 new_lines.append(indent + "<div style={{ flex: \"0 0 auto\" }}>\n")
 new_lines.append(indent + " <div style={{ fontSize: \"0.65rem\", color: \"var(--t-muted)\", fontWeight: 700, fontFamily: \"var(--t-font-mono)\" }}>{priorYearNum}</div>\n")
 new_lines.append(indent + " <div style={{ fontSize: \"1.1rem\", fontWeight: 800, color: \"var(--t-muted)\", lineHeight: 1 }}>{prior}<span style={{ fontSize: \"0.7rem\" }}> {unitStr}</span></div>\n")
 new_lines.append(indent + "</div>\n")
 # Replace yoyDelta with new style
 new_lines.append(indent + "<div style={{ fontSize: \"0.82rem\", fontWeight: 800, color: up ? \"#16a34a\" : \"#dc2626\", whiteSpace: \"nowrap\", display: \"flex\", alignItems: \"center\", gap: 4 }}>\n")
 new_lines.append(indent + " {up ? \"▲\" : \"▼\"} {Math.abs(delta)} {unitStr}\n")
 new_lines.append(indent + " {pct !== null && <span style={{ fontSize: \"0.78rem\", opacity: 0.85 }}>({up ? \"+\" : \"\"}{pct}%)</span>}\n")
 new_lines.append(indent + "</div>\n")
 skip_until = 830
 else:
 new_lines.append(line)

with open("src/app/(dashboard)/rainfall/page.tsx", "w") as f:
 f.writelines(new_lines)
print("Done - YoY cards restyled")
