#!/usr/bin/env python3
"""장면별 검토 시트: 3곳 × (JPG | q60) 를 2배 확대해 세로로 쌓는다 → compare/review/<장면>.png
사용법: python3 -P scripts/review_sheet.py <작업폴더>"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(sys.argv[1]).resolve()
summ = json.load(open(root / "metrics" / "summary.json"))
CROP, Z = 192, 2
for s in summ["scenes"]:
    rows = []
    for g in s["regions"]:
        cx, cy = g["x"] + 32, g["y"] + 32
        x0 = max(0, min(g["w"] - CROP, cx - CROP // 2)); y0 = max(0, min(g["h"] - CROP, cy - CROP // 2))
        box = (x0, y0, x0 + CROP, y0 + CROP)
        ims = []
        for lab, p in [("JPG", root / "src" / g["tile"]), ("q60", root / "out/q60" / Path(g["tile"]).with_suffix(".webp"))]:
            im = Image.open(p).convert("RGB").crop(box).resize((CROP * Z, CROP * Z), Image.NEAREST)
            d = ImageDraw.Draw(im); d.rectangle((0, 0, 110, 18), fill=0); d.text((4, 3), f"{lab} {g['kind']} {g['tile'].split('/')[-1]}", fill=(255, 255, 255))
            ims.append(im)
        row = Image.new("RGB", (CROP * Z * 2 + 6, CROP * Z), "white"); row.paste(ims[0], (0, 0)); row.paste(ims[1], (CROP * Z + 6, 0)); rows.append(row)
    sheet = Image.new("RGB", (rows[0].width, sum(r.height for r in rows) + 6 * 2), "white")
    y = 0
    for r in rows: sheet.paste(r, (0, y)); y += r.height + 6
    out = root / "compare/review" / (s["scene"].replace("pano/", "").replace("/", "_") + ".png"); sheet.save(out); print(out.name, s["name"])
