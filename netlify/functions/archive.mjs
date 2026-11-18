// 덱 아카이브 API — GET /api/archive 보관 목록, POST /api/archive {id, archived} 보관·꺼내기.
// 저장: Netlify Blobs "deck-archive" 스토어, 키 = encodeURIComponent(<카드 href>) (덱 1개 = 키 1개라 동시 변경에도 덮어쓰기 없음).
// 보관(archived:true) = 키 생성, 꺼내기(archived:false) = 키 삭제. 덱 파일 자체는 건드리지 않는다.
// 화면: index.html 이 이 목록을 읽어 메인·전체 목록에서 빼고 #/archive 에서만 보여 준다.
// 보안: 로그인 없는 공개 입력이다(코멘트 API 와 같은 수준). 바꿀 수 있는 것은 «목록에 보일지» 뿐이고
//       언제든 꺼낼 수 있다. id 형식을 제한하고(ID_RE) 저장 개수를 MAX_ITEMS 로 막는다.
import { getStore } from "@netlify/blobs";

// 카드 href 형식만 받는다 — 상대 경로(weekly-reports/2026-11-16.html · reports/…/) 또는 외부 https 링크
const ID_RE = /^(?:[A-Za-z0-9][A-Za-z0-9._~\/-]{0,250}|https:\/\/[A-Za-z0-9.-]{1,100}\/[A-Za-z0-9._~\/?#=&%:+-]{0,250})$/;
// 로컬 열람 주소(tailnet 정적 서버 :8088)에서도 같은 저장소에 쓰도록 이 출처만 CORS 허용
const ORIGINS = new Set(["http://100.64.25.50:8088", "http://kabkee-main.tailfe017f.ts.net:8088"]);
const MAX_ITEMS = 2000;
let cors = {};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors } });

export default async (req) => {
  const store = getStore({ name: "deck-archive", consistency: "strong" });
  const origin = req.headers.get("origin") || "";
  cors = ORIGINS.has(origin) ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" } : {};
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const ids = blobs.map((b) => { try { return decodeURIComponent(b.key); } catch { return null; } }).filter(Boolean);
    return json({ ids });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "JSON 본문이 필요합니다" }, 400); }
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!ID_RE.test(id)) return json({ error: "id 형식이 올바르지 않습니다" }, 400);
    if (typeof body.archived !== "boolean") return json({ error: "archived(true/false) 가 필요합니다" }, 400);
    const key = encodeURIComponent(id);
    if (body.archived) {
      const { blobs } = await store.list();
      if (blobs.length >= MAX_ITEMS && !blobs.some((b) => b.key === key)) return json({ error: "보관 개수가 한도에 도달했습니다" }, 429);
      await store.setJSON(key, { id, archivedAt: new Date().toISOString() });
    } else {
      await store.delete(key);
    }
    return json({ id, archived: body.archived });
  }

  return json({ error: "GET·POST·OPTIONS 만 지원합니다" }, 405);
};

export const config = { path: "/api/archive" };
