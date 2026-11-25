---
marp: true
theme: clean
paginate: true
title: 번역 오역 조사 — 무엇을 고쳤고 무엇이 남았나 (IND-9870)
---

<!-- _class: cover -->
<!-- _paginate: false -->

# 번역 오역 조사

## 「법정동」이 `courts`, 「함라면」이 `Ham ramen` 으로 나가 있습니다

<hr>

Indyspot AI Corp &nbsp;·&nbsp; 2026-11-25 &nbsp;·&nbsp; IND-9870 &nbsp;·&nbsp; https://kabkee-decks.netlify.app/reports/translation-issues

---

<!-- _class: agenda -->

## 요약 — 표기 문제만 고쳤고 <span class="hl-red">오역 번역문은 한 글자도 바꾸지 않았습니다</span>

<div class="cols">
<div class="col">

### ✅ 고친 것 (표기 복원)
- 꺾쇠 한글 escape **66개 필드** — 화면에서 사라지던 문장을 살렸습니다
- 한자 병기 복원 **113곳** — `Anyang ()` → `Anyang (安養)`

### 🚫 안 한 것
- **오역 수정 0건** — 처리 방향을 정한 뒤 집행합니다
- 태그 위치·구두점 819건 (내용은 읽힙니다)
- 지명 오역 64칸 (테이블이 달라 별도 판단 필요)

</div>
<div class="col">

### 🔑 찾은 것
- 장소 소개문 **606건** / 장소 98곳 (행당 5.3건)
- 지명 **64칸** / 노드 8개 (표본 16개 중 8개가 오역)
- <span class="hl-red">유료·사람 번역에도 오역이 있습니다</span>

### 🔲 정할 것
- **검사 범위** — 어느 테이블까지?
- 재개·모델 등급 · 수정 범위 · 유료분 처리
- <span class="hl-red">재마이그 방어</span> — 안 하면 고친 것도 사라집니다

</div>
</div>

---

## 🔖 오역의 범위 — 전체 번역 자산 중 본 것은 일부입니다 <span class="badge-new">NEW</span>

| 테이블 | 무엇의 번역 | 행 | 본문 문자 | 검사 |
|---|---|---:|---:|---|
| `…pano_hotspot_auto_i18n` | 장면 핫스팟 이름 | 366,000 | 546만 | ❌ |
| `l3_bbs_data_i18n` | 게시판 글 | 1,152 | 287만 | ❌ |
| **`l3_place_i18n`** | **장소 소개문** | 1,777 | 137만 | ✅ 부분 |
| `l3_vr_content_i18n` | VR 콘텐츠 | 4,222 | 78만 | ❌ |
| **`l3_areas_i18n`** | **지명** | 72,455 | 57만 | ⚠️ 표본 |
| `l3_view360_pano_auto_i18n` | 장면 이름 | 9,356 | 16만 | ❌ |
| 그 외 12개 | 분류·지도·파노라마 등 | 20,332 | 39만 | ❌ |
| **합계** | | **475,294** | **약 1,160만 자** | |

🔑 `*_auto_i18n` 접미 5개(약 38만 행)는 **전량 자동 번역**입니다 — 장소 소개문과 같은 파이프라인일 가능성이 높습니다.

---

## 🔖 검사 커버리지 — 두 가지로 읽힙니다

<div class="cols">
<div class="col">

### 장소 소개문
| 기준 | 값 |
|---|---|
| 모수 | 1,188행 / 112만 자 |
| 검사 | **112행 / 27만 자** |
| 행 기준 | <span class="hl-amber">9%</span> |
| 문자 기준 | <span class="hl-green">24.0%</span> |

**긴 글부터** 검사해서(`--order=body`) 행 9%인데 문자로는 24%입니다.

</div>
<div class="col">

### 지명 (KR)
| 기준 | 값 |
|---|---|
| 활성 노드 | 2,239개 |
| 1차 기계 필터 | 295개 |
| 2차 판정 | **16개** |
| 필터분 기준 | <span class="hl-red">5%</span> |

🔑 1차 필터는 `de·es·tr` 가 `en` 과 어긋나는지만 봅니다 ⇒ **`ja·zh·ru·th` 단독 오역은 애초에 안 걸립니다.**

</div>
</div>

⚠️ 긴 글에 오역이 더 많으므로, 남은 76%의 문자에서 나올 오역은 **밀도가 낮을 가능성**이 있습니다. 단순 비례 환산은 과대추정입니다.

---

## 🔖 장소 소개문 오역 — `l3_place_i18n` 606건

| 장소 | 원문 | 현재 번역 | 무엇이 틀렸나 |
|---|---|---|---|
| 노원구청 | 법정동(法定洞) | `courts` | 法**廷**(재판정)으로 읽음 |
| 노원구청 | 중계3동을 신설하였다 | `3 new buildings were established` | 지명이 <span class="hl-red">「건물 3개」</span> |
| 노원구청 | 구명(區名)을 따왔다 | `he took his life` | **救命**으로 읽어 「목숨을 가져왔다」 |
| 안산가구문화거리 | 상록(常綠)구 | `Evergreen` | 「늘푸른」으로 뜻번역 |
| 이천 하늘빛농원 | 재배(栽培) | `worshiped` | 재배(再拜)로 읽어 「절하다」 |
| 의릉 | 조선 20대 왕 경종과 계비 선의왕후 | `Queen Seon-ui, the 20th Queen` | 왕의 서수를 왕비에게 — **사실 오류** |
| 남한산성 (태국어) | 시대 : 조선 | `ยุค: การก่อสร้างเรือ` | 朝鮮을 造船으로 → 「선박 건조」 |

언어별 `us` 477 · `jp` 65 · `th` 19 · `de` 18 · `es` 17 · `ru` 10 &nbsp;·&nbsp; 많은 장소: 남한산성 64 · 푸레도기연구소 33 · 청계천 26

---

## 🔖 지명 오역 — `l3_areas_i18n` (다른 테이블입니다) <span class="badge-new">NEW</span>

행정구역 이름 자체가 틀렸습니다. **장소 소개문과 테이블이 달라 수정·방어 방법도 다릅니다.**

| 지명 | 현재 영문 | 다른 언어 | 올바른 표기 |
|---|---|---|---|
| 함라면(咸羅面) | `Ham ramen` | `火腿拉面`(zh) · `Schinken-Ramen`(de) | `Hamna-myeon` |
| 마서면(馬西面) | `If you drink` | `Wenn du trinkst`(de) | `Maseo-myeon` |
| 지평면(砥平面) | `ground plane` | `เครื่องบินภาคพื้นดิน`(th · 「지상 비행기」) | `Jipyeong-myeon` |
| 파평면(坡平面) | `waveplane` | `Wellenebene`(de) | `Papyeong-myeon` |
| 소초면(所草面) | `Socho noodles` | `Лапша «Сочо»`(ru) | `Socho-myeon` |
| 서면(西面) | `written` | `书面的`(zh) | `Seo-myeon` |

표본 **16개 노드 중 8개가 의미 오역**(64칸) · 표기 변형 28칸. 1차 필터 295개 중 16개만 판정했습니다.

---

## 🔖 유료·사람 번역에도 오역이 있습니다

「돈 들여 작업한 번역은 안전하다」가 성립하지 않았습니다. `origin='human'` 행에서 나왔습니다.

| 장소 | 원문 | 현재 번역 | 무엇이 틀렸나 |
|---|---|---|---|
| 푸레도기연구소 | **3남**인 배치봉 / 2대 배치봉 | `Bae Chihong, the third generation` | 「셋째 아들」을 「3대」로 · 2대인데 3대라 했습니다 |
| 푸레도기연구소 | 조선시대 중기 | `early 1700s` | 원문에 <span class="hl-red">없는 연도</span>를 넣었습니다 |
| 푸레도기연구소 | **평신도 지도자** | `the layman` | 「지도자」가 빠졌습니다 |

<div class="cols">
<div class="col">

### 보호 대상 규모
- 장소 소개문 **82행** (경기관광공사 62곳 등)
- VR 콘텐츠 **1,268행** (POST360 수상 수기 30행 포함)

</div>
<div class="col">

### 판별축은 `source_hash` 유무
- 🚫 `is_verified` — 두 테이블 전수 0
- 🚫 `origin` 단독 — 틀린 행이 있습니다 (POST360 수기가 `machine` 인데 최상급)

</div>
</div>

---

## 🔖 이미 고친 것 — 번역 내용이 아니라 «표기 복원» 입니다

<div class="cols">
<div class="col">

### 꺾쇠 한글 escape · 66개 필드
`<교육이념>` · `<수원 화성(華城)>` · `<출처: 네이버 지식백과>` 가 **HTML 태그로 해석돼 화면에서 사라지고** 있었습니다.

- `&lt;` `&gt;` 로 escape 해 <span class="hl-green">원문 그대로 보이게</span> 했습니다
- 한국어 원문 쪽 29개 필드 포함
- 🔴 리허설에서 위양성 49개를 걸렀습니다 — URL 에 한글이 든 정상 앵커 태그

</div>
<div class="col">

### 한자 병기 복원 · 113곳
번역에서 한자가 빠져 **빈 괄호만** 남아 있었습니다.

- `a castle ()` → `a castle (都城)`
- `Anyang ()` → `Anyang (安養)`
- `Mok ()` → `Mok (牧)` · `county ()` → `(郡)`
- 원문에 한자가 없으면 창작하지 않고 빈 괄호를 지웠습니다 (17곳)

🔑 2026-11-25 실측으로 dev DB 반영을 확인했습니다.

</div>
</div>

---

## 🔖 정할 것 — 여섯 가지

<div class="cols">
<div class="col">

### ① 검사 범위 🔑
어느 테이블까지 볼지. 장소 소개문 나머지(1,076행)만? 지명 1차 필터 295개도? `*_auto_i18n` 38만 행은?

### ② 재개·모델 등급
남은 1,076행 — Opus 5 약 **$18** / Sonnet 5.5 약 **$7**(추정). 구독이면 **사용 한도 소모**

### ③ 수정 범위
영문(477건)만? 확신 `high`(309건)만?

</div>
<div class="col">

### ④ 유료 번역분 처리
발주처(경기관광공사 등)에 알릴지, 우리가 고칠지

### ⑤ 재마이그 방어 🔴
- **A 규칙 후처리** — 꺾쇠. 멱등 함수
- **B 시드 고정** — 한자·오역. `(place_uid, language, 컬럼)` 키
- **C 레거시 원본 교정** — <span class="hl-green">레거시 서비스까지 함께</span>

### ⑥ 레거시 원본 교정 여부
근본 해결. 레거시 DB 쓰기 검토 선행

</div>
</div>

---

<!-- _class: closing -->
<!-- _paginate: false -->

## 감사합니다

⚠️ 재마이그 방어(⑤)를 하지 않으면 **이번에 고친 꺾쇠 66개·한자 113곳도 클린 재마이그 1회로 사라집니다.** 지금은 개발 DB 교정만 된 상태입니다.

<div class="links">
<a href="https://kabkee-decks.netlify.app/reports/translation-issues">검토 페이지 — 장소를 고르면 수정 요청이 만들어집니다 (기본: 영문 · 의미 오역만)</a>
<a href="https://kabkee-main.tailfe017f.ts.net:8443/IND/issues/IND-9870">IND-9870</a>
</div>

조사 정리 전문(범위·우려사항 7가지·방어 방안 상세): 저장소 `.artifacts/IND-9870/translation-findings-summary.md`

Indyspot AI Corp &nbsp;·&nbsp; 2026-11-25
