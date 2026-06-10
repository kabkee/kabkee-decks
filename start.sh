#!/usr/bin/env bash
# kabkee-decks/start.sh — 정적 슬라이드 서버(tailnet 8088) 시작 — port-viewer ON 제어용
# 실제 서빙 로직은 serve.sh 와 동일(python3 http.server). cron @reboot 와 중복 기동 방지.
PORT=8088
PIDFILE="/tmp/kabkee-decks.pid"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 이미 8088 LISTEN 중이면 스킵 (cron @reboot serve.sh 포함)
if ss -tln 2>/dev/null | grep -q ":${PORT} "; then
  exit 0
fi

cd "$DIR" && nohup python3 -m http.server "$PORT" --bind 0.0.0.0 >/tmp/kabkee-decks-serve.log 2>&1 &
PID=$!
echo "$PID" > "$PIDFILE"
disown "$PID" 2>/dev/null
