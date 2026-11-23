#!/usr/bin/env python3
"""비교 페이지 생성 — kabkee-decks/reports/2026-11-23-webp-q-compare.html + assets

사용법: python3 -P scripts/build_page.py <작업폴더> <kabkee-decks 경로>

페이지는 «실제 타일 파일»(원본 JPG · 변환된 WebP)을 그대로 싣고 브라우저가 디코딩한다.
잘라서 다시 저장하지 않으므로 화면에 보이는 픽셀이 운영에서 관람자가 받을 픽셀과 같다.
"""
import json
import re
import shutil
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
decks = Path(sys.argv[2]).resolve()
SLUG = "2026-11-23-webp-q-compare"
page = decks / "reports" / f"{SLUG}.html"
assets = decks / "reports" / "assets" / SLUG
summ = json.load(open(root / "metrics" / "summary.json"))
QS = ["60", "70", "75"]
SKIP = -8.0  # 계획 덱의 장면 스킵 규칙: 장면 절감률 8% 미만이면 JPG 유지

# 목록.txt 의 분류·메모
group, notes = {}, {}
cur = ""
for line in open(root / "src" / "목록.txt", encoding="utf-8"):
    m = re.match(r"\[(.+?)\]", line.strip())
    if m:
        cur = m.group(1)
        continue
    m = re.match(r"\s*(pano/\d+/\d+/\d+)\s+(.+?)\s{2,}(.+)$", line.rstrip())
    if m:
        group[m.group(1)] = cur
        notes[m.group(1)] = m.group(3).split("·")[0].strip()

if assets.exists():
    shutil.rmtree(assets)
data = []
for s in summ["scenes"]:
    slug = s["scene"].replace("pano/", "").replace("/", "-")
    (assets / slug).mkdir(parents=True, exist_ok=True)
    regs = []
    for g in s["regions"]:
        t = Path(g["tile"])
        base = t.stem  # l1_f_4_5
        shutil.copy2(root / "src" / t, assets / slug / f"{base}.jpg")
        for q in QS:
            shutil.copy2(root / "out" / f"q{q}" / t.with_suffix(".webp"), assets / slug / f"{base}.q{q}.webp")
        lv, face = base.split("_")[0], base.split("_")[1]
        regs.append({**g, "base": base, "level": lv, "face": face})
    st = {q: s["stat"][q] for q in QS}
    data.append({"scene": s["scene"], "slug": slug, "name": s["name"], "group": group.get(s["scene"], ""),
                 "note": notes.get(s["scene"], ""), "jpg": s["jpg_bytes"], "tiles": s["tiles"],
                 "stat": st, "regions": regs})

# 합계 (그대로 전부 바꿀 때 / 스킵 규칙 적용 시)
jpg_tot = sum(d["jpg"] for d in data)
tot = {}
for q in QS:
    allw = sum(d["stat"][q]["webp_bytes"] for d in data)
    skip = [d for d in data if d["stat"][q]["change_pct"] > SKIP]
    ruled = sum(d["jpg"] if d in skip else d["stat"][q]["webp_bytes"] for d in data)
    grown = sum(d["stat"][q]["grown"] for d in data)
    tot[q] = {"all": allw, "all_pct": round((allw / jpg_tot - 1) * 100, 1),
              "ruled": ruled, "ruled_pct": round((ruled / jpg_tot - 1) * 100, 1),
              "skip": [d["name"] for d in skip], "grown": grown}

DATA = json.dumps({"scenes": data, "total": tot, "jpg_total": jpg_tot, "skip": SKIP}, ensure_ascii=False)

html = r"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WebP q60 · q70 · q75 화질 비교 — 레거시 타일 11개 장면</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:'Noto Sans KR',system-ui,sans-serif;color:#1f2937;background:#f3f4f6;line-height:1.6;--s:256px}
code{background:#eef2ff;border-radius:4px;padding:1px 5px;font-size:.86em;overflow-wrap:anywhere}
header{background:#111827;color:#f9fafb;padding:32px 24px 24px}header .w,main{max-width:1400px;margin:0 auto}
header h1{margin:0;font-size:clamp(1.15em,3.6vw,1.55em);line-height:1.35;word-break:keep-all}header .sub{color:#9ca3af;margin-top:6px;font-size:.88em}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:18px}
.kpi{background:#1f2937;border:1px solid #374151;border-radius:12px;padding:11px 14px;min-width:0}.kpi b{display:block;font-size:1.3em;color:#fbbf24}.kpi span{font-size:.78em;color:#d1d5db}
main{padding:20px 24px 60px;display:flex;flex-direction:column;gap:18px}
section{scroll-margin-top:60px;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:18px 22px;min-width:0}
h2{margin:0 0 10px;font-size:1.15em;word-break:keep-all}h2 small{font-weight:400;color:#6b7280;font-size:.72em;margin-left:6px}
h3{margin:0;font-size:1.05em;word-break:keep-all}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}
table{width:100%;border-collapse:collapse;font-size:.84em}th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:right;vertical-align:middle;white-space:nowrap}
th{background:#f9fafb;color:#374151}td:first-child,th:first-child,td.l,th.l{text-align:left;white-space:normal}
#sumtable td:first-child,#sumtable th:first-child{position:sticky;left:0;background:#fff;z-index:1;min-width:170px;box-shadow:1px 0 0 #e5e7eb}
#sumtable th:first-child{background:#f9fafb}
.swipe{display:none;font-size:.76em;color:#6b7280;margin-bottom:4px}
.good{color:#047857;font-weight:700}.bad{color:#b91c1c;font-weight:700}.mute{color:#9ca3af}.amber{color:#b45309;font-weight:700}
.tag{display:inline-block;font-size:.72em;padding:1px 8px;border-radius:999px;background:#eef2ff;color:#3730a3;margin-left:6px;vertical-align:middle}
ul{margin:6px 0 0;padding-left:20px}li{margin:2px 0}
.bar{position:sticky;top:0;z-index:5;background:#111827f2;color:#f9fafb;padding:9px 24px;display:flex;gap:8px 16px;align-items:center;flex-wrap:wrap;font-size:.86em}
.bar .grp{display:flex;gap:4px;align-items:center}.bar button{background:#374151;color:#f9fafb;border:0;border-radius:7px;padding:4px 11px;cursor:pointer;font:inherit}
.bar button.on{background:#fbbf24;color:#111827;font-weight:700}.bar a{color:#93c5fd}.bar .nav{margin-left:auto}
.scene-h{display:flex;justify-content:space-between;gap:4px 10px;align-items:baseline;flex-wrap:wrap}
.scene-h .p{color:#6b7280;font-size:.8em}
.mini{margin:10px 0 4px}.mini td,.mini th{padding:4px 8px}
.region{border-top:1px dashed #e5e7eb;margin-top:14px;padding-top:12px}
.rh{font-size:.86em;color:#374151;margin-bottom:8px}.rh b{color:#111827}
/* 비교 칸: 썸네일 + 4칸. 칸 폭 = min(선택한 크기, 남는 폭) */
.row{display:grid;grid-template-columns:150px repeat(4,minmax(0,var(--s)));gap:10px;justify-content:start;align-items:start}
.ov{width:150px;font-size:.72em;color:#6b7280;min-width:0}.ov .box{position:relative;width:150px;height:150px;background:#e5e7eb;flex:0 0 auto}
.ov img{width:100%;height:100%;display:block}.ov .rect{position:absolute;border:2px solid #ef4444;box-shadow:0 0 0 1px #fff}
.pn{min-width:0;display:flex;flex-direction:column;align-self:stretch}.pn .lab{flex:1 0 auto;align-content:flex-end;font-size:.74em;margin-bottom:3px;display:flex;justify-content:space-between;align-items:baseline;gap:0 6px;flex-wrap:wrap;line-height:1.4}
.pn .lab b{font-size:1.08em;white-space:nowrap}.pn .lab span{white-space:nowrap}
.pn .v{position:relative;overflow:hidden;background:#000;border-radius:4px;cursor:crosshair;width:100%;aspect-ratio:1/1;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.pn .v img{position:absolute;image-rendering:pixelated;image-rendering:crisp-edges;max-width:none;pointer-events:none}
.pn .v .peek{position:absolute;left:4px;top:4px;background:#ef4444;color:#fff;font-size:.7em;padding:0 6px;border-radius:4px;display:none}
.pn .v.peeking .peek{display:block}
.pn.jpg .lab b{color:#111827}.pn.q60 .lab b{color:#b91c1c}.pn.q70 .lab b{color:#b45309}.pn.q75 .lab b{color:#047857}
.note{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;font-size:.86em}
.pick{display:flex;gap:6px;margin-top:10px;font-size:.82em;align-items:center;flex-wrap:wrap}
.pick button{border:1px solid #d1d5db;background:#fff;border-radius:7px;padding:3px 10px;cursor:pointer;font:inherit}
.pick button.on{background:#111827;color:#fff;border-color:#111827}
#verdicts td{text-align:left}
#logt td:first-child{white-space:nowrap;font-weight:500}

/* 중간 폭: 썸네일을 위 한 줄로 */
@media (max-width:1100px){
 .row{grid-template-columns:repeat(4,minmax(0,var(--s)))}
 .ov{grid-column:1/-1;width:auto;display:flex;gap:10px;align-items:flex-end}
 .ov .box{width:110px;height:110px}
}
/* 좁은 폭: 2×2 칸 · 여백 축소 · 표는 쌓기 */
@media (max-width:760px){
 header{padding:22px 14px 18px}
 .kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.kpi{padding:9px 11px}.kpi b{font-size:1.1em}
 main{padding:12px 10px 40px;gap:12px}
 section{padding:14px 13px;border-radius:12px}
 .bar{padding:7px 10px;font-size:.8em}.bar .hint{display:none}.bar button{padding:4px 9px}
 .swipe{display:block}
 #sumtable td:first-child,#sumtable th:first-child{min-width:130px}
 .row{grid-template-columns:repeat(2,minmax(0,var(--s)))}
 ul{padding-left:18px}
 .mini td,.mini th{white-space:normal}
 #verdicts tr:first-child{display:none}
 #verdicts tr{display:grid;grid-template-columns:1fr auto auto;gap:0 10px;border-bottom:1px solid #e5e7eb;padding:6px 0}
 #verdicts td{border:0;padding:2px 0}
 #verdicts td:last-child{grid-column:1/-1}
 #logt tr:first-child{display:none}
 #logt tr,#logt td{display:block;border:0}
 #logt tr{border-bottom:1px solid #e5e7eb;padding:6px 0}
 #logt td{padding:1px 0;white-space:normal}
 #logt td:first-child{color:#6b7280;font-size:.92em}
}
@media (max-width:440px){
 .bar .nav{display:none}
 .kpis{grid-template-columns:minmax(0,1fr)}
}
</style></head><body>
<header><div class="w">
<h1>WebP q60 · q70 · q75 화질 비교 — 레거시 큐브 타일 11개 장면</h1>
<div class="sub">2026-11-23 · <a href="2026-11-18-webp-legacy-tile-plan.html" style="color:#93c5fd">레거시 큐브 타일 WebP 전환 실행 계획</a> 후속 · 시범 장면 11개(타일 5,544장)를 세 품질로 바꾸고 장면마다 «가장 많이 달라진 곳»을 골라 나란히 놓았습니다</div>
<div class="kpis" id="kpis"></div>
</div></header>
<div class="bar">
 <div class="grp">확대 <button data-z="1">1×</button><button data-z="2" class="on">2×</button><button data-z="3">3×</button></div>
 <div class="grp">칸 크기 <button data-s="192">작게</button><button data-s="256" class="on">보통</button><button data-s="320">크게</button></div>
 <div class="hint">💡 WebP 칸을 <b>누르고 있으면(마우스 올리면)</b> 같은 자리의 JPG 원본으로 바뀝니다</div>
 <div class="nav"><a href="#summary">요약</a> · <a href="#verdict">판정표</a> · <a href="#log">작업 내역</a></div>
</div>
<main>
<section id="summary">
<h2>요약 — 11개 장면 전체 용량과 장면 스킵 규칙 <small>장면마다 큐브 타일 504장 전부 · 지금 JPG 대비</small></h2>
<div id="sumtable"></div>
<ul>
<li><b>q60 만 «전체로 봐도 확실히 줄어듭니다».</b> q70 은 디테일 많은 장면에서 −4~9% 에 그쳐 장면 스킵 규칙(절감 8% 미만이면 JPG 유지)에 걸리는 장면이 늘어납니다.</li>
<li>이 11개는 <b>일부러 «커지는 사례» 3곳(의릉·덕수궁·수리산성지)을 넣은 표본</b>이라 운영 전체 평균(계획 덱 q70 −16~22%)보다 절감률이 낮게 나옵니다.</li>
<li>덕수궁 돌담길 · 수리산성지는 <span class="bad">q60 에서도 커집니다(+5~6%)</span> → 어떤 품질을 고르든 이 장면들은 JPG 유지입니다.</li>
</ul>
</section>
<section>
<h2>보는 법</h2>
<ul>
<li>💡 WebP 칸을 <b>누르고 있으면(마우스를 올리면)</b> 같은 자리의 JPG 원본으로 바뀝니다. 위쪽 바에서 확대(1~3×)와 칸 크기를 고를 수 있습니다.</li>
<li>장면마다 <b>q60 기준으로 «가장 많이 달라진 곳» 3곳</b>을 자동으로 골랐습니다(64×64 픽셀 블록 단위). 같은 자리를 q70 · q75 에서도 그대로 보여 줍니다.
 <ul>
 <li><b>① 질감 손실 최대</b> — 밝기 SSIM 이 가장 낮은 곳. 대부분 <b>어두운 면의 노이즈 입자가 매끈해진 곳</b>이라 숫자에 비해 눈에는 잘 안 띕니다.</li>
 <li><b>② 색 오차 최대</b> — RGB 평균 오차가 가장 큰 곳. 채도 높은 잎·조명·간판에서 잘 나옵니다.</li>
 <li><b>③ 경계 뭉개짐 최대</b> — 원본에서 <b>글자·윤곽 같은 뚜렷한 경계</b>가 있는 픽셀만 따져 오차가 가장 큰 곳. <b>사람 눈에 가장 잘 보이는 차이</b>입니다.</li>
 </ul></li>
<li>각 칸은 <b>원본 타일 파일(JPG · WebP)을 그대로</b> 불러와 브라우저가 디코딩합니다. 다시 저장하지 않으므로 관람자가 받게 될 픽셀과 같습니다.</li>
<li><b>확대 배율의 의미</b> — 레거시 뷰어는 <code>maxpixelzoom="3.0"</code> 이라 최고 해상도 <b>l1</b> 타일은 끝까지 확대하면 <b>3×</b> 까지 보입니다. <b>l2 · l3</b> 타일은 확대하면 더 세밀한 레벨로 바뀌므로 화면에서는 대략 <b>1× 근처</b>로만 보입니다.</li>
</ul>
</section>
<div id="scenes" style="display:flex;flex-direction:column;gap:18px"></div>
<section id="verdict">
<h2>판정표 <small>장면마다 «q60 으로 괜찮은가» 를 골라 두면 이 브라우저에 저장됩니다 (다른 사람과 공유되지 않음)</small></h2>
<div class="tw"><table id="verdicts"></table></div>
<div class="note" id="vsum" style="margin-top:10px"></div>
</section>
<section id="log">
<h2>작업 내역</h2>
<table id="logt">
<tr><th class="l">항목</th><th class="l">내용</th></tr>
<tr><td>원본</td><td class="l"><code>NAS /Default/Share/webp-test-20261119/webp-test-panoramas.zip</code> (230MB · 파일 6,010개 · 장면 11개, S3 <code>look360-v1-files</code> 장면 폴더 그대로) — <b>원본 zip 은 건드리지 않았습니다</b></td></tr>
<tr><td>변환 대상</td><td class="l"><code>mres_[fblrud]/l1~l3/…jpg</code> 큐브 타일만 · 장면당 504장(l1 8×8 · l2 4×4 · l3 2×2 × 6면) · 합계 5,544장 · <code>512_</code> · <code>1024_</code> · <code>pv.jpg</code> · 썸네일·GIF 는 계획 덱 범위대로 제외</td></tr>
<tr><td>변환 설정</td><td class="l">Pillow 13.0.0 (libwebp 1.6.0) · <code>quality=60 / 70 / 75</code> · <code>method=6</code> · 무손실 끔 — 계획 덱 «적용할 설정» 그대로. 장면별 q70 절감률이 <code>목록.txt</code> 에 적힌 값과 소수 첫째 자리까지 일치(같은 방식 확인)</td></tr>
<tr><td>측정</td><td class="l">타일마다 용량 · 밝기 SSIM(가우시안 11×11, σ1.5 — 계획 덱과 같은 방식) · 64×64 블록(32px 간격) 단위로 SSIM 최저 / RGB 오차 최대 / 경계(밝기 기울기 &gt; 24) 위 오차 최대 위치</td></tr>
<tr><td>작업 폴더 (전부 한 곳)</td><td class="l"><code>kabkee-main:/home/kabkee/webp-test-20261119/</code><br>
<code>src/</code> zip 압축 해제본 248MB · <code>out/q60|q70|q75/</code> 변환 결과(폴더 구조 그대로, 확장자만 .webp) 169 · 187 · 197MB · <code>metrics/</code> 타일별 측정값 <code>tiles.csv</code>(16,632행) · 장면 요약 <code>summary.json</code> · <code>compare/sheets/</code> 검토용 확대 이미지 33장 · <code>scripts/</code> 아래 4개</td></tr>
<tr><td>스크립트</td><td class="l"><code>convert.py</code> 변환+측정(20코어 약 2분 30초) → <code>summarize.py</code> 장면 요약·최악 영역 선정 → <code>contact_sheet.py</code> 확대 시트 → <code>build_page.py</code> 이 페이지 생성<br>다시 돌리기: <code>cd /home/kabkee/webp-test-20261119 && python3 -P scripts/convert.py . && python3 -P scripts/summarize.py . && python3 -P scripts/build_page.py . ~/side-projects/kabkee-decks</code></td></tr>
<tr><td>이 페이지의 파일</td><td class="l"><code>reports/2026-11-23-webp-q-compare.html</code> + <code>reports/assets/2026-11-23-webp-q-compare/</code> (장면 11개 × 3곳 × JPG·q60·q70·q75 원본 타일)</td></tr>
<tr><td>사본 보관</td><td class="l">작업 폴더를 지워도 남도록 스크립트 4개 · <code>summary.json</code> · <code>목록.txt</code> 를 kabkee-decks 저장소 <code>reports/2026-11-23-webp-q-compare-work/</code> 에 함께 커밋했습니다(웹에는 올라가지 않음). 타일별 측정값 <code>tiles.csv</code> 는 작업 폴더에만 있습니다</td></tr>
<tr><td>정리 방법</td><td class="l">테스트가 끝나면 작업 폴더 하나만 지우면 됩니다: <code>rm -rf /home/kabkee/webp-test-20261119</code> — S3 · 운영 서버 · DB · Look360 저장소는 <b>아무것도 바꾸지 않았습니다</b></td></tr>
<tr><td>하지 않은 것</td><td class="l">뷰어(krpano)에서 장면 전체를 띄워 본 비교 · 기기별(iOS · 안드로이드 · 인앱) 확인 — 계획 덱의 시범 검증 단계에서 할 일입니다</td></tr>
</table>
</section>
</main>
<script>
const D = __DATA__;
const QS = ['60','70','75'];
const FACE = {f:'앞',b:'뒤',l:'왼쪽',r:'오른쪽',u:'위',d:'아래'};
const LV = {l1:'l1 (최고 해상도 · 최대 3× 까지 확대됨)', l2:'l2 (중간 · 화면에선 약 1×)', l3:'l3 (가장 낮음 · 멀리 볼 때 · 약 1×)'};
const KIND = {ssim:'① 질감 손실 최대 (SSIM 최저)', err:'② 색 오차 최대', edge:'③ 경계 뭉개짐 최대 (글자·윤곽)'};
const kb = b => (b/1024).toFixed(1)+'KB', mb = b => (b/1048576).toFixed(1)+'MB';
const pc = v => (v>0?'+':'')+v.toFixed(1)+'%';
const cls = v => v > D.skip ? 'bad' : 'good';
let Z = 2, S = 256;

// KPI
const t = D.total;
document.getElementById('kpis').innerHTML = [
  [pc(t['60'].all_pct), 'q60 · 11개 장면 전부 변환 시 (JPG '+mb(D.jpg_total)+' 대비)'],
  [pc(t['70'].all_pct), 'q70 · 전부 변환 시'],
  [pc(t['75'].all_pct), 'q75 · 전부 변환 시 — 오히려 커짐'],
  [pc(t['60'].ruled_pct)+' / '+pc(t['70'].ruled_pct), 'q60 / q70 · 스킵 규칙 적용 후 (JPG 유지 '+t['60'].skip.length+' / '+t['70'].skip.length+'곳)'],
].map(([b,s])=>`<div class="kpi"><b>${b}</b><span>${s}</span></div>`).join('');

// 요약표
let h = `<div class="swipe">← 표를 옆으로 밀어 q70 · q75 를 볼 수 있습니다</div><div class="tw"><table><tr><th class="l">장면</th><th>JPG</th>${QS.map(q=>`<th>q${q} 변화</th><th>q${q} SSIM</th><th>q${q} 커진 타일</th>`).join('')}</tr>`;
for (const s of D.scenes) {
  h += `<tr><td><a href="#${s.slug}">${s.name}</a> <span class="mute">${s.scene.replace('pano/','')}</span></td><td>${mb(s.jpg)}</td>` +
    QS.map(q=>{const x=s.stat[q];return `<td class="${cls(x.change_pct)}">${pc(x.change_pct)}</td><td>${x.ssim_mean.toFixed(3)}</td><td class="${x.grown>250?'bad':x.grown>50?'amber':''}">${x.grown}/504</td>`}).join('') + '</tr>';
}
h += `<tr><th class="l">합계 · 전부 변환</th><th>${mb(D.jpg_total)}</th>${QS.map(q=>`<th class="${cls(t[q].all_pct)}">${pc(t[q].all_pct)}</th><th></th><th>${t[q].grown}</th>`).join('')}</tr>`;
h += `<tr><th class="l">합계 · 스킵 규칙 적용<br><span class="mute" style="font-weight:400">장면 절감 8% 미만은 JPG 유지</span></th><th></th>${QS.map(q=>`<th class="${cls(t[q].ruled_pct)}">${pc(t[q].ruled_pct)}</th><th colspan="2" class="l" style="font-weight:400;white-space:normal;font-size:.9em">JPG 유지 ${t[q].skip.length}곳</th>`).join('')}</tr></table></div>`;
h += `<div class="mute" style="font-size:.8em;margin-top:6px">초록 = 스킵 규칙 통과(8% 이상 절감) · 빨강 = JPG 유지 대상 · SSIM 은 지금 JPG 대비(1 = 동일) 타일 평균</div>`;
document.getElementById('sumtable').innerHTML = h;

// 장면
const box = document.getElementById('scenes');
for (const s of D.scenes) {
  const sec = document.createElement('section'); sec.id = s.slug;
  let x = `<div class="scene-h"><h3>${s.name}<span class="tag">${s.group}</span></h3><span class="p"><code>${s.scene}</code> · ${s.note}</span></div>`;
  x += `<div class="tw"><table class="mini"><tr><th class="l">타일 504장</th>${QS.map(q=>`<th>q${q}</th>`).join('')}</tr>
   <tr><td>용량 (JPG ${mb(s.jpg)})</td>${QS.map(q=>`<td>${mb(s.stat[q].webp_bytes)} <span class="${cls(s.stat[q].change_pct)}">${pc(s.stat[q].change_pct)}</span></td>`).join('')}</tr>
   <tr><td>SSIM 평균 / 하위 5%</td>${QS.map(q=>`<td>${s.stat[q].ssim_mean.toFixed(3)} / ${s.stat[q].ssim_p5.toFixed(3)}</td>`).join('')}</tr>
   <tr><td>JPG 보다 커진 타일</td>${QS.map(q=>`<td>${s.stat[q].grown}</td>`).join('')}</tr>
   <tr><td>스킵 규칙 (8%)</td>${QS.map(q=>s.stat[q].change_pct > D.skip ? `<td class="bad">JPG 유지</td>` : `<td class="good">WebP 전환</td>`).join('')}</tr></table></div>`;
  for (const g of s.regions) {
    const dir = `assets/2026-11-23-webp-q-compare/${s.slug}/`;
    x += `<div class="region" data-w="${g.w}" data-h="${g.h}" data-cx="${g.x+32}" data-cy="${g.y+32}">
     <div class="rh"><b>${KIND[g.kind]}</b> · ${FACE[g.face]} 면 · ${LV[g.level]} · 타일 <code>${g.base}</code> (x ${g.x}~${g.x+64}, y ${g.y}~${g.y+64})</div>
     <div class="row"><div class="ov"><div class="box"><img src="${dir}${g.base}.jpg" loading="lazy"><div class="rect"></div></div><span>타일 전체 · 빨간 상자 = 확대 범위</span></div>
     ${[['jpg','JPG 원본',g.base+'.jpg',g.jpg_bytes,null]].concat(QS.map(q=>['q'+q,'WebP q'+q,`${g.base}.q${q}.webp`,g.per_q[q].webp_bytes,g.per_q[q]])).map(([c,l,f,b,pq])=>
       `<div class="pn ${c}"><div class="lab"><b>${l}</b><span>${kb(b)}${pq?` · <span class="${b>g.jpg_bytes?'bad':'good'}">${pc((b/g.jpg_bytes-1)*100)}</span> · SSIM ${pq.ssim.toFixed(3)}`:''}</span></div>
        <div class="v" ${c!=='jpg'?`data-jpg="${dir}${g.base}.jpg" data-own="${dir}${f}"`:''}><img src="${dir}${f}" loading="lazy" draggable="false"><span class="peek">JPG 원본</span></div></div>`).join('')}
     </div></div>`;
  }
  sec.innerHTML = x; box.appendChild(sec);
}

function layout() {
  document.body.style.setProperty('--s', S + 'px');
  document.querySelectorAll('.region').forEach(r => {
    const w=+r.dataset.w, h=+r.dataset.h, cx=+r.dataset.cx, cy=+r.dataset.cy;
    const vs = r.querySelectorAll('.pn .v');
    const pw = vs[0].clientWidth || S;           // 실제 칸 폭(화면이 좁으면 S 보다 작아진다)
    const src = pw / Z;                           // 칸에 들어가는 원본 픽셀 범위
    const x0 = Math.max(0, Math.min(w - src, cx - src/2)), y0 = Math.max(0, Math.min(h - src, cy - src/2));
    vs.forEach(v => {
      const im = v.querySelector('img');
      im.style.width = (w*Z)+'px'; im.style.height = (h*Z)+'px';
      im.style.left = (-x0*Z)+'px'; im.style.top = (-y0*Z)+'px';
    });
    const ob = r.querySelector('.ov .box'), rect = r.querySelector('.rect');
    const kx = ob.clientWidth / w, ky = ob.clientHeight / h;
    Object.assign(rect.style, {left:(x0*kx)+'px', top:(y0*ky)+'px', width:(Math.min(src,w)*kx)+'px', height:(Math.min(src,h)*ky)+'px'});
  });
}
layout();
let raf = 0;
addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); });
document.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { Z=+b.dataset.z; document.querySelectorAll('[data-z]').forEach(o=>o.classList.toggle('on',o===b)); layout(); });
document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { S=+b.dataset.s; document.querySelectorAll('[data-s]').forEach(o=>o.classList.toggle('on',o===b)); layout(); });
// 누르고 있거나 마우스를 올리면 JPG 로
document.querySelectorAll('.pn .v[data-jpg]').forEach(v => {
  const im = v.querySelector('img');
  const on = () => { im.src = v.dataset.jpg; v.classList.add('peeking'); };
  const off = () => { im.src = v.dataset.own; v.classList.remove('peeking'); };
  v.addEventListener('pointerenter', on); v.addEventListener('pointerleave', off);
  v.addEventListener('contextmenu', e => e.preventDefault());
  v.addEventListener('pointerdown', on); v.addEventListener('pointerup', off); v.addEventListener('pointercancel', off);
});

// 판정표 (localStorage)
const KEY = 'webp-q-compare-2026-11-23';
const V = JSON.parse(localStorage.getItem(KEY) || '{}');
const OPTS = [['ok60','q60 괜찮음'],['need70','q70 필요'],['need75','q75 필요'],['jpg','JPG 유지']];
function renderVerdict() {
  let r = `<tr><th>장면</th><th>q60 변화</th><th>q70 변화</th><th>판정</th></tr>`;
  for (const s of D.scenes) {
    r += `<tr><td><a href="#${s.slug}">${s.name}</a></td><td class="${cls(s.stat['60'].change_pct)}">${pc(s.stat['60'].change_pct)}</td><td class="${cls(s.stat['70'].change_pct)}">${pc(s.stat['70'].change_pct)}</td>
      <td><div class="pick" style="margin:0">${OPTS.map(([k,l])=>`<button data-sc="${s.slug}" data-v="${k}" class="${V[s.slug]===k?'on':''}">${l}</button>`).join('')}</div></td></tr>`;
  }
  document.getElementById('verdicts').innerHTML = r;
  const cnt = k => Object.values(V).filter(v=>v===k).length, n = Object.keys(V).length;
  document.getElementById('vsum').innerHTML = n ? `판정 ${n}/11 · q60 괜찮음 <b>${cnt('ok60')}</b> · q70 필요 <b>${cnt('need70')}</b> · q75 필요 <b>${cnt('need75')}</b> · JPG 유지 <b>${cnt('jpg')}</b>` +
    (cnt('need70')+cnt('need75') ? ` → <b class="amber">q70 이상이 필요한 장면이 있어 «일괄 q70» 기준에 해당</b>` : n===11 ? ` → <b class="good">전부 q60 으로 충분 — «일괄 q60» 가능</b>` : '') : '아직 판정 없음 — 위 비교를 보고 장면마다 골라 주세요.';
  document.querySelectorAll('#verdicts [data-sc]').forEach(b => b.onclick = () => { V[b.dataset.sc] = b.dataset.v; localStorage.setItem(KEY, JSON.stringify(V)); renderVerdict(); });
}
renderVerdict();
</script>
</body></html>
"""
page.write_text(html.replace("__DATA__", DATA), encoding="utf-8")
n = sum(1 for _ in assets.rglob("*"))
size = sum(p.stat().st_size for p in assets.rglob("*") if p.is_file())
print(f"✅ {page}\n   assets {n}개 · {size/1e6:.1f}MB")
for q in QS:
    print(q, tot[q])
