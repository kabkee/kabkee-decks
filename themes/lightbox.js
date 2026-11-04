/* 스크린샷 클릭 → 확대 보기
   · 열면 먼저 화면에 꽉 맞춰 보여주고, 한 번 더 누르면 원본 100% 크기로 확대
   · 확대 상태에서 드래그(모바일은 한 손가락)로 이동, 휠·핀치로 자유 배율
   · ESC·✕·배경 클릭으로 닫기 (오너 상시 요구 · 2026-10-06 도입)                      */
(() => {
  if (window.__lb) return; window.__lb = 2;   // 2 = 원본 크기 확대판(2026-11-04)

  const PAD = 28, MAXZ = 4;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;display:none;overflow:hidden;' +
    'background:rgba(10,14,22,.93);touch-action:none;-webkit-user-select:none;user-select:none';

  const im = document.createElement('img');
  im.draggable = false;
  im.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;background:#fff;' +
    'border-radius:4px;box-shadow:0 12px 44px rgba(0,0,0,.5);will-change:transform';
  ov.appendChild(im);

  const hud = document.createElement('div');
  hud.style.cssText = 'position:absolute;right:16px;top:14px;display:flex;gap:8px;align-items:center;' +
    'font:600 13px/1 system-ui,-apple-system,sans-serif;color:#eaf0fb;pointer-events:none';
  const chip = 'background:rgba(255,255,255,.15);padding:8px 12px;border-radius:999px;backdrop-filter:blur(6px)';
  const tip = document.createElement('span'); tip.style.cssText = chip + ';transition:opacity .4s';
  const pct = document.createElement('span'); pct.style.cssText = chip + ';font-variant-numeric:tabular-nums';
  const xb  = document.createElement('button'); xb.textContent = '✕'; xb.setAttribute('aria-label', '닫기');
  xb.style.cssText = chip + ';pointer-events:auto;border:0;color:#fff;width:36px;height:36px;padding:0;' +
    'font:600 16px/1 system-ui;cursor:pointer';
  hud.append(tip, pct, xb);
  ov.appendChild(hud);

  let nw = 0, nh = 0, fit = 1, s = 1, tx = 0, ty = 0;
  let drag = false, lx = 0, ly = 0, moved = false, tipT = 0;

  const clamp = () => {
    const W = innerWidth, H = innerHeight, w = nw * s, h = nh * s;
    tx = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, tx));
    ty = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, ty));
  };
  const draw = () => {
    im.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
    pct.textContent = Math.round(s * 100) + '%';
    const big = nw * s > innerWidth + 1 || nh * s > innerHeight + 1;
    im.style.cursor = big ? (drag ? 'grabbing' : 'grab') : (s < 1 ? 'zoom-in' : 'zoom-out');
  };
  const zoom = (ns, cx, cy) => {
    ns = Math.max(Math.min(fit, 1) * 0.9, Math.min(ns, MAXZ));
    const k = ns / s;
    tx = cx - (cx - tx) * k; ty = cy - (cy - ty) * k;
    s = ns; clamp(); draw();
  };
  const showTip = (t) => {
    tip.textContent = t; tip.style.opacity = '1';
    clearTimeout(tipT); tipT = setTimeout(() => { tip.style.opacity = '0'; }, 2600);
  };
  const close = () => { ov.style.display = 'none'; im.removeAttribute('src'); document.body.style.overflow = ''; };

  const open = (src) => {
    im.onload = () => {
      nw = im.naturalWidth; nh = im.naturalHeight;
      im.style.width = nw + 'px'; im.style.height = nh + 'px';
      fit = Math.min((innerWidth - PAD * 2) / nw, (innerHeight - PAD * 2) / nh);
      s = Math.min(fit, 1);            // 원본보다 크게는 띄우지 않는다
      tx = ty = 0; clamp(); draw();
      showTip(fit < 0.995 ? '클릭하면 원본 크기 · 드래그 이동 · ESC 닫기' : '휠로 확대 · ESC 닫기');
    };
    im.src = src;
    ov.style.display = 'block';
    document.body.style.overflow = 'hidden';
  };

  // 배경 클릭 → 닫기 / 이미지 클릭 → 맞춤 ↔ 원본 토글
  ov.addEventListener('click', (e) => {
    e.stopPropagation();
    if (moved) { moved = false; return; }
    if (e.target === xb || e.target === ov) { close(); return; }
    if (e.target === im) {
      const f = Math.min(fit, 1);
      zoom(s > f + 0.005 ? f : Math.max(1, f * 2), e.clientX, e.clientY);
    }
  });

  // 드래그 이동 (마우스 · 터치 공통)
  im.addEventListener('pointerdown', (e) => {
    if (nw * s <= innerWidth && nh * s <= innerHeight) return;
    drag = true; moved = false; lx = e.clientX; ly = e.clientY;
    im.setPointerCapture(e.pointerId); draw(); e.preventDefault();
  });
  im.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    tx += dx; ty += dy; lx = e.clientX; ly = e.clientY; clamp(); draw();
  });
  const endDrag = (e) => { if (drag) { drag = false; try { im.releasePointerCapture(e.pointerId); } catch (_) {} draw(); } };
  im.addEventListener('pointerup', endDrag);
  im.addEventListener('pointercancel', endDrag);

  // 휠 줌 (슬라이드 전환으로 새지 않게 차단)
  ov.addEventListener('wheel', (e) => {
    e.preventDefault(); e.stopPropagation();
    zoom(s * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX, e.clientY);
  }, { passive: false });

  // 핀치 줌
  let pts = new Map(), pd = 0;
  ov.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') pts.set(e.pointerId, e); });
  ov.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch' || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, e);
    if (pts.size !== 2) return;
    const [a, b] = [...pts.values()];
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (pd) { moved = true; zoom(s * (d / pd), (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2); }
    pd = d;
  });
  const dropPt = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pd = 0; };
  ov.addEventListener('pointerup', dropPt);
  ov.addEventListener('pointercancel', dropPt);

  // 열려 있는 동안 키보드는 전부 여기서 소비 (화살표가 슬라이드를 넘기면 안 된다)
  document.addEventListener('keydown', (e) => {
    if (ov.style.display === 'none') return;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    if (e.key === 'Escape') close();
    else if (e.key === '+' || e.key === '=') zoom(s * 1.25, cx, cy);
    else if (e.key === '-' || e.key === '_') zoom(s / 1.25, cx, cy);
    else if (e.key === '0') zoom(Math.min(fit, 1), cx, cy);
    else if (e.key === '1') zoom(1, cx, cy);
    else if (e.key === 'ArrowLeft') { tx += 60; clamp(); draw(); }
    else if (e.key === 'ArrowRight') { tx -= 60; clamp(); draw(); }
    else if (e.key === 'ArrowUp') { ty += 60; clamp(); draw(); }
    else if (e.key === 'ArrowDown') { ty -= 60; clamp(); draw(); }
    else return;
    e.preventDefault(); e.stopPropagation();
  }, true);

  addEventListener('resize', () => {
    if (ov.style.display === 'none' || !nw) return;
    fit = Math.min((innerWidth - PAD * 2) / nw, (innerHeight - PAD * 2) / nh);
    clamp(); draw();
  });

  const ready = () => {
    document.body.appendChild(ov);
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.tagName === 'IMG' && t.closest('section') && !t.classList.contains('emoji')) {
        e.preventDefault(); e.stopPropagation(); open(t.currentSrc || t.src);
      }
    }, true);
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', ready) : ready();
})();
