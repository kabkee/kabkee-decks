#!/usr/bin/env bash
# marp 슬라이드 빌드 — 마크다운(.md) → 슬라이드(.html)
#
# 사용법:
#   ./build-marp.sh weekly-reports/2026-06-15.md      # 단일 파일
#   ./build-marp.sh                                    # *.md 중 marp 헤더 있는 것 전체
#
# 디자인은 themes/*.css 가 전담 — 마크다운엔 내용만 쓰면 됨.
# 스크린샷 클릭 확대도 빌드가 자동으로 넣는다(themes/lightbox.js) — .md 에 <script> 복붙 불필요.
# PDF 가 필요하면 끝에 --pdf 를 붙이거나 OUT 을 .pdf 로.
set -euo pipefail
cd "$(dirname "$0")"

MARP=(npx -y @marp-team/marp-cli --theme-set themes/ --html --no-stdin)

build() {
  local src="$1"
  local out="${src%.md}.html"
  "${MARP[@]}" "$src" -o "$out"
  # 스크린샷 클릭 확대(lightbox) 주입 — 소스는 themes/lightbox.js 한 곳.
  # 덱 .md 마다 복붙하면 새 덱에서 빠뜨린다(2026-11-04 오너 지시로 빌드가 책임짐).
  node scripts/inject-lightbox.mjs "$out"
  echo "✅ $out"
}

if [[ $# -ge 1 ]]; then
  build "$1"
else
  # marp: true 헤더가 있는 .md 만 빌드
  grep -rl --include='*.md' '^marp: true' . 2>/dev/null | while read -r f; do build "$f"; done
fi
