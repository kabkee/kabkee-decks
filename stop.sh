#!/usr/bin/env bash
# kabkee-decks/stop.sh — 정적 슬라이드 서버(tailnet 8088) 종료 — port-viewer OFF 제어용
PORT=8088
PIDFILE="/tmp/kabkee-decks.pid"

# PID 파일 우선 시도
if [ -f "$PIDFILE" ]; then
  kill "$(cat "$PIDFILE")" 2>/dev/null && sleep 0.5
  rm -f "$PIDFILE"
fi

# cron @reboot 등으로 뜬 남은 프로세스 정리 (8088 전용 매칭)
pkill -f "python3.*http\.server.*${PORT}" 2>/dev/null || true
