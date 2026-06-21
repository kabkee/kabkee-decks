#!/usr/bin/env bash
# marp 슬라이드 빌드 — 마크다운(.md) → 슬라이드(.html)
#
# 사용법:
#   ./build-marp.sh weekly-reports/2026-06-15.md      # 단일 파일
#   ./build-marp.sh                                    # *.md 중 marp 헤더 있는 것 전체
#
# 디자인은 themes/look360.css 가 전담 — 마크다운엔 내용만 쓰면 됨.
# PDF 가 필요하면 끝에 --pdf 를 붙이거나 OUT 을 .pdf 로.
set -euo pipefail
cd "$(dirname "$0")"

MARP=(npx -y @marp-team/marp-cli --theme-set themes/ --html --no-stdin)

build() {
  local src="$1"
  local out="${src%.md}.html"
  "${MARP[@]}" "$src" -o "$out"
  echo "✅ $out"
}

if [[ $# -ge 1 ]]; then
  build "$1"
else
  # marp: true 헤더가 있는 .md 만 빌드
  grep -rl --include='*.md' '^marp: true' . 2>/dev/null | while read -r f; do build "$f"; done
fi
