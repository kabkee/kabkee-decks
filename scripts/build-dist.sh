#!/usr/bin/env bash
# 배포용 산출물(dist/) 만들기 — 웹에서 실제로 쓰는 파일만 «허용 목록» 으로 복사한다.
#
# 왜: 예전에는 `netlify deploy --dir=.` 로 저장소 전체를 올려서 scripts/·*.sh·*.md·백업 파일까지
#     URL 로 열렸다(2026-11-02 확인). 이제는 이 스크립트가 만든 dist/ 만 배포한다.
#
# 들어가는 것: index.html · robots.txt · 파비콘(favicon.ico·favicon.svg·apple-touch-icon.png) · 아래 폴더의 html/css/js/이미지/영상/폰트
# 빠지는 것  : *.md · *.sh · *.mjs · *.json · *.toml · scripts/ · themes/(marp 가 html 에 인라인) ·
#              점(.)으로 시작하는 파일·폴더 · 백업류(*.bak* · *.pre-* · *.orig · *~)
#
# 사용법: ./scripts/build-dist.sh   (배포는 ./scripts/deploy.sh "메시지")
set -euo pipefail
cd "$(dirname "$0")/.."

DIST=dist
CONTENT_DIRS=(weekly-reports guides ideas reports)
EXT_RE='\.(html|css|js|jpg|jpeg|png|gif|svg|webp|ico|mp4|webm|woff|woff2|ttf|pptx)$'  # pptx: 덱 원본 다운로드(2026-11-13)
BACKUP_RE='(\.bak|\.pre-|\.orig$|~$)'

rm -rf "$DIST"
mkdir -p "$DIST"

# 파비콘: 덱 페이지 대부분은 <link rel="icon"> 이 없어 브라우저가 루트 /favicon.ico 를 찾는다 → 루트에 두면 전 페이지 적용(2026-11-18)
cp index.html robots.txt favicon.ico favicon.svg apple-touch-icon.png "$DIST/"

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
# netlify.toml 의 status 200 rewrite 주소(예: /reports/place-scores)는 파일이 없어도 정상 링크다.
# 대신 rewrite 가 가리키는 대상 파일이 dist 에 있는지를 검사한다(2026-11-19).
import tomllib
with open('netlify.toml', 'rb') as f:
    rewrites = {(r['from'].rstrip('/') or '/'): r['to'] for r in tomllib.load(f).get('redirects', [])
                if int(r.get('status', 301)) == 200}
pat = re.compile(r'''(?:href|src)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)''', re.I)
missing, broken = [], []
for root, _, files in os.walk(dist):
    for fn in files:
        if not fn.endswith(('.html', '.css')):
            continue
        page = os.path.join(root, fn)
        text = open(page, encoding='utf-8', errors='ignore').read()
        # <script> 본문은 JS 코드다 — 문자열 속 'href="app.css"' 같은 글자는 이 페이지의 링크가 아니다(2026-11-19).
        # 여는 태그(src 속성)는 남기고 본문만 비운다.
        if fn.endswith('.html'):
            text = re.sub(r'(<script\b[^>]*>).*?</script>', r'\1', text, flags=re.S | re.I)
        for m in pat.finditer(text):
            ref = (m.group(1) or m.group(2) or '').strip()
            # 본문 문장의 「URL(<code>…</code>)」 처럼 태그가 섞인 값은 CSS url() 이 아니다(2026-11-19)
            if '<' in ref:
                continue
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
            url = '/' + os.path.relpath(target, dist).replace(os.sep, '/')
            if url in rewrites:
                to = os.path.normpath(os.path.join(dist, rewrites[url].lstrip('/')))
                if os.path.exists(to):
                    continue
                target = to  # rewrite 대상이 없으면 그 대상 파일 기준으로 누락/깨짐 판정
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
