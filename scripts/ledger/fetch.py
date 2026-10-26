#!/usr/bin/env python3
"""요청 원장 ① 수집 — paperclip 이슈·이력·코멘트를 로컬 캐시로 받는다.

  python3 scripts/ledger/fetch.py            # 2026-09-01 이후 EPIC 트리
  python3 scripts/ledger/fetch.py --since 2026-10-01

캐시: scripts/ledger/.cache/ (git 제외) — issues.json · activity/<id>.json · comments/<id>.json
이력·코멘트는 updatedAt 이 바뀐 이슈만 다시 받는다.
"""
import argparse, json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

API = "http://100.64.25.50:3100/api"
CID = "5050c349-0ac6-4289-a8a3-9eba34df1ce3"
CACHE = Path(__file__).resolve().parent / ".cache"
TOKEN = Path("~/.config/paperclip-board-token").expanduser().read_text().strip()


def get(path):
    req = urllib.request.Request(API + path, headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="2026-09-01")
    a = ap.parse_args()
    (CACHE / "activity").mkdir(parents=True, exist_ok=True)
    (CACHE / "comments").mkdir(parents=True, exist_ok=True)

    issues, off = {}, 0
    while True:  # 목록 API 상한 limit=1000 — offset 페이징
        page = get(f"/companies/{CID}/issues?limit=1000&offset={off}")
        for i in page:
            issues[i["id"]] = i
        if len(page) < 1000:
            break
        off += 1000
    print(f"이슈 {len(issues)}건", file=sys.stderr)

    def root(i):
        seen = set()
        while i.get("parentId") and i["parentId"] in issues and i["id"] not in seen:
            seen.add(i["id"])
            i = issues[i["parentId"]]
        return i

    # 대상 = since 이후 생성된 EPIC 트리 + since 이후 손댄(하위 생성) 옛 EPIC 트리
    roots = set()
    for i in issues.values():
        r = root(i)
        if r.get("originKind") == "routine_execution":
            continue
        if r["createdAt"] >= a.since or i["createdAt"] >= a.since:
            roots.add(r["id"])
    target = [i for i in issues.values() if root(i)["id"] in roots]
    print(f"EPIC {len(roots)} · 트리 이슈 {len(target)}", file=sys.stderr)

    old = {}
    if (CACHE / "issues.json").exists():
        old = {i["id"]: i.get("updatedAt") for i in json.loads((CACHE / "issues.json").read_text())}

    def pull(i):
        stale = old.get(i["id"]) != i.get("updatedAt")
        for kind in ("activity", "comments"):
            f = CACHE / kind / f"{i['id']}.json"
            if f.exists() and not stale:
                continue
            try:
                f.write_text(json.dumps(get(f"/issues/{i['id']}/{kind}"), ensure_ascii=False))
            except Exception as e:
                print(f"  ! {i['identifier']} {kind}: {e}", file=sys.stderr)

    with ThreadPoolExecutor(16) as ex:
        list(ex.map(pull, target))

    (CACHE / "issues.json").write_text(json.dumps(target, ensure_ascii=False))
    (CACHE / "all_issues_index.json").write_text(json.dumps(
        {i["identifier"]: {"id": i["id"], "title": i["title"], "status": i["status"], "parentId": i.get("parentId")}
         for i in issues.values()}, ensure_ascii=False))
    print("완료", file=sys.stderr)


if __name__ == "__main__":
    main()
