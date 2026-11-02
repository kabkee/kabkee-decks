#!/usr/bin/env bash
# 배포용 산출물(dist/) 만들기 — 웹에서 실제로 쓰는 파일만 «허용 목록» 으로 복사한다.
#
# 왜: 예전에는 `netlify deploy --dir=.` 로 저장소 전체를 올려서 scripts/·*.sh·*.md·백업 파일까지
#     URL 로 열렸다(2026-11-02 확인). 이제는 이 스크립트가 만든 dist/ 만 배포한다.
#
# 들어가는 것: index.html · robots.txt · 아래 폴더의 html/css/js/이미지/영상/폰트
# 빠지는 것  : *.md · *.sh · *.mjs · *.json · *.toml · scripts/ · themes/(marp 가 html 에 인라인) ·
#              점(.)으로 시작하는 파일·폴더 · 백업류(*.bak* · *.pre-* · *.orig · *~)
#
# 사용법: ./scripts/build-dist.sh   (배포는 ./scripts/deploy.sh "메시지")
set -euo pipefail
cd "$(dirname "$0")/.."

DIST=dist
CONTENT_DIRS=(weekly-reports guides ideas reports)
EXT_RE='\.(html|css|js|jpg|jpeg|png|gif|svg|webp|ico|mp4|webm|woff|woff2|ttf)$'
BACKUP_RE='(\.bak|\.pre-|\.orig$|~$)'

rm -rf "$DIST"
mkdir -p "$DIST"

cp index.html robots.txt "$DIST/"

n=0
while IFS= read -r -d '' f; do
  rel="${f#./}"
  # 점으로 시작하는 경로 조각이 하나라도 있으면 제외
  [[ "/$rel" == */.* ]] && continue
  [[ "$rel" =~ $EXT_RE ]] || continue
  [[ "$rel" =~ $BACKUP_RE ]] && continue
  mkdir -p "$DIST/$(dirname "$rel")"
  cp -p "$rel" "$DIST/$rel"
  n=$((n + 1))
done < <(find "${CONTENT_DIRS[@]}" -type f -print0)

echo "✅ $DIST/ — 콘텐츠 $n개 + index.html · robots.txt ($(du -sh "$DIST" | cut -f1))"

# ── 검증: dist 안 html 이 가리키는 로컬 파일이 dist 에 다 있는지 ──
# 원본에는 있는데 dist 에 없으면 = 허용 목록 누락 → 실패
# 원본에도 없으면 = 원래 깨진 링크 → 경고만
python3 - "$DIST" <<'PY'
import os, re, sys
from urllib.parse import unquote, urlsplit
dist = sys.argv[1]
pat = re.compile(r'''(?:href|src)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)''', re.I)
missing, broken = [], []
for root, _, files in os.walk(dist):
    for fn in files:
        if not fn.endswith(('.html', '.css')):
            continue
        page = os.path.join(root, fn)
        text = open(page, encoding='utf-8', errors='ignore').read()
        for m in pat.finditer(text):
            ref = (m.group(1) or m.group(2) or '').strip()
            if not ref or re.match(r'^(?:[a-z][a-z0-9+.-]*:|//|#|\{|\$)', ref, re.I):
                continue
            path = unquote(urlsplit(ref).path)
            if not path:
                continue
            base = dist if path.startswith('/') else root
            target = os.path.normpath(os.path.join(base, path.lstrip('/')))
            if path.endswith('/'):
                target = os.path.join(target, 'index.html')
            if os.path.exists(target):
                continue
            src = os.path.relpath(target, dist)
            (missing if os.path.exists(src) else broken).append(f'{os.path.relpath(page, dist)} → {ref}')
if broken:
    print(f'⚠️  원본에도 없는 링크 {len(broken)}건 (배포와 무관, 참고용):')
    for x in sorted(set(broken))[:10]:
        print('   ', x)
if missing:
    print(f'❌ 허용 목록에서 빠진 파일 {len(missing)}건 — build-dist.sh 의 EXT_RE/CONTENT_DIRS 를 고칠 것:')
    for x in sorted(set(missing))[:20]:
        print('   ', x)
    sys.exit(1)
print('✅ 링크 검증 통과 — dist 안 html 이 가리키는 로컬 파일 누락 0건')
PY
