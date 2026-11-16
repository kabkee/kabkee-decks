/* 슬라이드 요소별 검토 코멘트 (marp 덱 공용 · 2026-11-16 오너 요청)
   · 오른쪽 아래 「💬 코멘트」 버튼으로 코멘트 모드를 켠다(단축키 C).
   · 켜면 제목·문단·목록 한 줄·표 한 행·이미지·링크 묶음에 마우스를 올려 윤곽을 보고, 누르면 그 요소에 코멘트를 단다.
   · 「이 슬라이드 전체」 버튼으로 슬라이드 단위 코멘트도 단다.
   · 종류: 수정 요청 / 의사결정으로 앞으로 / 다음 주로 미루기 / 질문 / 기타 — Claude 가 읽고 덱을 고칠 때 분류 기준으로 쓴다.
   · 저장: /api/comments (Netlify 함수 · netlify/functions/comments.mjs). 로컬(:8088)에서 열면 배포된 API 로 보내고,
     API 가 이 덱을 받지 않으면 이 브라우저(localStorage)에만 저장한 뒤 「복사」로 Claude 에게 넘긴다.
   · 덱 id 는 <meta name="deck-comments" content="..."> (빌드가 주입). 없으면 동작하지 않는다.                       */
(() => {
  if (window.__dc) return; window.__dc = 1;
  const DECK = document.querySelector('meta[name="deck-comments"]')?.content;
  if (!DECK) return;

  const REMOTE = 'https://kabkee-decks.netlify.app/api/comments';
  const API = /netlify\.app$/.test(location.hostname) ? '/api/comments' : REMOTE;
  const LS = 'deck-comments:' + DECK;
  const SEL = 'h1,h2,h3,h4,p,li,tr,blockquote,figure,img:not(.emoji),figcaption,pre,.card,.links,.lnk';
  const KINDS = [
    ['fix', '수정 요청'], ['decision', '의사결정으로 앞으로'], ['later', '다음 주로 미루기'],
    ['question', '질문'], ['etc', '기타'],
  ];
  const KLABEL = Object.fromEntries(KINDS);

  // ── 스타일 ──
  const st = document.createElement('style');
  st.textContent = `
  .dc-fab{position:fixed;right:18px;bottom:18px;z-index:99990;display:flex;gap:8px;align-items:center;font:600 14px/1 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
  .dc-fab button{border:0;border-radius:999px;padding:11px 16px;cursor:pointer;background:#1f2937;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);font:inherit}
  .dc-fab button.on{background:#16a34a}
  .dc-fab .dc-n{background:#f59e0b;color:#1a1204;border-radius:999px;padding:2px 8px;margin-left:6px;font-size:12px}
  body.dc-on section [data-dc-hot]{outline:3px solid #16a34a!important;outline-offset:2px;cursor:copy!important;background:rgba(22,163,74,.07)}
  body.dc-on section [data-dc-has]{outline:2px dashed #f59e0b;outline-offset:2px}
  body.dc-on section{cursor:crosshair;position:relative}
  .dc-pin{position:absolute;z-index:5;background:#f59e0b;color:#1a1204;font:700 12px/1 system-ui;border-radius:999px;padding:3px 7px;pointer-events:none}
  .dc-drawer{position:fixed;top:0;right:0;bottom:0;width:min(440px,100%);z-index:99995;background:#fff;color:#111827;border-left:1px solid #e5e7eb;box-shadow:-12px 0 32px rgba(0,0,0,.18);padding:18px 18px 28px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;font:15px/1.5 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
  .dc-drawer[hidden]{display:none}
  .dc-drawer h3{margin:0;font-size:17px}
  .dc-drawer .dc-row{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
  .dc-drawer .dc-target{font:600 12px/1.4 ui-monospace,Menlo,monospace;color:#b45309}
  .dc-drawer .dc-detail{font-size:13px;color:#4b5563;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;max-height:8.5em;overflow:auto;white-space:pre-wrap}
  .dc-drawer label{display:grid;gap:4px;font-size:13px;color:#4b5563}
  .dc-drawer input,.dc-drawer textarea{font:15px/1.5 inherit;font-family:inherit;color:#111827;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;width:100%;box-sizing:border-box}
  .dc-drawer textarea{min-height:130px;resize:vertical}
  .dc-kinds{display:flex;flex-wrap:wrap;gap:6px}
  .dc-kinds button{border:1px solid #d1d5db;background:#fff;border-radius:999px;padding:6px 11px;font:600 13px/1 inherit;font-family:inherit;cursor:pointer;color:#374151}
  .dc-kinds button.sel{background:#111827;color:#fff;border-color:#111827}
  .dc-btn{border:1px solid #d1d5db;background:#fff;border-radius:8px;padding:8px 12px;font:600 14px/1 inherit;font-family:inherit;cursor:pointer;color:#111827}
  .dc-btn.pri{background:#16a34a;border-color:#16a34a;color:#fff}
  .dc-status{font-size:13px;color:#6b7280}
  .dc-warn{font-size:13px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:8px;padding:8px 10px}
  .dc-list{display:grid;gap:8px}
  .dc-c{border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px;background:#fafafa}
  .dc-c .dc-meta{font-size:12px;color:#6b7280}
  .dc-c .dc-where{font:600 12px/1.4 ui-monospace,Menlo,monospace;color:#b45309;cursor:pointer}
  .dc-c p{margin:4px 0 0;white-space:pre-wrap}
  .dc-tag{display:inline-block;font-size:11px;font-weight:700;border-radius:4px;padding:1px 6px;margin-right:6px;background:#e5e7eb;color:#111827}
  .dc-tag.decision{background:#fee2e2;color:#991b1b}.dc-tag.fix{background:#dbeafe;color:#1e40af}.dc-tag.later{background:#f3f4f6;color:#4b5563}.dc-tag.question{background:#fef3c7;color:#92400e}
  `;
  document.head.appendChild(st);

  // ── 상태 ──
  let on = false, comments = [], remoteOk = false, current = null, kind = 'fix';
  const $ = (t, a = {}, ...kids) => { const e = document.createElement(t); Object.assign(e, a); kids.forEach(k => e.append(k)); return e; };
  const pad = (n) => String(n).padStart(2, '0');
  const sections = () => [...document.querySelectorAll('svg[data-marpit-svg] > foreignObject > section, section[data-marpit-pagination]')]
    .filter((s, i, a) => a.indexOf(s) === i);
  const slideNo = (sec) => {
    const all = sections(); const i = all.indexOf(sec);
    return i >= 0 ? i + 1 : Number(sec.id) || 0;
  };
  const short = (t, n) => { t = (t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const textOf = (el) => el.tagName === 'IMG' ? '[이미지] ' + (el.getAttribute('alt') || el.getAttribute('src') || '') : (el.innerText || el.textContent || '');
  const slideTitle = (sec) => short(sec.querySelector('h1,h2')?.innerText || '', 80);
  const anchorOf = (el) => {
    const sec = el.closest('section'); const n = slideNo(sec);
    if (el === sec) return { anchor: `s${pad(n)}-slide`, sec, n };
    const idx = [...sec.querySelectorAll(SEL)].indexOf(el);
    return { anchor: `s${pad(n)}-e${String(idx + 1).padStart(2, '0')}`, sec, n };
  };
  const elOf = (anchor) => {
    const m = /^s(\d+)-(slide|e(\d+))$/.exec(anchor || ''); if (!m) return null;
    const sec = sections()[Number(m[1]) - 1]; if (!sec) return null;
    return m[2] === 'slide' ? sec : sec.querySelectorAll(SEL)[Number(m[3]) - 1] || null;
  };
  const goSlide = (n) => { location.hash = '#' + n; };

  // ── 저장소 ──
  const loadLocal = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; } };
  const saveLocal = (list) => localStorage.setItem(LS, JSON.stringify(list));
  async function load() {
    let remote = [];
    try {
      const r = await fetch(API + '?deck=' + encodeURIComponent(DECK), { cache: 'no-store' });
      if (r.ok) { remote = await r.json(); remoteOk = true; } else remoteOk = false;
    } catch { remoteOk = false; }
    comments = [...remote, ...loadLocal().map(c => ({ ...c, local: true }))];
    paint();
  }
  async function post(c) {
    if (remoteOk) {
      try {
        const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) });
        if (r.ok) return { ...(await r.json()), local: false };
      } catch { /* 아래 로컬 저장으로 */ }
    }
    const lc = { ...c, id: 'L' + Math.random().toString(36).slice(2, 9), createdAt: new Date().toISOString(), local: true };
    saveLocal([...loadLocal(), lc]);
    return lc;
  }

  // ── 표시 ──
  const fab = $('div', { className: 'dc-fab' });
  const bAll = $('button', { type: 'button', title: '이 덱의 코멘트 전체 보기' }, '목록');
  const bOn = $('button', { type: 'button', title: '코멘트 모드 켜기/끄기 (C)' }, '💬 코멘트');
  const nBadge = $('span', { className: 'dc-n' }, '0');
  bOn.append(nBadge);
  fab.append(bAll, bOn);
  document.body.appendChild(fab);

  const dr = $('aside', { className: 'dc-drawer', hidden: true });
  dr.setAttribute('aria-label', '슬라이드 코멘트');
  document.body.appendChild(dr);

  function paint() {
    nBadge.textContent = String(comments.length);
    document.querySelectorAll('[data-dc-has]').forEach(e => e.removeAttribute('data-dc-has'));
    document.querySelectorAll('.dc-pin').forEach(e => e.remove());
    const by = new Map();
    comments.forEach(c => by.set(c.anchor, (by.get(c.anchor) || 0) + 1));
    by.forEach((cnt, a) => {
      const el = elOf(a); if (!el) return;
      el.setAttribute('data-dc-has', '1');
      if (on && el.tagName !== 'SECTION' && el.tagName !== 'TR' && el.tagName !== 'IMG') {
        const sec = el.closest('section'); const sr = sec.getBoundingClientRect(), er = el.getBoundingClientRect();
        const k = sec.offsetWidth ? sr.width / sec.offsetWidth : 1;
        const pin = $('span', { className: 'dc-pin' }, String(cnt));
        pin.style.left = ((er.right - sr.left) / k - 8) + 'px'; pin.style.top = ((er.top - sr.top) / k - 10) + 'px';
        sec.appendChild(pin);
      }
    });
  }

  const card = (c) => {
    const where = $('div', { className: 'dc-where' }, `${c.anchor} · ${short(c.label, 60)}`);
    where.onclick = () => { const m = /^s(\d+)/.exec(c.anchor); if (m) goSlide(Number(m[1])); };
    const tag = $('span', { className: 'dc-tag ' + (c.kind || '') }, KLABEL[c.kind] || '코멘트');
    const meta = $('div', { className: 'dc-meta' }, `${c.author || '익명'} · ${(c.createdAt || '').slice(5, 16).replace('T', ' ')}${c.local ? ' · 이 브라우저에만 저장' : ''}`);
    return $('div', { className: 'dc-c' }, where, meta, $('p', {}, tag, c.text));
  };

  function openFor(el) {
    const { anchor, sec, n } = anchorOf(el);
    const isTitle = el === sec.querySelector('h1,h2');
    const label = el === sec ? `${n}쪽 슬라이드 전체 — ${slideTitle(sec)}` : isTitle ? `${n}쪽 · 제목 — ${slideTitle(sec)}` : `${n}쪽 · ${slideTitle(sec)} › ${short(textOf(el), 60)}`;
    current = { anchor, label, detail: short(textOf(el), 800), n };
    dr.replaceChildren();
    const close = $('button', { className: 'dc-btn', type: 'button' }, '닫기'); close.onclick = hide;
    const whole = $('button', { className: 'dc-btn', type: 'button' }, '이 슬라이드 전체에 달기'); whole.onclick = () => openFor(sec);
    dr.append($('div', { className: 'dc-row' }, $('h3', {}, '코멘트 달기'), close));
    dr.append($('div', { className: 'dc-target' }, `${anchor} · ${short(label, 90)}`));
    if (el !== sec) dr.append($('div', { className: 'dc-detail' }, current.detail), whole);
    if (!remoteOk) dr.append($('div', { className: 'dc-warn' }, '지금은 공유 저장소에 연결되지 않아 이 브라우저에만 저장돼요. 「목록」 → 「Claude 용으로 복사」로 넘겨 주세요.'));
    const mine = comments.filter(c => c.anchor === anchor);
    if (mine.length) dr.append($('div', { className: 'dc-list' }, ...mine.map(card)));
    const kinds = $('div', { className: 'dc-kinds' });
    KINDS.forEach(([k, l]) => {
      const b = $('button', { type: 'button', className: k === kind ? 'sel' : '' }, l);
      b.onclick = () => { kind = k; kinds.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); };
      kinds.append(b);
    });
    const name = $('input', { maxLength: 60, value: localStorage.getItem('deck-comments:name') || '', placeholder: '예: 오빠' });
    const ta = $('textarea', { maxLength: 4000, required: true, placeholder: '무엇을 어떻게 바꾸면 좋을지 적어 주세요' });
    const stat = $('span', { className: 'dc-status' });
    const send = $('button', { className: 'dc-btn pri', type: 'submit' }, '저장');
    const form = $('form', {},
      $('div', { style: 'display:grid;gap:10px' },
        $('label', {}, '종류', kinds), $('label', {}, '이름', name), $('label', {}, '코멘트', ta),
        $('div', { className: 'dc-row' }, stat, send)));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = ta.value.trim(); if (!text) { stat.textContent = '내용을 적어 주세요.'; return; }
      send.disabled = true; stat.textContent = '저장 중…';
      localStorage.setItem('deck-comments:name', name.value.trim());
      const c = await post({ deck: DECK, anchor: current.anchor, label: current.label, detail: current.detail, kind, author: name.value.trim() || '익명', text });
      comments.push(c); paint(); openFor(el);
      dr.querySelector('.dc-status').textContent = c.local ? '이 브라우저에 저장했어요.' : '저장했어요.';
    };
    dr.append(form);
    dr.hidden = false;
    setTimeout(() => ta.focus(), 30);
  }

  function showAll() {
    dr.replaceChildren();
    const close = $('button', { className: 'dc-btn', type: 'button' }, '닫기'); close.onclick = hide;
    const copy = $('button', { className: 'dc-btn', type: 'button' }, 'Claude 용으로 복사');
    copy.onclick = async () => {
      const lines = [`덱 코멘트 — ${DECK} (${comments.length}건)`, `파일: ${location.pathname}`, ''];
      [...comments].sort((a, b) => a.anchor.localeCompare(b.anchor)).forEach(c =>
        lines.push(`- [${KLABEL[c.kind] || '코멘트'}] ${c.anchor} · ${c.label}\n  대상 원문: ${short(c.detail, 200)}\n  코멘트(${c.author || '익명'}): ${c.text.replace(/\n/g, '\n  ')}`));
      try { await navigator.clipboard.writeText(lines.join('\n')); copy.textContent = '복사했어요'; }
      catch { const t = $('textarea', { value: lines.join('\n'), style: 'min-height:240px' }); dr.append(t); t.select(); }
    };
    dr.append($('div', { className: 'dc-row' }, $('h3', {}, `코멘트 ${comments.length}건`), close));
    dr.append($('div', { className: 'dc-status' }, remoteOk ? '공유 저장소에 연결됨 — Claude 가 직접 읽을 수 있어요.' : '공유 저장소 미연결 — 이 브라우저 저장분은 「Claude 용으로 복사」로 넘겨 주세요.'), copy);
    // 이 브라우저(localStorage)에만 저장된 코멘트 지우기 — 공유 저장소의 코멘트는 건드리지 않는다.
    // 실수로 지우지 않게 두 번 눌러야 지운다(브라우저 확인 창은 쓰지 않음).
    const nLocal = comments.filter(c => c.local).length;
    if (nLocal) {
      const del = $('button', { className: 'dc-btn', type: 'button' }, `이 브라우저 저장분 ${nLocal}건 지우기`);
      let armed = false;
      del.onclick = () => {
        if (!armed) { armed = true; del.textContent = `한 번 더 누르면 ${nLocal}건을 지워요 (공유 저장소는 그대로)`; del.style.borderColor = '#dc2626'; del.style.color = '#dc2626'; return; }
        localStorage.removeItem(LS);
        comments = comments.filter(c => !c.local); paint(); showAll();
      };
      dr.append(del);
    }
    const list = [...comments].sort((a, b) => a.anchor.localeCompare(b.anchor));
    dr.append(list.length ? $('div', { className: 'dc-list' }, ...list.map(card)) : $('div', { className: 'dc-status' }, '아직 코멘트가 없어요.'));
    dr.hidden = false;
  }
  function hide() { dr.hidden = true; current = null; }

  function setOn(v) {
    on = v; document.body.classList.toggle('dc-on', on); bOn.classList.toggle('on', on);
    bOn.firstChild.textContent = on ? '💬 코멘트 모드 켜짐' : '💬 코멘트';
    if (!on) { hide(); clearHot(); }
    paint();
  }
  let hot = null;
  const clearHot = () => { if (hot) hot.removeAttribute('data-dc-hot'); hot = null; };
  const pick = (t) => { const sec = t.closest?.('section'); if (!sec || dr.contains(t)) return null; const el = t.closest(SEL); return el && sec.contains(el) ? el : sec; };

  bOn.onclick = () => setOn(!on);
  bAll.onclick = () => (dr.hidden ? showAll() : hide());
  document.addEventListener('mouseover', (e) => {
    if (!on) return; const el = pick(e.target); if (el === hot) return;
    clearHot(); if (el && el.tagName !== 'SECTION') { hot = el; el.setAttribute('data-dc-hot', '1'); }
  }, true);
  // 캡처 단계에서 가로채서 링크 이동·이미지 확대(lightbox)·슬라이드 넘김보다 먼저 처리한다
  document.addEventListener('click', (e) => {
    if (!on || dr.contains(e.target) || fab.contains(e.target)) return;
    const el = pick(e.target); if (!el) return;
    e.preventDefault(); e.stopImmediatePropagation(); openFor(el);
  }, true);
  // 입력 중 키가 슬라이드 넘김(bespoke 단축키)으로 새지 않게 막는다
  addEventListener('keydown', (e) => {
    if (dr.contains(e.target)) { if (e.key === 'Escape') hide(); e.stopPropagation(); return; }
    if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA/.test(e.target.tagName)) { setOn(!on); e.stopPropagation(); }
  }, true);
  addEventListener('hashchange', () => setTimeout(paint, 300));
  addEventListener('resize', () => setTimeout(paint, 300));
  load();
})();
