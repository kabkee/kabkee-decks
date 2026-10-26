#!/usr/bin/env bash
# 요청 원장 갱신 — 수집(paperclip) → 조립 → 게시용 사본
# 게시는 Claude Code 세션에서 Artifact 로: https://claude.ai/artifact/Thoq6hjVZEotDqbKN3CVPw
#   (page/index.html + out/ledger.json 을 같은 URL 로 다시 publish. 오너 체크는 아티팩트 db `checks/<IND>` 라 유지된다)
set -euo pipefail
cd "$(dirname "$0")"
python3 fetch.py "$@"
python3 build.py
