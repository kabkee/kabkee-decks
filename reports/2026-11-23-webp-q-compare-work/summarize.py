#!/usr/bin/env python3
"""metrics/tiles.csv → 장면별 요약 + 장면마다 «가장 차이가 심한 곳» 선정 → metrics/summary.json

사용법: python3 -P scripts/summarize.py <작업폴더>

최악 영역 선정 기준 (q60 기준으로 고른 뒤, 같은 위치를 q70·q75 에서도 보여 준다):
  - ssim : 64×64 블록 평균 SSIM 이 가장 낮은 곳 (뭉개짐·띠 현상)
  - err  : 64×64 블록 평균 RGB 오차가 가장 큰 곳 (색 번짐·경계 손실)
  - edge : 원본의 강한 경계(글자·윤곽) 위 밝기 오차가 가장 큰 곳
  앞서 고른 곳과 같은 타일·근처(128px 이내)면 다음 후보로 넘긴다.
"""
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

root = Path(sys.argv[1]).resolve()
rows = list(csv.DictReader(open(root / "metrics" / "tiles.csv")))
for r in rows:
    for k in ("q", "w", "h", "jpg_bytes", "webp_bytes", "ssim_blk_x", "ssim_blk_y", "err_blk_x", "err_blk_y", "edge_blk_x", "edge_blk_y"):
        r[k] = int(r[k])
    for k in ("ssim", "ssim_blk_min", "err_blk_max", "edge_blk_max", "mae"):
        r[k] = float(r[k])

# 목록.txt 에서 장면 이름
names = {}
for line in open(root / "src" / "목록.txt", encoding="utf-8"):
    m = re.match(r"\s*(pano/\d+/\d+/\d+)\s+(.+?)\s{2,}", line)
    if m:
        names[m.group(1)] = m.group(2).strip()

scene_of = lambda t: "/".join(t.split("/")[:4])
by = defaultdict(lambda: defaultdict(list))  # scene -> q -> rows
for r in rows:
    by[scene_of(r["tile"])][r["q"]].append(r)


def pct(a, b):
    return round((a / b - 1) * 100, 1)


def p(vals, f):
    s = sorted(vals)
    return s[min(len(s) - 1, int(len(s) * f))]


out = []
for scene in sorted(by, key=lambda s: list(names).index(s) if s in names else 99):
    qs = by[scene]
    jpg = sum(r["jpg_bytes"] for r in qs[60])
    stat = {}
    for q, rs in sorted(qs.items()):
        wb = sum(r["webp_bytes"] for r in rs)
        ss = [r["ssim"] for r in rs]
        stat[q] = {
            "webp_bytes": wb, "change_pct": pct(wb, jpg),
            "ssim_mean": round(sum(ss) / len(ss), 4), "ssim_p5": round(p(ss, 0.05), 4),
            "ssim_min": round(min(ss), 4),
            "grown": sum(1 for r in rs if r["webp_bytes"] > r["jpg_bytes"]),
            "mae_mean": round(sum(r["mae"] for r in rs) / len(rs), 3),
        }
    # 최악 영역 (q60 기준)
    q60 = qs[60]
    look = {(r["tile"], r["q"]): r for q in qs for r in qs[q]}
    KEY = {"ssim": ("ssim_blk_min", 1), "err": ("err_blk_max", -1), "edge": ("edge_blk_max", -1)}
    picked = []

    def xy(r, kind):
        return r[f"{kind}_blk_x"], r[f"{kind}_blk_y"]

    def region(r, kind):
        x, y = xy(r, kind)
        return {
            "kind": kind, "tile": r["tile"], "w": r["w"], "h": r["h"], "x": x, "y": y, "size": 64,
            "jpg_bytes": r["jpg_bytes"],
            "per_q": {q: {"webp_bytes": look[(r["tile"], q)]["webp_bytes"],
                          "ssim": look[(r["tile"], q)]["ssim"],
                          "mae": look[(r["tile"], q)]["mae"]} for q in sorted(qs)},
            "value": {q: look[(r["tile"], q)][KEY[kind][0]] for q in sorted(qs)},
        }

    for kind, (col, sign) in KEY.items():
        for r in sorted(q60, key=lambda r: sign * r[col]):
            x, y = xy(r, kind)
            if any(g["tile"] == r["tile"] and abs(g["x"] - x) < 128 and abs(g["y"] - y) < 128 for g in picked):
                continue
            picked.append(region(r, kind))
            break

    out.append({
        "scene": scene, "name": names.get(scene, ""), "tiles": len(q60), "jpg_bytes": jpg,
        "stat": stat, "regions": picked,
    })

tot = {"jpg": sum(s["jpg_bytes"] for s in out)}
for q in (60, 70, 75):
    w = sum(s["stat"][q]["webp_bytes"] for s in out)
    tot[q] = {"webp_bytes": w, "change_pct": pct(w, tot["jpg"])}
json.dump({"scenes": out, "total": tot}, open(root / "metrics" / "summary.json", "w"), ensure_ascii=False, indent=1)

print(f"{'장면':<16}{'이름':<26}{'JPG MB':>7} | " + " | ".join(f"q{q} 변화 SSIM평균/p5 커짐" for q in (60, 70, 75)))
for s in out:
    print(f"{s['scene']:<16}{s['name'][:24]:<26}{s['jpg_bytes']/1e6:7.2f} | " + " | ".join(
        f"{s['stat'][q]['change_pct']:+6.1f}% {s['stat'][q]['ssim_mean']:.3f}/{s['stat'][q]['ssim_p5']:.3f} {s['stat'][q]['grown']:3d}"
        for q in (60, 70, 75)))
print("합계", tot)
for s in out:
    for g in s["regions"]:
        print(s["scene"], g["kind"], g["tile"], g["x"], g["y"], g["value"])
