from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1800, 620
img = Image.new("RGB", (W, H), "#f5eedc")
d = ImageDraw.Draw(img)

fp = "/System/Library/Fonts/Helvetica.ttc"
def lf(sz):
	if os.path.exists(fp):
		try:
			return ImageFont.truetype(fp, sz)
		except Exception:
			pass
	return ImageFont.load_default()

ft = lf(22)
fs = lf(14)
fl = lf(10)
fm = lf(9)
fn = lf(11)

d.text((40, 20), "MSP Coffee — Estate Rainfall Comparison", fill="#1b4a1b", font=ft)
d.text((40, 50), "May 2026 selected · rainfall + rainy days per estate · 5-year timeline", fill="#6b7280", font=fs)

d.rounded_rectangle([40, 76, 52, 88], radius=2, fill="#4a9e4a")
d.text((58, 75), "Selected year", fill="#374151", font=fm)
d.rounded_rectangle([160, 76, 172, 88], radius=2, fill="#d1d5db")
d.text((178, 75), "Previous years", fill="#6b7280", font=fm)
d.rounded_rectangle([290, 76, 302, 88], radius=2, fill="#d1d5db")
d.text((308, 75), "Future years", fill="#9ca3af", font=fm)

ESTATES = [
	{"name": "Stanmore", "color": "#7c3aed", "data": {2024:(78,8), 2025:(65,7), 2026:(70,7), 2027:(82,8), 2028:(75,7)}},
	{"name": "Orchardale", "color": "#d97706", "data": {2024:(55,5), 2025:(48,5), 2026:(52,6), 2027:(60,6), 2028:(58,5)}},
	{"name": "Hidden Falls", "color": "#dc2626", "data": {2024:(90,9), 2025:(85,8), 2026:(80,8), 2027:(95,10), 2028:(88,9)}},
	{"name": "Gowri", "color": "#2563eb", "data": {2024:(62,6), 2025:(58,6), 2026:(55,5), 2027:(65,7), 2028:(60,6)}},
	{"name": "Moganad", "color": "#059669", "data": {2024:(45,4), 2025:(40,4), 2026:(42,4), 2027:(48,5), 2028:(46,4)}},
	{"name": "Vyapurikuttai", "color": "#ea580c", "data": {2024:(70,7), 2025:(65,6), 2026:(60,6), 2027:(72,7), 2028:(68,7)}},
]

YEARS = [2024, 2025, 2026, 2027, 2028]
SEL = 2026

cw = 280
ch = 480
gap = 16
sx = 40
sy = 105

for i, est in enumerate(ESTATES):
	cx = sx + i * (cw + gap)
	cy = sy
	c = est["color"]

	d.rounded_rectangle([cx, cy, cx+cw, cy+ch], radius=10, fill="#fdf6e3", outline="#e5dfc8", width=1)
	d.rounded_rectangle([cx, cy+10, cx+4, cy+ch-10], radius=2, fill=c)

	d.ellipse([cx+14, cy+16, cx+24, cy+26], fill=c)
	d.text((cx+30, cy+14), est["name"], fill="#1b4a1b", font=fl)
	d.line([cx+14, cy+34, cx+cw-14, cy+34], fill="#e5dfc8", width=1)
	tx = cx + 14
	ty = cy + 55
	vals = [v[0] for v in est["data"].values()]
	mx = max(vals) if vals else 1
	rh = 75

	for j, yr in enumerate(YEARS):
		ry = ty + j * rh
		is_sel = (yr == SEL)

		if is_sel:
			d.rounded_rectangle([tx-4, ry-2, tx+242, ry+rh-2], radius=6, fill="#ffffff", outline=c, width=2)

		yc = "#4a9e4a" if is_sel else ("#6b7280" if yr < SEL else "#9ca3af")
		d.text((tx+2, ry+4), str(yr), fill=yc, font=fn)

		dx = tx + 32
		dy = ry + 16
		dr = 7 if is_sel else 4
		fc = c if is_sel else "#d1d5db"
		d.ellipse([dx-dr, dy-dr, dx+dr, dy+dr], fill=fc, outline=fc, width=2 if is_sel else 0)
		if is_sel:
			d.ellipse([dx-dr-3, dy-dr-3, dx+dr+3, dy+dr+3], outline=c, width=2)

		mm = est["data"][yr][0]
		bx = tx + 48
		by = ry + 22
		bw = int((mm / mx) * 140)
		bh = 10
		if is_sel:
			d.rounded_rectangle([bx, by, bx+bw, by+bh], radius=3, fill=c)
		else:
			d.rounded_rectangle([bx, by, bx+bw, by+bh], radius=3, fill="#e5dfc8")

		tc = c if is_sel else "#9ca3af"
		d.text((bx+bw+5, by+1), str(mm)+"mm", fill=tc, font=fn if is_sel else fm)

		rd = est["data"][yr][1]
		rdy = by + bh + 5
		d.ellipse([bx, rdy, bx+5, rdy+5], fill="#9ca3af")
		d.text((bx+9, rdy-1), str(rd)+" rainy days", fill="#9ca3af", font=fm)

	by2 = cy + ch - 40
	d.line([cx+14, by2, cx+cw-14, by2], fill="#e5dfc8", width=1)
	d.text((cx+14, by2+8), "5yr avg: 68mm · 6% drier vs 5yr · Rank #3", fill="#6b7280", font=fm)

out = "/sessions/jolly-busy-lovelace/mnt/mspcoffee/estate-mockup.png"
img.save(out, "PNG")
print("Saved " + out)
