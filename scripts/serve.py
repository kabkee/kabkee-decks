#!/usr/bin/env python3
"""kabkee-decks 로컬 정적 서버 — netlify.toml 의 rewrite 규칙을 Netlify 와 같게 적용한다.

왜: `python3 -m http.server` 는 netlify.toml 을 읽지 않아서, Netlify 에서만 동작하는
    고정 공유 주소(예: /reports/place-scores → 2026-11-18-place-guide-scores.html)가
    로컬(:8088)에서는 404 가 났다(2026-11-19 확인).

Netlify 와 맞춘 동작:
  1. 요청 경로에 실제 파일·폴더가 있으면 그대로 서빙한다 (rewrite 는 force 가 아니면 파일이 우선)
  2. 없으면 netlify.toml 의 [[redirects]] 중 status 200(rewrite) 규칙을 적용한다
     - status 301/302 규칙은 Location 헤더로 리다이렉트한다
  3. 그래도 없으면 확장자 없는 주소를 `.html` 로 찾아본다 (Netlify pretty URL)
netlify.toml 은 요청마다 다시 읽는다 — 규칙을 고치면 서버 재시작 없이 반영된다.

사용법: python3 scripts/serve.py [PORT]   (기본 8088, 저장소 루트를 서빙)
"""
import http.server
import os
import sys
import tomllib
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOML = os.path.join(ROOT, "netlify.toml")


def load_redirects():
    try:
        with open(TOML, "rb") as f:
            return tomllib.load(f).get("redirects", [])
    except (OSError, tomllib.TOMLDecodeError) as e:
        print(f"[serve] netlify.toml 읽기 실패: {e}", file=sys.stderr)
        return []


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _exists(self, path):
        return os.path.exists(self.translate_path(path))

    def _resolve(self):
        """self.path 를 Netlify 규칙대로 바꾼다. 리다이렉트를 보냈으면 True 를 돌려준다."""
        parts = urlsplit(self.path)
        path = parts.path
        if self._exists(path):
            return False
        norm = path.rstrip("/") or "/"
        for r in load_redirects():
            if (r.get("from", "").rstrip("/") or "/") != norm:
                continue
            to = r.get("to", "")
            status = int(r.get("status", 301))
            if status == 200:
                self.path = to + (f"?{parts.query}" if parts.query else "")
                return False
            self.send_response(status)
            self.send_header("Location", to)
            self.end_headers()
            return True
        if not os.path.splitext(norm)[1] and self._exists(norm + ".html"):
            self.path = norm + ".html" + (f"?{parts.query}" if parts.query else "")
        return False

    def do_GET(self):
        if not self._resolve():
            super().do_GET()

    def do_HEAD(self):
        if not self._resolve():
            super().do_HEAD()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8088
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler) as httpd:
        print(f"[kabkee-decks] serving {ROOT} on 0.0.0.0:{port} (netlify.toml rewrite 적용)", flush=True)
        httpd.serve_forever()
