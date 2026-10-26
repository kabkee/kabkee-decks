#!/usr/bin/env python3
"""요청 원장 ② 조립 — 캐시(paperclip) + 실버불릿(요청 아카이브·must-include) + 주간회의 덱 → out/ledger.json

  python3 scripts/ledger/build.py

요청 1건 = EPIC 1건. 요청 → 발주 → 구현 → QC → 오너 확인 → 회의 보고를 «이벤트 타임라인»으로 쌓는다.
재작업·재오픈·방향 변경·취소 후 재발주는 단계를 덮어쓰지 않고 이벤트로 남겨서, 같은 요청이 몇 번 왕복했는지 보이게 한다.
단계 판정(오너 확인과 합치는 부분)은 페이지가 한다 — 오너 체크는 아티팩트 db 에 있기 때문.
"""
import glob, json, re
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".cache"
OUT = HERE / "out"
SB = Path("~/docker/silverbullet/space").expanduser()
DECKS = HERE.parent.parent / "weekly-reports"
SINCE = "2026-09-01"
OWNER_USER = "NoG0Nc9FZCBksTkkmo5k83CYjEmgQ1DT"
CEO = "3872d5e8-c90e-4337-994a-fad06f21d721"
UI = "https://kabkee-main.tailfe017f.ts.net:8443/IND/issues/"
PROJECTS = {
    "a28706d4-84da-4732-954c-c017afb666da": "l3 플랫폼",
    "35903772-0a4a-4c13-9835-84f321d3ed0d": "레거시",
    "6fd15fde-1e6e-43b9-bb7f-ad6031b65c95": "weekly(k)pop",
    "e4990667-3230-48b3-8b08-9330a2e499c0": "회사 운영",
    "dbc94f2e-3c3a-4ba0-8a70-e4eb0311af12": "360 작업실",
    "d04b4fcd-7a24-4b3d-8785-75dc5ac4b58c": "폰 360 PoC",
    "12255a7d-fbdb-481f-8885-e9bd6b63f065": "News 알리미",
}
IND_RE = re.compile(r"IND-(\d{2,5})")

issues = {i["id"]: i for i in json.loads((CACHE / "issues.json").read_text()) if not i.get("hiddenAt")}
by_ind = {i["identifier"]: i for i in issues.values()}
kids = {}
for i in issues.values():
    if i.get("parentId") in issues:
        kids.setdefault(i["parentId"], []).append(i)


def root_of(i):
    seen = set()
    while i.get("parentId") in issues and i["id"] not in seen:
        seen.add(i["id"])
        i = issues[i["parentId"]]
    return i


def tree(i):
    out, stack = [], list(kids.get(i["id"], []))
    while stack:
        c = stack.pop()
        out.append(c)
        stack.extend(kids.get(c["id"], []))
    return out


def load(kind, iid):
    f = CACHE / kind / f"{iid}.json"
    return json.loads(f.read_text()) if f.exists() else []


def clip(s, n=140):
    s = re.sub(r"\s+", " ", re.sub(r"[#*`>|]", " ", s or "")).strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def first_line(body):
    for ln in (body or "").splitlines():
        if ln.strip():
            return ln.strip()
    return ""


roots = {r["id"]: r for r in (root_of(i) for i in issues.values())
         if r.get("originKind") != "routine_execution"}
roots = {k: r for k, r in roots.items()
         if r["createdAt"] >= SINCE or any(c["createdAt"] >= SINCE for c in tree(r))}

events = {rid: [] for rid in roots}


def add(rid, t, typ, text, ref=None, src="paperclip"):
    if rid in events and t:
        events[rid].append({"t": t, "type": typ, "text": clip(text, 220), "ref": ref, "src": src})


QC_RE = re.compile(r"\bQC|재검증|독립 검증|검수")
REWORK_RE = re.compile(r"\bR[2-9]\b|-R[2-9]|R[2-9]-|[-\s\[]fix\b|FIX|재QC|재작업|재수정|되돌|수정본|재발주|반려")
FAIL_RE = re.compile(r"\bFAIL\b|불합격|미달|반려|재작업 필요|❌ ?FAIL")
PASS_RE = re.compile(r"\bPASS\b|합격|통과")


def owner_kind(text):
    fl, h = first_line(text), text[:200]
    # 보드 운영 조치(재기동·재배정·상태 되돌림)는 요청의 흐름이 아니다
    if re.search(r"재기동|재배정|blocked|backlog|todo 로|집행 —|wake|run ", fl) and not re.search(r"오너 (결정|확정|지시|추가|요청)", fl):
        return None
    if re.search(r"반려|rejected|재작업|재수정|다시 (해|만들|올려)|틀렸|안 ?된다|안 맞", h):
        return "reject"
    if re.search(r"번복|방향 ?변경|방향을|대신|대체|어느 것도 아니|되돌|바꾼다|바꿨|바꿔", h):
        return "redirect"
    if re.search(r"취소|폐기", h):
        return "cancel"
    if re.search(r"확인 「?된다|확인 완료|문제없|오너 승인|승인한다", fl):
        return "owner_ok_note"
    if re.search(r"추가", h):
        return "added"
    return "decision"


# ── paperclip: 발주 · 상태 전이 · 하위 작업 · QC · 오너 코멘트 ────────────────
for rid, r in roots.items():
    add(rid, r["createdAt"], "order", f"{r['identifier']} 발주 — {r['title']}", r["identifier"])
    was_done = False
    for a in sorted(load("activity", rid), key=lambda a: a["createdAt"]):
        ch = ((a.get("details") or {}).get("changes") or {}).get("status")
        if ch:
            if ch["to"] == "done":
                add(rid, a["createdAt"], "done", "다시 완료 처리" if was_done else "EPIC 완료 처리")
                was_done = True
            elif ch["from"] == "done":
                add(rid, a["createdAt"], "reopen", f"완료 후 다시 열림 ({ch['to']})")
            elif ch["to"] == "cancelled":
                add(rid, a["createdAt"], "cancel", "EPIC 취소")
        if a["action"] in ("issue.thread_interaction_answered", "issue.thread_interaction_accepted") \
                and a["actorType"] == "user":
            add(rid, a["createdAt"], "decision", "확인 카드에 오너 응답")
    first_close = min([c["completedAt"] for c in tree(r) if c["status"] == "done" and c.get("completedAt")] or ["9999"])
    for c in tree(r):
        tag = f"{c['identifier']} {c['title']}"
        is_qc = bool(QC_RE.search(c["title"]))
        if REWORK_RE.search(c["title"]) and c["createdAt"] > first_close:
            add(rid, c["createdAt"], "rework", f"재작업 발주 — {tag}", c["identifier"])
        if c["status"] == "done" and c.get("completedAt"):
            if is_qc:
                tail = " ".join(x["body"][:1500] for x in load("comments", c["id"])[-3:])
                verdict = "fail" if FAIL_RE.search(tail) and not PASS_RE.search(tail[-600:]) else "pass"
                add(rid, c["completedAt"], "qc_fail" if verdict == "fail" else "qc", f"QC {'FAIL' if verdict == 'fail' else '완료'} — {tag}", c["identifier"])
            else:
                add(rid, c["completedAt"], "work", f"작업 완료 — {tag}", c["identifier"])
        if c["status"] == "cancelled":
            add(rid, c.get("cancelledAt") or c["updatedAt"], "child_cancel", f"하위 취소 — {tag}", c["identifier"])
    # 오너 쪽 코멘트 — 사람이 쓴 것 + 오너 세션(board 토큰) 이 「오너 …」 헤딩으로 남긴 것
    for node in [r] + tree(r):
        for x in load("comments", node["id"]):
            # 오너 세션 = board 토큰(authorType user) 또는 run 밖에서 쓴 agent 토큰 — 에이전트 run 코멘트는 제외
            if x["authorType"] == "user" or (x["authorType"] == "agent" and not x.get("createdByRunId")):
                k = owner_kind(x["body"])
                if k:
                    add(rid, x["createdAt"], k, f"{node['identifier']} · {clip(x['body'], 200)}", node["identifier"])

# ── 체인: 후속·대체·재발주 (다른 EPIC 본문이 앞선 EPIC 을 가리킴) ───────────────
LINK_RE = re.compile(r"(후속|대체|재발주|이어서|통합|번복|되돌|다시|이관|승계|대신)")
chain_prev, chain_next = {}, {}
root_by_ind = {r["identifier"]: rid for rid, r in roots.items()}
for rid, r in roots.items():
    desc = (r.get("description") or "")[:2500]
    for m in IND_RE.finditer(desc):
        ind = f"IND-{m.group(1)}"
        other = root_by_ind.get(ind)
        if not other or other == rid or roots[other]["createdAt"] >= r["createdAt"]:
            continue
        ctx = desc[max(0, m.start() - 60): m.end() + 60]
        if LINK_RE.search(ctx):
            chain_prev.setdefault(rid, set()).add(ind)
            chain_next.setdefault(other, set()).add(r["identifier"])
            add(other, r["createdAt"], "follow", f"후속·재발주 → {r['identifier']} {r['title']}", r["identifier"])


def rid_for(ind):
    i = by_ind.get(ind)
    if not i:
        return None
    rr = root_of(i)["id"]
    return rr if rr in roots else None


# ── 실버불릿: 요청 아카이브 (요청 접수 · 오너 확정 · 폐기) ─────────────────────
request_src = {}
for f in sorted(glob.glob(str(SB / "paperclip_works/archive/2026-*.md"))):
    day = Path(f).stem
    txt = Path(f).read_text()
    meeting = "주간회의" in txt[:600]
    t = f"{day}T00:00:00.000Z"
    for ln in txt.splitlines():
        inds = list(dict.fromkeys(f"IND-{n}" for n in IND_RE.findall(ln)))
        if not inds:
            continue
        head = ln.lstrip()
        for ind in inds[:3]:
            rid = rid_for(ind)
            if not rid:
                continue
            if head.startswith("| [IND") and head.find(ind) < 20:
                typ, label = "request", ("주간회의 결과로 요청" if meeting else "요청 접수")
                request_src.setdefault(rid, {"day": day, "text": clip(ln, 300)})
            elif re.search(r"폐기|취소", ln):
                typ, label = "cancel", "아카이브 기록 — 폐기·취소"
            elif re.search(r"통합|대체|번복|되돌", ln):
                typ, label = "redirect", "아카이브 기록 — 방향 변경"
            elif re.search(r"확정|결정|답함|answered|rejected", ln):
                typ, label = "decision", "아카이브 기록 — 오너 결정"
            else:
                continue
            add(rid, t, typ, f"{label}: {clip(ln, 200)}", ind, src=f"archive/{day}")

# ── 실버불릿: must-include (회의 자료 지정 · 오너 확인 완료) ─────────────────────
mi_files = [(SB / "claude_works/rules/weekly-report-must-include.md", None)] + \
           [(Path(p), Path(p).stem) for p in sorted(glob.glob(str(SB / "claude_works/rules/weekly-report-must-include.archive/*.md")))]
owner_ok_auto = {}
for f, day in mi_files:
    txt = f.read_text()
    for ln in txt.splitlines():
        if not ln.startswith("- ") or "IND-" not in ln:
            continue
        rid = rid_for(f"IND-{IND_RE.search(ln).group(1)}")
        if not rid:
            continue
        m = re.search(r"오너 확인 완료\((\d{4}-\d{2}-\d{2})\)", ln)
        if m:
            add(rid, f"{m.group(1)}T12:00:00.000Z", "owner_ok", f"오너 확인 완료 (must-include 기록)", src="must-include")
            owner_ok_auto[rid] = m.group(1)
        if day:
            add(rid, f"{day}T00:00:00.000Z", "agenda_set", f"회의 필수 항목 지정: {clip(ln, 160)}", src=f"must-include/{day}")

# ── 주간회의 덱: 보고 · 안건 ────────────────────────────────────────────────
def words(s):
    return {w for w in re.findall(r"[가-힣A-Za-z0-9]{2,}", s) if w not in {"EPIC", "IND", "client", "api", "admin", "BE", "FE"}}


decks = sorted(f for f in DECKS.glob("2026-*.md") if f.stem >= "2026-08-26")
for k, f in enumerate(decks):
    day = f.stem
    slides = f.read_text().split("\n---\n")
    titles = []
    any_ind = False
    for slide in slides:
        title = clip(re.sub(r"<[^>]+>", " ", next((ln[3:] for ln in slide.splitlines() if ln.startswith("## ")), "")), 120)
        titles.append((title, words(re.sub(r"<[^>]+>", " ", slide))))
        agenda = bool(re.search(r"회의 안건|결정 대기|안건|결정할", title))
        seen = set()
        for n in IND_RE.findall(slide):
            any_ind = True
            rid = rid_for(f"IND-{n}")
            if not rid or rid in seen:
                continue
            seen.add(rid)
            add(rid, f"{day}T09:00:00.000Z", "agenda" if agenda else "report",
                f"{'회의 안건' if agenda else '회의 보고'} — {title}", src=f"deck/{day}")
    if any_ind:
        continue
    # IND 번호를 안 쓴 덱(09-09 · 09-15) — 그 회의 기간에 완료된 EPIC 을 «보고 추정»으로만 잇는다 (오너 확인 대상)
    lo = decks[k - 1].stem if k else "2026-08-26"
    for rid, r in roots.items():
        done_at = (r.get("completedAt") or "")[:10]
        if not (lo < done_at <= day):
            continue
        w = words(r["title"])
        best = max(titles, key=lambda t: len(w & t[1]))
        hit = len(w & best[1]) >= 3
        add(rid, f"{day}T09:00:00.000Z", "report_guess" if hit else "report_maybe",
            f"{'회의 보고 추정 — 슬라이드 「' + best[0] + '」' if hit else '이 회의 기간에 완료 — 덱에서 못 찾음'} (IND 번호 없는 덱)",
            src=f"deck/{day}")

# ── 조립 ────────────────────────────────────────────────────────────────────
MATERIAL = {"done", "reopen", "rework", "reject", "redirect", "qc_fail", "added", "follow", "cancel"}
rows = []
for rid, r in roots.items():
    ev = sorted({(e["t"], e["type"], e["text"]): e for e in events[rid]}.values(), key=lambda e: e["t"])
    t_all = tree(r)
    impl = [c for c in t_all if not QC_RE.search(c["title"])]
    qcs = [c for c in t_all if QC_RE.search(c["title"])]
    loops = sum(1 for e in ev if e["type"] in ("reopen", "rework", "reject", "redirect", "qc_fail", "follow"))
    last_change = max([e["t"] for e in ev if e["type"] in MATERIAL] or [r["createdAt"]])
    req_text = ""
    m = re.search(r"요청 원문[^\n]*\n+([\s\S]{0,900})", r.get("description") or "")
    if m:
        req_text = clip(m.group(1), 600)
    creator = r.get("createdByAgentId")
    origin = ("request" if rid in request_src else
              "owner" if not creator else
              "chat" if creator == CEO else "derived")
    rows.append({
        "id": r["identifier"], "url": UI + r["identifier"], "title": r["title"],
        "project": PROJECTS.get(r.get("projectId"), "기타"), "status": r["status"],
        "priority": r.get("priority"), "origin": origin,
        "requestedAt": (request_src.get(rid, {}).get("day") + "T00:00:00.000Z") if rid in request_src else r["createdAt"],
        "createdAt": r["createdAt"], "completedAt": r.get("completedAt"),
        "requestLine": request_src.get(rid, {}).get("text", ""), "requestText": req_text,
        "kids": {"total": len(t_all), "implDone": sum(c["status"] == "done" for c in impl), "impl": len(impl),
                 "qc": len(qcs), "qcDone": sum(c["status"] == "done" for c in qcs),
                 "qcFail": sum(e["type"] == "qc_fail" for e in ev)},
        "loops": loops, "lastChangeAt": last_change,
        "prev": sorted(chain_prev.get(rid, [])), "next": sorted(chain_next.get(rid, [])),
        "events": ev,
    })

rows.sort(key=lambda x: x["requestedAt"], reverse=True)
OUT.mkdir(exist_ok=True)
meta = {"builtAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "since": SINCE, "count": len(rows),
        "sources": ["paperclip 이슈·이력·코멘트", "실버불릿 paperclip_works/archive", "실버불릿 must-include(+archive)",
                    "kabkee-decks weekly-reports"]}
(OUT / "ledger.json").write_text(json.dumps({"meta": meta, "rows": rows}, ensure_ascii=False, separators=(",", ":")))
print(f"{len(rows)}건 · {(OUT / 'ledger.json').stat().st_size // 1024}KB")
