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
 * 출력: weekly-reports/assets/<날짜>/NN-<id>.png
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
  { id: 'home-hero',    site: 'fe',    url: '/',                        wait: 3500, crop: 'hero',
    desc: '홈 — 히어로 360VIEW 자동재생 · 우하단 정보 · 랜덤 슬라이드' },
  { id: 'vrlist',       site: 'fe',    url: '/vr-list',                 wait: 2500,
    desc: 'VR 목록 — 필터·카드 규격·지역 칩' },
  { id: 'autocomplete', site: 'fe',    url: '/vr-list',                 wait: 2500, type: { sel: 'input[placeholder*="검색"]', text: '서울', after: 1800 },
    desc: '검색 자동완성 — VR/파노라마/360포스트/채널 배지' },
  { id: 'faq',          site: 'fe',    url: '/faq',                     wait: 2000,
    desc: 'FAQ — 카테고리 필터 칩 + 제목 앞 칩' },
  { id: 'admin-search-trends', site: 'admin', url: '/admin/search-trends', wait: 3000,
    desc: '관리자 — 검색 트렌드 통계 (인기 검색어 · 0건 검색어)' },
  { id: 'admin-main-hero',     site: 'admin', url: '/main-page?tab=hero',  wait: 3000,
    desc: '관리자 — 메인 페이지 / 히어로 슬라이드 풀 구성' },
  { id: 'admin-sales',         site: 'admin', url: '/vr-sales-settings',   wait: 3000,
    desc: '관리자 — VR 판매 설정 (미리보기 위반 건수 상시 노출)' },
  { id: 'admin-bbs',           site: 'admin', url: '/bbs/manage',          wait: 3000,
    desc: '관리자 — 게시판/FAQ 카테고리 관리' },
];

const CROPS = {
  // 홈 히어로 영역만 (1440x900 뷰포트 기준)
  hero: { x: 38, y: 120, width: 1364, height: 417 },
};

const VIEWPORT = { width: 1440, height: 900 };

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
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ko-KR', deviceScaleFactor: 1 });

if (needAdmin) {
  const token = adminToken();
  await ctx.addCookies([{ name: 'accessToken', value: token, domain: '100.120.25.127', path: '/' }]);
  console.log('🔑 관리자 accessToken 쿠키 주입 완료 (60분 유효)');
}

const page = await ctx.newPage();
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text().slice(0, 160)); });

const results = [];
let seq = 0;

for (const shot of targets) {
  seq += 1;
  const base = `${String(seq).padStart(2, '0')}-${shot.id}`;
  const file = path.join(OUT_DIR, `${base}.png`);
  const origin = shot.site === 'admin' ? ADMIN : FE;
  const before = pageErrors.length;
  try {
    await page.goto(origin + shot.url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(shot.wait ?? 2000);

    if (shot.type) {
      await page.locator(shot.type.sel).first().pressSequentially(shot.type.text, { delay: 90 });
      await page.waitForTimeout(shot.type.after ?? 1500);
    }

    await page.screenshot({ path: file });
    const made = [`${base}.png`];

    if (shot.crop && CROPS[shot.crop]) {
      const cropFile = path.join(OUT_DIR, `${base}-crop.png`);
      await page.screenshot({ path: cropFile, clip: CROPS[shot.crop] });
      made.push(`${base}-crop.png`);
    }

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
  console.log('\n마크다운에 붙여넣기:');
  for (const r of ok) for (const f of r.files) {
    console.log(`  ![w:900](assets/${DATE}/${f})`);
  }
}
if (failed.length) {
  console.log('\n❌ 실패한 화면:');
  for (const r of failed) console.log(`  · ${r.id} — ${r.error}`);
  process.exit(1);
}
console.log('\n완료 ✅');
