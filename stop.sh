#!/usr/bin/env bash
# kabkee-decks/stop.sh — 정적 슬라이드 서버(8088) 종료 — port-viewer OFF 제어용
# 8088 을 "실제 LISTEN 중인 PID" 만 정밀 종료한다.
# (pkill 패턴 매칭은 명령줄에 같은 문자열을 가진 무관 프로세스까지 죽일 수 있어 사용하지 않음)
PORT=8088
PIDFILE="/tmp/kabkee-decks.pid"

# 1순위: 포트를 실제 점유한 LISTEN PID 추출 (가장 정확)
PID="$(ss -tlnp "sport = :${PORT}" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)"

# 2순위(fallback): pidfile
if [ -z "$PID" ] && [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE" 2>/dev/null)"
fi

if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null
  # 최대 ~2초 graceful 대기, 안 죽으면 강제 종료
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "$PID" 2>/dev/null || break
    sleep 0.2
  done
  kill -0 "$PID" 2>/dev/null && kill -9 "$PID" 2>/dev/null
fi

rm -f "$PIDFILE"
exit 0
