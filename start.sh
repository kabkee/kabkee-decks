#!/usr/bin/env bash
# kabkee-decks/start.sh — 정적 슬라이드 서버(tailnet 8088) 시작 — port-viewer ON & cron @reboot 공용
# cron @reboot 와 port-viewer ON 버튼이 같은 스크립트를 쓰도록 통일(중복 기동/상태 불일치 방지).
PORT=8088
PIDFILE="/tmp/kabkee-decks.pid"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# [중요] 호출자(port-viewer execFile)의 stdout/stderr 파이프를 즉시 로그파일로 분리한다.
# 이렇게 하지 않으면 백그라운드로 띄운 python 이 파이프를 상속해 닫지 않아,
# 호출한 쪽(ON 버튼/curl)이 스크립트 종료를 감지하지 못하고 무한 대기(hang)하게 된다.
exec >>/tmp/kabkee-decks-serve.log 2>&1

# 이미 8088 LISTEN 중이면 중복 기동하지 않음 (cron @reboot · 수동 serve.sh 포함)
if ss -tln 2>/dev/null | grep -q ":${PORT} "; then
  exit 0
fi

cd "$DIR" || exit 1
nohup python3 -m http.server "$PORT" --bind 0.0.0.0 </dev/null &
PID=$!
echo "$PID" > "$PIDFILE"
disown "$PID" 2>/dev/null

# 기동 확인 (최대 ~2초): LISTEN 뜨면 성공 종료
for _ in 1 2 3 4 5 6 7 8 9 10; do
  ss -tln 2>/dev/null | grep -q ":${PORT} " && exit 0
  sleep 0.2
done
exit 0
