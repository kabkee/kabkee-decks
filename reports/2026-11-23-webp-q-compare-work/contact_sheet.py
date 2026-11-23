#!/usr/bin/env python3
"""summary.json 의 최악 영역을 JPG · q60 · q70 · q75 로 잘라 3배 확대해 가로로 붙인 검토용 PNG.

사용법: python3 -P scripts/contact_sheet.py <작업폴더>   → <작업폴더>/compare/sheets/*.png
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

root = Path(sys.argv[1]).resolve()
summ = json.load(open(root / "metrics" / "summary.json"))
dst = root / "compare" / "sheets"
dst.mkdir(parents=True, exist_ok=True)
CROP, Z = 160, 3

for s in summ["scenes"]:
    for g in s["regions"]:
        cx, cy = g["x"] + 32, g["y"] + 32
        x0 = max(0, min(g["w"] - CROP, cx - CROP // 2))
        y0 = max(0, min(g["h"] - CROP, cy - CROP // 2))
        box = (x0, y0, x0 + min(CROP, g["w"]), y0 + min(CROP, g["h"]))
        srcs = [("JPG", root / "src" / g["tile"])] + [
            (f"q{q}", root / "out" / f"q{q}" / Path(g["tile"]).with_suffix(".webp")) for q in (60, 70, 75)]
        tiles = []
        for label, p in srcs:
            im = Image.open(p).convert("RGB").crop(box)
            im = im.resize((im.width * Z, im.height * Z), Image.NEAREST)
            d = ImageDraw.Draw(im)
            d.rectangle((0, 0, 60, 22), fill=(0, 0, 0))
            d.text((6, 5), label, fill=(255, 255, 255))
            tiles.append(im)
        sheet = Image.new("RGB", (sum(t.width for t in tiles) + 8 * 3, tiles[0].height), (255, 255, 255))
        x = 0
        for t in tiles:
            sheet.paste(t, (x, 0))
            x += t.width + 8
        name = s["scene"].replace("pano/", "").replace("/", "_") + f"_{g['kind']}.png"
        sheet.save(dst / name)
        print(dst / name)
