#!/usr/bin/env python3
"""레거시 큐브 타일(mres_*) → WebP q60·q70·q75 변환 + 화질 측정.

계획 덱(2026-11-18-webp-legacy-tile-plan) 설정 그대로: Pillow quality=Q, method=6, 무손실 끔.

사용법:  python3 -P scripts/convert.py <작업폴더>
  입력 : <작업폴더>/src/pano/**/mres_*/l*/*/*.jpg
  출력 : <작업폴더>/out/q{60,70,75}/pano/**/....webp   (폴더 구조 동일, 확장자만 .webp)
         <작업폴더>/metrics/tiles.csv                  (타일 × 품질별 용량·SSIM·최악 영역)

측정:
  - SSIM: 밝기(Y, BT.601) · 가우시안 11×11 σ1.5 (덱과 동일 방식)
  - 최악 영역: 64×64 블록(32px 간격)으로
      ssim_min  = 블록 평균 SSIM 최저값과 위치 (뭉개짐·띠 현상)
      err_max   = 블록 평균 RGB 절대오차 최대값과 위치 (색 번짐·경계 손실)
      edge_max  = 원본 JPG 의 강한 경계(밝기 기울기 > 24) 위 밝기 오차의 블록 평균 최대값 (글자·윤곽 뭉개짐)
"""
import csv
import io
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

QUALITIES = (60, 70, 75)
BLOCK, STRIDE = 64, 32


def gauss_kernel(size=11, sigma=1.5):
    x = np.arange(size) - size // 2
    k = np.exp(-(x ** 2) / (2 * sigma ** 2))
    return k / k.sum()


K = gauss_kernel()


def blur(a):
    # 분리형 가우시안 (valid 영역만)
    a = np.apply_along_axis(lambda r: np.convolve(r, K, mode="valid"), 1, a)
    a = np.apply_along_axis(lambda c: np.convolve(c, K, mode="valid"), 0, a)
    return a


def luma(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def ssim_map(x, y):
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    mx, my = blur(x), blur(y)
    sxx = blur(x * x) - mx * mx
    syy = blur(y * y) - my * my
    sxy = blur(x * y) - mx * my
    return ((2 * mx * my + c1) * (2 * sxy + c2)) / ((mx * mx + my * my + c1) * (sxx + syy + c2))


def block_extreme(m, offset, worst_low):
    """m 위에서 BLOCK×BLOCK 평균이 가장 나쁜 블록 → (값, x, y). offset 은 m 의 원본 좌표 기준 시작점."""
    h, w = m.shape
    b = min(BLOCK, h, w)
    # 적분영상으로 블록 평균
    ii = np.pad(m.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    ys = list(range(0, h - b + 1, STRIDE)) or [0]
    xs = list(range(0, w - b + 1, STRIDE)) or [0]
    if ys[-1] != h - b:
        ys.append(h - b)
    if xs[-1] != w - b:
        xs.append(w - b)
    best = None
    for y in ys:
        for x in xs:
            s = ii[y + b, x + b] - ii[y, x + b] - ii[y + b, x] + ii[y, x]
            v = s / (b * b)
            if best is None or (v < best[0] if worst_low else v > best[0]):
                best = (v, x + offset, y + offset)
    return best


def work(args):
    root, rel = args
    src = root / "src" / rel
    jpg_bytes = src.stat().st_size
    im = Image.open(src).convert("RGB")
    a = np.asarray(im, dtype=np.float64)
    ya = luma(a)
    gy, gx = np.gradient(ya)
    edge_mask = (np.hypot(gx, gy) > 24).astype(np.float64)
    rows = []
    for q in QUALITIES:
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=q, method=6)
        data = buf.getvalue()
        out = root / "out" / f"q{q}" / Path(rel).with_suffix(".webp")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
        b = np.asarray(Image.open(io.BytesIO(data)).convert("RGB"), dtype=np.float64)
        sm = ssim_map(ya, luma(b))
        off = len(K) // 2
        smin = block_extreme(sm, off, True)
        err = np.abs(a - b).mean(axis=2)
        emax = block_extreme(err, 0, False)
        edge = np.abs(ya - luma(b)) * edge_mask
        gmax = block_extreme(edge, 0, False)
        rows.append({
            "tile": str(rel), "q": q, "w": im.width, "h": im.height,
            "jpg_bytes": jpg_bytes, "webp_bytes": len(data),
            "ssim": round(float(sm.mean()), 5),
            "ssim_blk_min": round(float(smin[0]), 5), "ssim_blk_x": smin[1], "ssim_blk_y": smin[2],
            "err_blk_max": round(float(emax[0]), 3), "err_blk_x": emax[1], "err_blk_y": emax[2],
            "edge_blk_max": round(float(gmax[0]), 3), "edge_blk_x": gmax[1], "edge_blk_y": gmax[2],
            "mae": round(float(err.mean()), 3),
        })
    return rows


def main():
    root = Path(sys.argv[1]).resolve()
    tiles = sorted(p.relative_to(root / "src") for p in (root / "src").glob("pano/*/*/*/mres_*/l*/*/*.jpg"))
    print(f"타일 {len(tiles)}장 × 품질 {QUALITIES}", flush=True)
    (root / "metrics").mkdir(exist_ok=True)
    fields = ["tile", "q", "w", "h", "jpg_bytes", "webp_bytes", "ssim", "ssim_blk_min", "ssim_blk_x",
              "ssim_blk_y", "err_blk_max", "err_blk_x", "err_blk_y", "edge_blk_max", "edge_blk_x", "edge_blk_y", "mae"]
    with open(root / "metrics" / "tiles.csv", "w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=fields)
        wr.writeheader()
        with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) - 2)) as ex:
            for i, rows in enumerate(ex.map(work, [(root, t) for t in tiles], chunksize=8), 1):
                wr.writerows(rows)
                if i % 500 == 0:
                    print(f"  {i}/{len(tiles)}", flush=True)
    print("완료", flush=True)


if __name__ == "__main__":
    main()
