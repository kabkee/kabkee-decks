#!/usr/bin/env bash
# kabkee-decks 정적 슬라이드 서버
# - tailnet 내부에서 슬라이드를 바로 열람하기 위한 정적 HTTP 서버
# - 접속: http://kabkee-macbookpro-2020.tailfe017f.ts.net:8088/  (tailnet 연결 기기에서)
#         http://100.120.25.127:8088/                            (IP 직접)
# - 로컬에서 슬라이드 파일을 수정하면 새로고침만으로 바로 반영됨
set -euo pipefail

PORT="${1:-8088}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$DIR"
echo "[kabkee-decks] serving $DIR on 0.0.0.0:$PORT"
exec python3 -m http.server "$PORT" --bind 0.0.0.0
