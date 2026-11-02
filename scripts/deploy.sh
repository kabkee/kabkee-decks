#!/usr/bin/env bash
# Netlify 프로덕션 배포 — dist/ 를 새로 만든 뒤 dist/ 만 올린다.
#
# 사용법: ./scripts/deploy.sh "배포 메시지"
#
# AI 실행 안전 규칙(claude_works/rules/scripts.md §Netlify CLI)을 그대로 따른다:
#   비대화형(CI=1) · 시간 제한(timeout) · 사이트 명시(--site) · stdin 닫기(< /dev/null) · --json 결과
set -euo pipefail
cd "$(dirname "$0")/.."

MSG="${1:?배포 메시지를 첫 번째 인자로 주세요}"
SID=$(jq -r .siteId .netlify/state.json)

./scripts/build-dist.sh

OUT=$(CI=1 timeout 1800 netlify deploy --prod --dir=dist --site "$SID" --json --message "$MSG" < /dev/null)
echo "$OUT" | jq '{deploy_id, url, deploy_url}'
