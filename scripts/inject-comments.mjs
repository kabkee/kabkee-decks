#!/usr/bin/env node
/**
 * 슬라이드 요소별 검토 코멘트(themes/deck-comments.js)를 덱 html 에 주입한다.
 *
 * 왜: 2026-11-16 오너 요청 — CTA 강의 검토본처럼 주간회의 덱에도 요소마다 코멘트·수정 요청을 직접 달고,
 *     Claude 가 그 코멘트를 읽어 덱을 고치게 한다(예전에는 채팅으로 «몇 쪽 무엇을 고쳐 줘»라고 말했다).
 *
 * 하는 일: <meta name="deck-comments" content="<덱 id>"> 와 <script data-deck-comments> 블록을 넣는다(재실행 안전).
 *   덱 id = weekly-reports/2026-11-16.html → weekly-2026-11-16 · reports/x.html → report-x · guides/x.html → guide-x
 *   API(netlify/functions/comments.mjs)는 이 id 형식만 받는다.
 *
 * 사용법: node scripts/inject-comments.mjs weekly-reports/2026-11-16.html [...]
 *         (build-marp.sh 가 빌드 직후 자동으로 부른다)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(resolve(root, 'themes/deck-comments.js'), 'utf8').trim();

export const deckId = (f) => {
  const name = basename(f).replace(/\.html$/, '');
  const dir = basename(dirname(resolve(f)));
  const prefix = { 'weekly-reports': 'weekly', reports: 'report', guides: 'guide', ideas: 'idea' }[dir] || 'deck';
  return `${prefix}-${name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64);
};

const files = process.argv.slice(2);
if (!files.length) { console.error('사용법: node scripts/inject-comments.mjs <html> [...]'); process.exit(1); }

for (const f of files) {
  let html = readFileSync(f, 'utf8');
  const id = deckId(f);
  html = html.replace(/<meta name="deck-comments"[^>]*>\n?/g, '').replace(/<script data-deck-comments>[\s\S]*?<\/script>\n?/g, '');
  if (!html.includes('</head>') || !html.includes('</body>')) { console.error(`❌ ${f} — </head>/</body> 없음`); process.exit(1); }
  html = html.replace('</head>', `<meta name="deck-comments" content="${id}">\n</head>`);
  html = html.replace(/<\/body>/, `<script data-deck-comments>\n${js}\n</script>\n</body>`);
  writeFileSync(f, html);
  console.log(`💬 ${f} — 코멘트 주입 (덱 id: ${id})`);
}
