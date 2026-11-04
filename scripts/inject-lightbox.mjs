#!/usr/bin/env node
/**
 * 스크린샷 클릭 확대(lightbox) 스크립트를 덱 html 에 주입한다.
 *
 * 왜: 예전에는 덱 .md 끝에 <script> 를 «복붙» 했다. 새 덱에서 빠뜨리기 쉬워
 *     2026-11-04 오너가 「다음부터 놓치지 말고 추가」를 지시했다.
 *     이제 소스는 themes/lightbox.js 한 곳이고, 빌드가 주입을 책임진다.
 *
 * 하는 일: </body> 앞에 <script data-lightbox> 블록을 넣는다.
 *          이미 있으면 새 내용으로 갈아끼우고, .md 에서 복붙돼 들어온 옛 블록은 지운다.
 *
 * 사용법: node scripts/inject-lightbox.mjs weekly-reports/2026-11-04.html [...]
 *         (build-marp.sh 가 빌드 직후 자동으로 부른다)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(resolve(root, 'themes/lightbox.js'), 'utf8').trim();
const BLOCK = `<script data-lightbox>\n${js}\n</script>\n`;

const files = process.argv.slice(2);
if (!files.length) {
  console.error('사용법: node scripts/inject-lightbox.mjs <html> [...]');
  process.exit(1);
}

for (const f of files) {
  let html = readFileSync(f, 'utf8');

  // 1) 이미 주입된 블록 제거 (재빌드·재실행 안전)
  html = html.replace(/<script data-lightbox>[\s\S]*?<\/script>\n?/g, '');

  // 2) .md 에서 복붙돼 들어온 옛 lightbox 블록 제거 (window.__lb 로 식별)
  const before = html;
  html = html.replace(/<script>(?:(?!<\/script>)[\s\S])*?window\.__lb(?:(?!<\/script>)[\s\S])*?<\/script>\n?/g, '');
  const removedOld = html !== before;

  // 3) </body> 앞에 주입
  if (!html.includes('</body>')) { console.error(`❌ ${f} — </body> 를 찾을 수 없습니다`); process.exit(1); }
  html = html.replace(/<\/body>/, `${BLOCK}</body>`);

  writeFileSync(f, html);
  console.log(`🔍 ${f} — 클릭 확대 주입${removedOld ? ' (덱에 복붙돼 있던 옛 블록 제거)' : ''}`);
}
