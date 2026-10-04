// 랜딩 시안 공용: 360° 파노라마 스케치 캔버스 (campus-vr-tour.html 의 그리기 로직을 페이지 공용으로 분리)
// 사용: <div class="pano-frame" data-pano data-seed="360" data-labels='[{"at":0.1,"t":"정문"}]'><canvas></canvas><span class="hud"></span>...</div>
(() => {
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
  function makeScene(seed, mood) {
    const r = rng(seed), items = [];
    let x = 0;
    while (x < 1) {
      const w = 0.03 + r() * 0.07, k = r();
      // mood: 'campus'(건물 위주) | 'nature'(나무·산 위주)
      const tree = mood === 'nature' ? 0.55 : 0.15, tower = mood === 'nature' ? 0.62 : 0.25;
      items.push({ x, w, h: 0.18 + r() * 0.3, kind: k < tree ? 'tree' : k < tower ? 'tower' : 'bld', win: 2 + Math.floor(r() * 5), far: r() < 0.4 });
      x += w + r() * 0.025;
    }
    return items;
  }

  function draw(canvas, scene, offset, labels, mood) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, css('--sky-top')); sky.addColorStop(1, css('--sky-bot'));
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const horizon = H * 0.66;
    const span = W * (W / H > 2.5 ? 1.15 : 2.1);
    const bld = css('--bld'), bld2 = css('--bld-2'), ground = css('--ground'), warm = css('--warm'), bg = css('--sky-bot');
    if (mood === 'nature') { // 먼 산 능선
      g.fillStyle = bld2; g.globalAlpha = 0.55; g.beginPath(); g.moveTo(0, horizon);
      for (let i = 0; i <= 40; i++) { const t = i / 40; g.lineTo(t * W, horizon - H * (0.12 + 0.1 * Math.sin((t + offset) * 9) + 0.06 * Math.sin((t + offset) * 23))); }
      g.lineTo(W, horizon); g.fill(); g.globalAlpha = 1;
    }
    for (const pass of [true, false]) {
      for (const it of scene) {
        if (it.far !== pass) continue;
        for (const k of [-1, 0, 1]) {
          const px = (it.x - offset + k) * span;
          if (px > W || px + it.w * span < 0) continue;
          const w = it.w * span, h = it.h * H * (pass ? 0.75 : 1);
          g.fillStyle = pass ? bld2 : bld;
          if (it.kind === 'tree') {
            g.beginPath(); g.ellipse(px + w / 2, horizon - h * 0.45, w * 0.45, h * 0.45, 0, 0, Math.PI * 2); g.fill();
          } else if (it.kind === 'tower') {
            g.fillRect(px + w * 0.3, horizon - h * 1.5, w * 0.4, h * 1.5);
            g.beginPath(); g.moveTo(px + w * 0.25, horizon - h * 1.5); g.lineTo(px + w / 2, horizon - h * 1.75); g.lineTo(px + w * 0.75, horizon - h * 1.5); g.fill();
          } else {
            g.fillRect(px, horizon - h, w, h);
            if (!pass) {
              g.fillStyle = bg; g.globalAlpha = 0.55;
              const rows = Math.max(2, Math.floor(h / 14)), cols = it.win;
              for (let a = 0; a < rows; a++) for (let b = 0; b < cols; b++)
                g.fillRect(px + (b + 0.3) * w / cols, horizon - h + (a + 0.35) * h / rows, w / cols * 0.4, h / rows * 0.35);
              g.globalAlpha = 1;
            }
          }
        }
      }
    }
    g.fillStyle = ground; g.fillRect(0, horizon, W, H - horizon);
    g.strokeStyle = bg; g.globalAlpha = 0.5; g.lineWidth = 1;
    for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(W / 2 + i * 8, horizon); g.lineTo(W / 2 + i * W * 0.18, H); g.stroke(); }
    g.globalAlpha = 1;
    if (labels) {
      g.font = '500 11px ' + css('--font-mono');
      for (const lb of labels) for (const k of [-1, 0, 1]) {
        const px = (lb.at - offset + k) * span;
        if (px < -60 || px > W + 60) continue;
        g.fillStyle = warm; g.beginPath(); g.arc(px, horizon - 8, 5, 0, Math.PI * 2); g.fill();
        g.fillStyle = css('--ink'); g.fillText(lb.t, px + 10, horizon - 4);
      }
    }
  }

  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const live = [];
  document.querySelectorAll('[data-pano]').forEach((frame) => {
    const canvas = frame.querySelector('canvas'), hud = frame.querySelector('.hud');
    const mood = frame.dataset.mood || 'campus';
    const scene = makeScene(+frame.dataset.seed || 360, mood);
    const labels = JSON.parse(frame.dataset.labels || '[]');
    const st = { off: +frame.dataset.offset || 0, drag: null, idleUntil: 0, still: frame.dataset.still !== undefined };
    st.render = () => {
      draw(canvas, scene, st.off, labels, mood);
      if (hud) { const deg = Math.round(((st.off % 1) + 1) % 1 * 360) % 360; hud.textContent = '시선 ' + String(deg).padStart(3, '0') + '° · ' + dirs[Math.round(deg / 45) % 8]; }
    };
    if (!st.still) {
      frame.addEventListener('pointerdown', (e) => { st.drag = { x: e.clientX, o: st.off }; frame.setPointerCapture(e.pointerId); });
      frame.addEventListener('pointermove', (e) => { if (st.drag) st.off = st.drag.o - (e.clientX - st.drag.x) / (canvas.clientWidth * 2); });
      const end = () => { st.drag = null; st.idleUntil = performance.now() + 2500; };
      frame.addEventListener('pointerup', end); frame.addEventListener('pointercancel', end);
    }
    live.push(st);
  });
  const redraw = () => live.forEach((s) => s.render());
  addEventListener('resize', redraw);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.fonts && document.fonts.ready.then(redraw);
  let last = performance.now();
  function tick(t) {
    const dt = t - last; last = t;
    for (const s of live) if (!s.still && !s.drag && !reduce && t > s.idleUntil) s.off += dt * 0.000012;
    live.forEach((s) => { if (!s.still) s.render(); });
    requestAnimationFrame(tick);
  }
  redraw();
  requestAnimationFrame(tick);
})();
