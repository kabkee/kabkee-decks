#!/usr/bin/env node
/**
 * 빌드된 marp 덱 검증 — 오버플로 · 깨진 이미지 · 이모지 오염 · 스크린샷 슬라이드의 URL 링크 누락
 *
 * 사용법: node scripts/check-deck.mjs weekly-reports/2026-09-02.html
 *
 * marp 는 넘친 내용을 잘라내지 않고 그냥 흘려보내므로 육안으로는 안 보인다.
 * 한 장이라도 문제가 있으면 exit 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const target = process.argv[2];
if (!target) { console.error('사용법: node scripts/check-deck.mjs <빌드된 .html 경로>'); process.exit(1); }
const abs = path.resolve(ROOT, target);
if (!fs.existsSync(abs)) { console.error(`❌ 파일 없음: ${abs}`); process.exit(1); }

function findPlaywright() {
  const bases = [path.join(ROOT, 'node_modules/playwright-core')];
  const pnpm = '/home/kabkee/Developments/paperclip/node_modules/.pnpm';
  if (fs.existsSync(pnpm)) {
    for (const d of fs.readdirSync(pnpm).filter((x) => x.startsWith('playwright-core@')).sort().reverse()) {
      bases.push(path.join(pnpm, d, 'node_modules/playwright-core'));
    }
  }
  for (const b of bases) if (fs.existsSync(b)) return require_(path.join(b, 'index.js'));
  throw new Error('playwright-core 를 찾지 못했습니다.');
}

const { chromium } = findPlaywright();
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`file://${abs}`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1200);

const r = await page.evaluate(() => {
  const secs = [...document.querySelectorAll('section')];
  const imgs = [...document.querySelectorAll('section img:not(.emoji)')];
  const emoji = document.querySelector('img.emoji');
  return {
    slides: secs.length,
    overflow: secs.map((s, i) => ({ p: i + 1, over: s.scrollHeight - Math.round(s.clientHeight) })).filter((x) => x.over > 4),
    broken: imgs.filter((i) => !i.naturalWidth).map((i) => decodeURIComponent(i.getAttribute('src') || '')),
    shots: imgs.map((i) => ({ f: decodeURIComponent((i.getAttribute('src') || '').split('/').pop()),
                              shown: i.clientWidth, real: i.naturalWidth })),
    emojiPolluted: emoji ? getComputedStyle(emoji).borderTopWidth !== '0px' : false,
    // 스크린샷을 실은 슬라이드는 「직접 확인」 링크를 반드시 함께 실어야 한다 (오너 상시 요구)
    missingLink: secs.map((s, i) => ({
      p: i + 1,
      title: (s.querySelector('h2')?.textContent || '').trim().slice(0, 42),
      hasShot: !!s.querySelector('img:not(.emoji)'),
      hasLink: !!s.querySelector('a[target="_blank"]'),
    })).filter((x) => x.hasShot && !x.hasLink),
  };
});
await browser.close();

console.log(`\n📊 ${path.relative(ROOT, abs)}  —  슬라이드 ${r.slides}장\n`);
let fail = false;

if (r.overflow.length) {
  fail = true;
  console.log('❌ 내용이 넘친 슬라이드 (문장 압축 또는 2장 분할 필요):');
  for (const o of r.overflow) console.log(`   · ${o.p}p — ${o.over}px 초과`);
} else console.log('✅ 오버플로 없음');

if (r.broken.length) {
  fail = true;
  console.log('❌ 깨진 이미지:');
  for (const b of r.broken) console.log(`   · ${b}`);
} else console.log(`✅ 이미지 ${r.shots.length}장 정상`);

if (r.emojiPolluted) { fail = true; console.log('❌ 이모지에 테두리가 붙었습니다 — 테마의 section img 규칙에 :not(.emoji) 확인'); }
else console.log('✅ 이모지 스타일 정상');

if (r.missingLink.length) {
  fail = true;
  console.log('❌ 스크린샷은 있는데 「직접 확인」 URL 링크가 없는 슬라이드:');
  for (const m of r.missingLink) console.log(`   · ${m.p}p — ${m.title}`);
  console.log('   ↳ 캡션 아래에 아래 블록을 넣으세요 (capture-weekly.mjs 가 URL 을 그대로 출력합니다):');
  console.log('     <div class="links"><span class="lbl">직접 확인</span>');
  console.log('     <a class="lnk" href="http://…" target="_blank">http://…</a></div>');
} else console.log('✅ 스크린샷 슬라이드 URL 링크 완비');

if (r.shots.length) {
  console.log('\n   스크린샷 해상도 (표시폭 → 원본폭):');
  for (const s of r.shots) {
    const ratio = s.real / s.shown;
    console.log(`   · ${s.f.padEnd(30)} ${String(s.shown).padStart(4)}px → ${String(s.real).padStart(4)}px  (${ratio.toFixed(1)}배)${ratio < 1.5 ? '  ⚠️ 확대 시 흐릿할 수 있음' : ''}`);
  }
}

console.log(fail ? '\n❌ 검증 실패\n' : '\n완료 ✅\n');
process.exit(fail ? 1 : 0);
