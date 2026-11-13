// 덱 검토 코멘트 API — GET /api/comments?deck=<id> 목록, POST /api/comments 등록.
// 저장: Netlify Blobs "deck-comments" 스토어, 키 = <deck>/<작성시각>-<id> (코멘트 1개 = 키 1개라 동시 작성에도 덮어쓰기 없음).
// 읽기: 브라우저는 GET, Claude 는 curl 로 같은 GET 을 읽어 수정에 반영한다.
import { getStore } from "@netlify/blobs";

const DECK_RE = /^[a-z0-9-]{1,64}$/;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const clip = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, n) : "");

export default async (req) => {
  const store = getStore({ name: "deck-comments", consistency: "strong" });
  const url = new URL(req.url);

  if (req.method === "GET") {
    const deck = url.searchParams.get("deck") || "";
    if (!DECK_RE.test(deck)) return json({ error: "deck 파라미터가 필요합니다" }, 400);
    const { blobs } = await store.list({ prefix: `${deck}/` });
    const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    return json(items.filter(Boolean).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "JSON 본문이 필요합니다" }, 400); }
    const deck = clip(body.deck, 64), text = clip(body.text, 4000);
    if (!DECK_RE.test(deck) || !text) return json({ error: "deck 과 text 가 필요합니다" }, 400);
    const comment = {
      id: crypto.randomUUID().slice(0, 8),
      deck,
      anchor: clip(body.anchor, 40),
      label: clip(body.label, 200),
      detail: clip(body.detail, 800),
      author: clip(body.author, 60) || "Anonymous",
      text,
      createdAt: new Date().toISOString(),
    };
    await store.setJSON(`${deck}/${comment.createdAt}-${comment.id}`, comment);
    return json(comment, 201);
  }

  return json({ error: "GET 또는 POST 만 지원합니다" }, 405);
};

export const config = { path: "/api/comments" };
