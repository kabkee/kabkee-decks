#!/usr/bin/env python3
"""타일 외 이미지: 종류별로 q60 경계 오차가 가장 큰 파일의 그 위치를 JPG|q60 2배로 → compare/review/others_<종류>.png
사용법: python3 -P scripts/review_others.py <작업폴더>"""
import csv, sys
from pathlib import Path
from PIL import Image
root = Path(sys.argv[1]).resolve()
TYPES = ['1024_', '512_', 'pv', 'view_', 'sphere_', 'lp', 'thumb_']
typ = lambda t: next(k for k in TYPES if t.split('/')[-1].startswith(k))
rows = [r for r in csv.DictReader(open(root / 'metrics/others.csv')) if r['q'] == '60']
for t in TYPES:
    r = max((r for r in rows if typ(r['tile']) == t), key=lambda r: float(r['edge_blk_max']))
    w, h = int(r['w']), int(r['h']); C = min(192, w, h)
    cx, cy = int(r['edge_blk_x']) + 32, int(r['edge_blk_y']) + 32
    x0 = max(0, min(w - C, cx - C // 2)); y0 = max(0, min(h - C, cy - C // 2))
    ims = [Image.open(p).convert('RGB').crop((x0, y0, x0 + C, y0 + C)).resize((C * 2, C * 2), Image.NEAREST)
           for p in (root / 'src' / r['tile'], root / 'out/q60' / Path(r['tile']).with_suffix('.webp'))]
    sh = Image.new('RGB', (C * 4 + 6, C * 2), 'white'); sh.paste(ims[0], (0, 0)); sh.paste(ims[1], (C * 2 + 6, 0))
    sh.save(root / f'compare/review/others_{t.strip("_")}.png'); print(t, r['tile'], r['edge_blk_max'])
