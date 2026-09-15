#!/usr/bin/env node
/**
 * 주간 업무 보고용 화면 자동 캡처
 *
 * 사용법:
 *   node scripts/capture-weekly.mjs              # 이번 주 수요일 날짜로 저장
 *   node scripts/capture-weekly.mjs 2026-09-02   # 날짜 지정
 *   node scripts/capture-weekly.mjs --only home  # 특정 화면만 (id 부분일치)
 *   node scripts/capture-weekly.mjs --list       # 대상 목록만 출력
 *
 * 출력: weekly-reports/assets/<날짜>/NN-<id>.jpg  (2배 해상도 JPEG — 슬라이드 축소 표시 기준 충분히 선명하고 PNG 대비 1/5 용량)
 *
 * 인증: 관리자(:5277)는 비밀번호 로그인 대신 nestjs .env 의 JWT_ACCESS_SECRET 으로
 *       자가서명한 accessToken 쿠키를 주입한다 (사용자 FE 와 동일한 인증 로직·계정).
 *       🔴 개발 서버 전용. 운영 도메인에는 쓰지 말 것.
 *
 * 실패는 조용히 넘기지 않는다 — 화면별 성공/실패를 표로 출력하고,
 * 한 건이라도 실패하면 exit code 1 로 끝난다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_REPO = '/home/kabkee/projects/Look360_Platform_Project/nestjs-look360-api';

const FE = 'http://100.120.25.127:5174';
const ADMIN = 'http://100.120.25.127:5277';
const API = 'http://100.120.25.127:3001/v1.0';

// ── 캡처 대상 ────────────────────────────────────────────────
// crop: 'hero' 처럼 이름을 주면 아래 CROPS 의 좌표로 잘라 별도 파일도 함께 만든다.
const SHOTS = [
  { id: 'home-hero',    site: 'fe',    url: '/',                        wait: 4000, crop: 'hero',
    desc: '홈 — 히어로 핫스팟·건물 툴팁 포함 + 지역 표기 2 depth (IND-7235)' },
  { id: 'vrlist-country', site: 'fe',  url: '/vr-list',                 wait: 3500,
    desc: 'VR 목록 — 국가 선택 별도 분리(기본 대한민국) + 지역 필터 국가 컬럼 제거 (IND-7236)' },
  { id: 'vr-detail-icons', site: 'fe', url: '/vr-info/v47cpxre',        wait: 3500,
    desc: 'VR 상세 — 장소정보 항목 제목을 아이콘으로 전환 + Figma 2안 순서 (IND-7095)' },
  { id: 'admin-sidebar',      site: 'admin', url: '/',                  wait: 3500,
    desc: '관리자 — 사이드바 11그룹 재편 · 아이콘 · 고아 화면 2건 연결 (IND-7100 W2)' },
  { id: 'admin-sidebar-edit', site: 'admin', url: '/',                  wait: 3000,
    desc: '관리자 — 사이드바 편집 모드 (드래그 순서 · ★즐겨찾기 · 계정별 DB 저장) (IND-7100 W3)',
    actions: [
      { do: 'click', sel: 'text=메뉴 편집' },
      { do: 'wait',  ms: 2000 },
    ] },
  { id: 'admin-channel-verify', site: 'admin', url: '/channel',         wait: 3500,
    desc: '관리자 — 채널 목록 「공식 채널」 인증 컬럼 + Edit 토글 (IND-7234)' },
  { id: 'admin-i18n-approve',   site: 'admin', url: '/i18n-management', wait: 4000,
    desc: '관리자 — 「번역 불충분」 원문 유지 승인·해제 UI (단건·일괄 + 승인목록) (IND-7114)',
    actions: [
      // 기본 탭은 「360뷰」다 — 승인 UI 는 「번역 불충분」 탭 안에 있으므로 반드시 열어야 한다
      { do: 'click', sel: 'text=번역 불충분' },
      { do: 'wait',  ms: 3000 },
    ] },
  { id: 'admin-region-aliases', site: 'admin', url: '/admin/regions/aliases', wait: 3500,
    desc: '관리자 — 「지역 관리」 그룹 신설로 진입 가능해진 지역 별칭 화면 (IND-7096)' },
];

const CROPS = {
  // 홈 히어로 영역만 (1440x900 뷰포트 기준)
  // IND-6777 로 히어로 좌우 여백이 제거돼 전체 폭을 쓴다 — 크롭도 폭 전체로 맞춘다
  hero: { x: 0, y: 119, width: 1440, height: 440 },
  // 관리자 사이드바(좌 256px)를 제외한 본문만
  adminBody: { x: 256, y: 64, width: 1184, height: 836 },
};

const VIEWPORT = { width: 1440, height: 900 };
// 모바일 캡처용 (iPhone 14 급) — 터치·모바일 플래그까지 켜야 반응형 분기가 실제와 같아진다
const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const JPEG = { type: 'jpeg', quality: 88 };   // git 저장소에 매주 쌓이므로 용량을 억제한다

// ── 인자 파싱 ────────────────────────────────────────────────
const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
if (args.includes('--list')) {
  console.log('캡처 대상:');
  for (const s of SHOTS) console.log(`  ${s.id.padEnd(22)} ${s.site.padEnd(6)} ${s.url.padEnd(26)} ${s.desc}`);
  process.exit(0);
}
const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

/** 이번 주 수요일(발행일) — 수요일이면 오늘, 아니면 직전 수요일 */
function thisWednesday() {
  const d = new Date();
  const diff = (d.getDay() - 3 + 7) % 7;   // 3 = 수요일
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}
const DATE = dateArg || thisWednesday();
const OUT_DIR = path.join(ROOT, 'weekly-reports', 'assets', DATE);

// ── 의존성 해결 (버전 하드코딩 금지) ─────────────────────────
function findPlaywright() {
  const bases = [
    path.join(ROOT, 'node_modules/playwright-core'),
    '/home/kabkee/Developments/paperclip/node_modules/playwright-core',
  ];
  const pnpm = '/home/kabkee/Developments/paperclip/node_modules/.pnpm';
  if (fs.existsSync(pnpm)) {
    for (const d of fs.readdirSync(pnpm).filter((x) => x.startsWith('playwright-core@')).sort().reverse()) {
      bases.push(path.join(pnpm, d, 'node_modules/playwright-core'));
    }
  }
  for (const b of bases) if (fs.existsSync(b)) return require_(path.join(b, 'index.js'));
  throw new Error(`playwright-core 를 찾지 못했습니다. 탐색 경로:\n  ${bases.join('\n  ')}`);
}

function adminToken() {
  const envPath = path.join(API_REPO, '.env');
  if (!fs.existsSync(envPath)) throw new Error(`API .env 없음: ${envPath} (관리자 화면 캡처 불가)`);
  const m = fs.readFileSync(envPath, 'utf8').match(/^JWT_ACCESS_SECRET=(.*)$/m);
  if (!m) throw new Error(`.env 에 JWT_ACCESS_SECRET 없음: ${envPath}`);
  const jwt = require_(path.join(API_REPO, 'node_modules/jsonwebtoken'));
  return jwt.sign(
    { sub: 1, id: 'email_kabkee@live.com', email: 'kabkee@live.com', name: 'kabkee',
      role: 'ADMIN', is_active: 1, service_version: 2 },
    m[1].trim(),
    { expiresIn: '60m' },
  );
}

async function alive(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return r.status < 500;
  } catch { return false; }
}

// ── 실행 ─────────────────────────────────────────────────────
const targets = SHOTS.filter((s) => !only || s.id.includes(only));
if (!targets.length) { console.error(`❌ --only "${only}" 에 해당하는 대상이 없습니다.`); process.exit(1); }

console.log(`📅 발행일 ${DATE}  ·  대상 ${targets.length}개  ·  출력 ${path.relative(ROOT, OUT_DIR)}/\n`);

const health = {
  fe: await alive(FE),
  admin: await alive(ADMIN),
  api: await alive(`${API}/main-page/summary`),
};
console.log(`서버  FE ${health.fe ? '✅' : '❌'}  ADMIN ${health.admin ? '✅' : '❌'}  API ${health.api ? '✅' : '❌'}`);
if (!health.api) console.error('⚠️  API 가 죽어 있으면 화면이 비어 찍힙니다.');

const needFe = targets.some((s) => s.site === 'fe');
const needAdmin = targets.some((s) => s.site === 'admin');
if (needFe && !health.fe) { console.error(`❌ FE(${FE}) 응답 없음 — 개발 서버를 먼저 띄우세요.`); process.exit(1); }
if (needAdmin && !health.admin) { console.error(`❌ ADMIN(${ADMIN}) 응답 없음 — 관리자 개발 서버를 먼저 띄우세요.`); process.exit(1); }

fs.mkdirSync(OUT_DIR, { recursive: true });

const { chromium } = findPlaywright();
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ko-KR', deviceScaleFactor: 2 });

if (needAdmin) {
  const token = adminToken();
  await ctx.addCookies([{ name: 'accessToken', value: token, domain: '100.120.25.127', path: '/' }]);
  console.log('🔑 관리자 accessToken 쿠키 주입 완료 (60분 유효)');
}

const page = await ctx.newPage();
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text().slice(0, 160)); });

// 모바일 대상이 있으면 전용 컨텍스트를 따로 연다 (viewport·isMobile 은 컨텍스트 단위 설정)
let mobilePage = null;
if (targets.some((s) => s.device === 'mobile')) {
  const mctx = await browser.newContext({ ...MOBILE, locale: 'ko-KR' });
  mobilePage = await mctx.newPage();
  mobilePage.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text().slice(0, 160)); });
  console.log(`📱 모바일 컨텍스트 생성 (${MOBILE.viewport.width}x${MOBILE.viewport.height})`);
}

const results = [];

for (const shot of targets) {
  // 🔴 번호는 SHOTS 전체에서의 위치로 고정한다 (--only 로 일부만 찍어도 파일명이 흔들리지 않도록)
  const seq = SHOTS.indexOf(shot) + 1;
  const base = `${String(seq).padStart(2, '0')}-${shot.id}`;
  const file = path.join(OUT_DIR, `${base}.jpg`);
  const origin = shot.site === 'admin' ? ADMIN : FE;
  const pg = shot.device === 'mobile' ? mobilePage : page;
  const before = pageErrors.length;
  try {
    // 사이트 언어는 localStorage('preferred_lang'), 자동번역 토글은 'vr_auto_translate' 가
    // 비로그인 상태의 정본이다 (useUserStore.js:23 · VrDetail.vue:1326-1339).
    // 지면을 먼저 열어 origin 을 확보한 뒤 값을 넣고 다시 연다.
    const ls = { ...(shot.lang ? { preferred_lang: shot.lang } : {}), ...(shot.ls ?? {}) };
    if (Object.keys(ls).length) {
      await pg.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await pg.evaluate((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, ls);
    }
    await pg.goto(origin + shot.url, { waitUntil: 'networkidle', timeout: 45000 });
    await pg.waitForTimeout(shot.wait ?? 2000);

    if (shot.type) {
      await pg.locator(shot.type.sel).first().pressSequentially(shot.type.text, { delay: 90 });
      await pg.waitForTimeout(shot.type.after ?? 1500);
    }

    // 다이얼로그 등 「눌러야 보이는 화면」을 위한 조작 시퀀스
    for (const a of shot.actions ?? []) {
      if (a.do === 'fill')  await pg.locator(a.sel).first().fill(a.text);
      if (a.do === 'press') await pg.keyboard.press(a.key);
      if (a.do === 'click') await pg.locator(a.sel).first().click({ force: true });
      if (a.do === 'wait')  await pg.waitForTimeout(a.ms);
    }

    await pg.screenshot({ path: file, ...JPEG });
    const made = [`${base}.jpg`];

    if (shot.crop && CROPS[shot.crop]) {
      const cropFile = path.join(OUT_DIR, `${base}-crop.jpg`);
      await pg.screenshot({ path: cropFile, clip: CROPS[shot.crop], ...JPEG });
      made.push(`${base}-crop.jpg`);
    }

    // 다음 캡처가 오염되지 않도록 되돌린다
    if (shot.lang) await pg.evaluate(() => localStorage.setItem('preferred_lang', 'ko'));
    if (shot.ls) await pg.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), Object.keys(shot.ls));

    const errs = pageErrors.length - before;
    const kb = Math.round(fs.statSync(file).size / 1024);
    results.push({ id: shot.id, ok: true, files: made, kb, errs });
    console.log(`  ✅ ${base.padEnd(26)} ${String(kb).padStart(5)}KB${errs ? `  ⚠️ 콘솔에러 ${errs}건` : ''}`);
  } catch (e) {
    results.push({ id: shot.id, ok: false, error: e.message.split('\n')[0].slice(0, 140) });
    console.log(`  ❌ ${base.padEnd(26)} ${e.message.split('\n')[0].slice(0, 100)}`);
  }
}

await browser.close();

// ── 리포트 (조용한 실패 금지) ────────────────────────────────
const ok = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);
console.log(`\n${'─'.repeat(62)}`);
console.log(`결과  성공 ${ok.length}/${results.length}   저장 위치: ${path.relative(ROOT, OUT_DIR)}/`);
if (ok.length) {
  console.log('\n마크다운에 붙여넣기 — 🔴 이미지 슬라이드에는 «반드시» links 블록을 함께 넣을 것:');
  for (const r of ok) {
    const shot = SHOTS.find((s) => s.id === r.id);
    const origin = shot.site === 'admin' ? ADMIN : FE;
    for (const f of r.files) console.log(`  ![w:900](assets/${DATE}/${f})`);
    console.log(`  <div class="links"><span class="lbl">직접 확인</span>`);
    console.log(`  <a class="lnk${shot.site === 'admin' ? ' admin' : ''}" href="${origin}${shot.url}" target="_blank">${origin}${shot.url}</a></div>`);
  }
}
if (failed.length) {
  console.log('\n❌ 실패한 화면:');
  for (const r of failed) console.log(`  · ${r.id} — ${r.error}`);
  process.exit(1);
}
console.log('\n완료 ✅');
