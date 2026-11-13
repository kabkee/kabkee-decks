---
marp: true
theme: clean
paginate: true
title: 360 사진 한 장으로 방을 세우는 법 — 돌하우스 원리와 AI 학습, 처음 보는 분을 위한 설명
---

<!-- _class: cover -->
<!-- _paginate: false -->

# 360 사진 한 장으로 방을 세우는 법

## 돌하우스가 만들어지는 원리와 AI 학습 — 처음 보는 분을 위한 설명

<hr>

Indyspot AI Corp &nbsp;·&nbsp; Engineering Manager &nbsp;·&nbsp; 2026-11-13

---

<!-- _class: agenda -->

## 한 줄 요약 — 사진 속 «벽이 바닥에 닿는 선»만 찾으면 방이 세워집니다

<div class="cols">
<div class="col">

### 원리
- 360 사진은 방 전체를 한 장에 담은 «펼친 지도»
- 바닥 모서리를 내려다본 **각도**와 **카메라 높이**로 거리를 계산
- 모서리를 이으면 방 모양, 벽을 세우고 사진을 입히면 3D

</div>
<div class="col">

### AI 의 역할
- 사람 대신 «벽-바닥 경계선»을 찾아 줌
- 우리 사진 349장에 사람이 정답을 그려 직접 학습
- 2차 학습에서 일반 방 정확도 **76%** — 비교용 외부 모델(74%)을 넘음

</div>
</div>

<div class="links"><span class="lbl">직접 보기</span>
<a class="lnk" href="https://kabkee-decks.netlify.app/reports/2026-11-13-dollhouse-models/" target="_blank">돌하우스 비교 뷰어 (미노네집 외 5곳)</a></div>

---

<!-- _class: sec -->

<span class="sec-num">Part 1</span>

## 사진 한 장에서 방 모양을 알아내는 원리

계산은 중학교 삼각형 수준입니다

---

## 360 사진 = 방을 통째로 펼친 지도

![w:700](assets/2026-11-13-dollhouse/equi-s3.jpg)

지구본을 펼친 세계지도처럼 카메라 주변 360°를 한 장에 담았습니다. **가로 = 방향, 세로 = 위아래 각도**(가운데 줄 = 눈높이). 사진 속 위치가 곧 «카메라에서 본 각도»입니다.

<div class="links"><span class="lbl">직접 보기</span>
<a class="lnk" href="https://kabkee-decks.netlify.app/reports/2026-11-13-dollhouse-models/" target="_blank">신발장 사진 — 뷰어에서 신발장 더블클릭</a></div>

---

## 각도 + 카메라 높이 = 거리

<div class="cols">
<div class="col">

<svg viewBox="0 0 420 230" width="420" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <line x1="20" y1="200" x2="400" y2="200" stroke="#555" stroke-width="3"/>
  <text x="300" y="222" font-size="14" fill="#555">바닥</text>
  <line x1="60" y1="200" x2="60" y2="60" stroke="#888" stroke-width="2" stroke-dasharray="5 4"/>
  <circle cx="60" cy="60" r="10" fill="#e4572e"/>
  <text x="76" y="56" font-size="14" fill="#e4572e">카메라</text>
  <text x="14" y="135" font-size="14" fill="#555">1.5m</text>
  <line x1="60" y1="60" x2="340" y2="200" stroke="#3c8cff" stroke-width="3"/>
  <line x1="340" y1="60" x2="340" y2="200" stroke="#2e9e5b" stroke-width="6"/>
  <text x="350" y="120" font-size="14" fill="#2e9e5b">벽</text>
  <circle cx="340" cy="200" r="7" fill="#2e9e5b"/>
  <text x="222" y="190" font-size="13" fill="#2e9e5b">벽-바닥 모서리</text>
  <line x1="60" y1="60" x2="200" y2="60" stroke="#aaa" stroke-width="1.5"/>
  <text x="120" y="80" font-size="14" fill="#3c8cff">내려다본 각도</text>
  <text x="150" y="218" font-size="14" fill="#555">← 거리 = ? →</text>
</svg>

</div>
<div class="col">

- 카메라는 **삼각대 위 1.5m** 높이에 있습니다.
- 사진에서 모서리가 «눈높이보다 몇 도 아래»인지 압니다.
- 높이와 각도를 알면 직각삼각형으로 **거리**가 나옵니다.
  거리 = 1.5m ÷ tan(내려다본 각도)
- 모서리 몇 개의 거리·방향을 알면 **방의 평면 모양**이 그려집니다.
- 천장도 같은 원리로 **천장 높이**가 나옵니다.

</div>
</div>

---

## AI 가 하는 일 — 벽과 바닥·천장이 만나는 선 찾기

![w:1080](assets/2026-11-13-dollhouse/layout-pair.jpg)

초록 선이 AI 가 찾은 경계(위 = 벽-천장, 아래 = 벽-바닥), 노란 세로선이 방 모서리입니다. 침대·쓰레기통이 벽 아래를 가려도 «있을 법한 위치»로 이어서 추정합니다. 이 선만 찾으면 앞 장의 계산으로 방 모양이 나옵니다.

<div class="links"><span class="lbl">직접 보기</span>
<a class="lnk" href="https://kabkee-decks.netlify.app/reports/2026-11-13-dollhouse-models/" target="_blank">뷰어 «위에서 보기» — 이 선으로 만든 방 모양</a></div>

---

## 방 하나를 3D 로 — 벽 세우기 + 사진 입히기

| 단계 | 하는 일 | 비유 |
|---|---|---|
| ① 방 모양 | 모서리를 이어 바닥 다각형 | 바닥에 테이프로 방 윤곽 붙이기 |
| ② 벽 세우기 | 다각형 둘레에 천장 높이만큼 벽 | 테이프 선을 따라 종이벽 세우기 |
| ③ 사진 입히기 | 벽 각 점에 «카메라에서 그 방향으로 본 사진 색» | 방 한가운데서 빔프로젝터를 쏘는 것 |
| ④ 돌하우스 | 바깥에서 볼 때 앞쪽 벽만 투명하게 | 인형의 집 앞판 떼기 |

③ 덕분에 **촬영 위치에서 보면 원본 360 사진과 똑같고**, 벽 위치가 조금 틀려도 위에서 보면 자연스럽습니다. «재미·공간감» 용도에는 이 성질이 큰 장점입니다.

---

## 여러 방 잇기 — 기존 투어의 «이동 화살표»를 활용

| 단서 | 쓰는 방법 |
|---|---|
| 이동 핫스팟 (방 A → 방 B 화살표) | 화살표가 찍힌 바닥 위치 = 두 방을 잇는 문 근처 → 방 B 의 대략적 위치 |
| 되돌아오는 화살표 (B → A) | 두 화살표의 방향 차이 → 방 B 가 몇 도 돌아가 있는지 |
| 벽은 대부분 직각 | 회전을 90° 단위로 맞춰 반듯하게 |
| 사람 보정 | 어긋난 방은 평면도에서 끌어서 맞춤 (장소당 1회, 몇 분) |

완전 자동은 아직 어렵고, **«자동 배치 + 사람 한 번 보정» 반자동**이 현실적인 방식입니다.

---

## 결과 — 미노네집 돌하우스

![w:500](assets/2026-11-13-dollhouse/dh-doll-manual-3d.jpg)

360 사진 5장 + 사람 보정 1회. 방을 더블클릭하면 촬영 위치로 들어가 원본 360 사진과 같은 화면이 됩니다.

<div class="links"><span class="lbl">직접 보기</span>
<a class="lnk" href="https://kabkee-decks.netlify.app/reports/2026-11-13-dollhouse-models/" target="_blank">드래그 = 회전 · 휠 = 확대 · 더블클릭 = 방 안으로</a></div>

---

## 플랫폼 krpano 에 얹기 — 돌하우스에서 방으로 날아 들어가기

![w:1000](assets/2026-11-13-dollhouse/krpano-moves.jpg)

l3 플랫폼의 VR 엔진(krpano)으로 띄운 같은 결과입니다. 빨간 점을 누르면 카메라가 3D 공간을 날아 원본 360 사진으로 이어지고, 방 사이도 걸어서 이동합니다.

<div class="links"><span class="lbl">직접 보기</span>
<a class="lnk" href="http://100.64.25.50:5174/dollhouse-sample/index.html" target="_blank">krpano 접목 샘플 (개발 서버 · 내부망 전용)</a></div>

---

<!-- _class: sec -->

<span class="sec-num">Part 2</span>

## AI 는 어떻게 배우나 — 학습 방식

정답을 보여주고, 틀린 만큼 고치기를 반복합니다

---

## 학습 = 정답지를 보고 문제를 반복해서 푸는 것

| 단계 | 하는 일 | 비유 |
|---|---|---|
| ① 정답 만들기 (라벨링) | 사람이 360 사진에 벽-바닥 모서리를 찍음 | 문제집 정답지 만들기 |
| ② 학습 | AI 가 사진마다 경계선을 예측 → 정답과 차이만큼 스스로 조정 | 문제를 풀고 채점해 오답 고치기 |
| ③ 반복 (에포크) | 학습 사진 전체를 300바퀴 반복, 매번 사진을 돌리고 뒤집어 변형 | 같은 문제집을 순서·숫자를 바꿔 300번 |
| ④ 평가 | 학습에 **한 번도 안 쓴** 사진으로 시험 | 처음 보는 모의고사 |

AI 의 바탕 모델 구조는 공개된 **HorizonNet**(MIT 라이선스, 상업 사용 가능)을 쓰고, 가르치는 «정답지»는 우리가 직접 만듭니다.

---

## ① 정답 만들기 — 라벨링 도구

![w:580](assets/2026-11-13-dollhouse/labeler-sample.jpg)

사진에서 **바닥 모서리만 클릭**하면 천장선은 자동으로 계산되고, 오른쪽에 위에서 본 방 모양이 바로 그려져 틀린 곳이 보입니다. 사진 1장에 1~3분.

<div class="links"><span class="lbl">직접 보기</span>
<a class="lnk" href="http://100.64.25.50:8791/" target="_blank">라벨링 도구 (내부망)</a></div>

---

## 라벨링 3원칙과 데이터 모으기

<div class="cols">
<div class="col">

### 3원칙
1. **카메라가 있는 방 하나의 큰 윤곽만** — 문·유리 너머는 무시
2. **작은 꺾임은 펴고 큰 꺾임만** 모서리로 (기둥 50cm 미만은 무시)
3. **같은 기준으로 일관되게** — 픽셀보다 «빠뜨리지 않기»가 중요

</div>
<div class="col">

### 데이터
- 레거시 Look360 에서 실내 방 후보 사진을 골라 995장 라벨링
- 쓸 수 있는 방 사진 = **349장**
- 나머지 646장은 실외·복도·모서리 안 보임 등으로 제외
- 교실·객실·사무실·치료실 등 «직각 실내»가 학습 재료

</div>
</div>

---

## ④ 평가 점수 읽는 법 — 3D IoU

<div class="cols">
<div class="col">

<svg viewBox="0 0 300 200" width="300" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <rect x="30" y="30" width="160" height="120" fill="rgba(46,158,91,.25)" stroke="#2e9e5b" stroke-width="3"/>
  <rect x="70" y="50" width="160" height="120" fill="rgba(228,87,46,.25)" stroke="#e4572e" stroke-width="3"/>
  <text x="34" y="24" font-size="14" fill="#2e9e5b">정답 방</text>
  <text x="170" y="190" font-size="14" fill="#e4572e">AI 가 본 방</text>
  <text x="95" y="110" font-size="14" fill="#333">겹친 부분</text>
</svg>

</div>
<div class="col">

- 정답 방과 AI 가 본 방을 3D 로 겹쳐서
- **겹친 부피 ÷ 합친 부피** = 점수
- 100% 면 완벽히 일치, 방 크기·모양이 조금씩 틀릴수록 내려감
- 75% 안팎이면 «모양과 크기를 대체로 맞힘» 수준
- 평가 사진은 학습에 **절대 쓰지 않습니다**

</div>
</div>

---

## 학습 결과 — 데이터가 늘수록 올라갑니다

| 학습 | 정답 사진 | 일반 방 점수 | 전체 점수 | 비고 |
|---|---|---|---|---|
| 1차 | 103장 | 69.3% | 60.6% | 평가 사진 11장 (2차부터와 직접 비교 불가) |
| **2차** | **189장** | **76.2%** | **72.1%** | 목표 70% 달성 |
| 비교용 외부 모델 (ZInD) | — | 74.0% | 71.6% | 상업 사용 불가, 내부 비교용 |
| 3차 | 349장 | 학습 중 | 학습 중 | 새벽 결과 반영 예정 |

«일반 방» = 아파트·사무실 같은 보통 방 15장, «전체» = 가벽·복층까지 포함한 19장입니다. 평가 사진이 적어 2~3점 차이는 우연일 수 있습니다.

---

## 실험 — 가벽 방을 학습에 넣을까 뺄까

![w:720](assets/2026-11-13-dollhouse/v2-partition-2rooms.jpg)

가벽 치료실 2곳 — 넣고 학습(빨강) vs 빼고 학습(보라). 일반 방 점수는 같고(76.2%), 가벽 방은 **넣은 쪽이 정답(초록)에 더 가까워** 채택했습니다.

<div class="links"><span class="lbl">직접 보기</span>
<a class="lnk" href="https://kabkee-decks.netlify.app/reports/2026-11-13-dollhouse-places/nulbom-manual/" target="_blank">가벽 공간 5곳 비교 뷰어</a></div>

---

## 실제 공간 비교 — 재활치료실 (처음 보는 사진)

![w:470](assets/2026-11-13-dollhouse/nulbom-rehab-4versions.jpg)

학습·평가에 한 번도 안 쓴 요양병원 재활치료실 5개 방을 4개 모델로 세운 결과입니다(방 위치는 같고 방 모양만 모델마다 다름). 외부 모델(왼쪽 위)은 «재활치료실_1»을 건물 밖까지 길게 봤고, 우리 모델(1·2차)은 건물 안에 담았습니다.

<div class="links"><span class="lbl">직접 보기</span>
<a class="lnk" href="https://kabkee-decks.netlify.app/reports/2026-11-13-dollhouse-places/nulbom-rehab/" target="_blank">재활치료실 — 모델 버튼으로 4개 버전 전환</a></div>

---

<!-- _class: sec -->

<span class="sec-num">Part 3</span>

## 왜 남의 모델을 그대로 못 쓰나

AI 는 «무엇으로 배웠는지»에 따라 쓸 수 있는 범위가 정해집니다

---

## ZInD 란 — 그리고 왜 못 쓰게 됐나

| 질문 | 답 |
|---|---|
| ZInD 는? | 미국 부동산 회사 **Zillow** 가 공개한 실내 360 사진 데이터(약 7만 장, 주택 1,500여 채)와 정답 |
| 처음엔 왜 썼나 | 이 데이터로 학습된 공개 AI 가 있어서, 우리가 학습하기 전 «가능성 확인»에 가장 빨랐음 |
| 왜 못 쓰나 | 약관이 **비상업 전용**. 제품·서비스 개선에 쓰는 것도 금지로 명시. 출처 표기만으로 허용되는 조항 없음 |
| 다른 공개 모델은? | Matterport3D·Structured3D 등으로 배운 모델도 전부 비상업. Matterport 는 «3D 투어와 비슷한 서비스»까지 금지 |
| 그래서 | 모델 구조(코드)는 자유롭게 쓰고, **정답지만 우리가 직접** 만들어 학습 |

현재 ZInD 모델은 **내부 성능 비교 기준점**으로만 씁니다(서비스 반영 금지). 법률 자문이 아니라 공개 약관 기준 판단입니다.

---

## 중국 쪽 모델·데이터는? — 있지만 역시 비상업

| 이름 | 만든 곳 | 규모 | 상업 사용 |
|---|---|---|---|
| Realsee3D | 베이커(Beike) 산하 Realsee — 중국 최대 부동산 VR | 실내 3D 장면 1만 개 (2025-12 공개) | ❌ 학술·비상업. 상업은 별도 계약 협의 |
| Structured3D | 쿠자레(Kujiale) — 인테리어 설계 플랫폼 | 집 3,500채 · 방 2.1만 개 (합성) | ❌ 비상업 연구·교육만 |
| 최신 방 구조 AI 들 | 중국 등 여러 대학 | — | 코드는 대부분 공개, 하지만 위 데이터들로 학습돼 **가중치는 비상업** |

**국적이 아니라 «학습 데이터 약관»이 문제**입니다. 중국 쪽이 데이터 규모는 가장 크지만 공개분은 모두 비상업이고, Realsee 처럼 **상업 계약을 따로 협의**하는 길은 있습니다(조건 미공개).

---

## 정리 — 우리가 가는 길

| 선택지 | 판단 |
|---|---|
| 남의 학습 모델 그대로 사용 | ❌ 상업 불가 (ZInD·Matterport·Structured3D·Realsee 공개분) |
| 데이터 회사와 상업 계약 | 🟡 가능하지만 조건·비용 미정 (Zillow·Realsee 문의 경로 있음) |
| **우리 사진으로 직접 학습** | ✅ 권리 깔끔 · 2차에서 이미 외부 모델 수준 도달 · 우리 공간(한국 실내)에 특화 |

용도는 **재미·공간감 파악용**(치수 정확도는 목표 아님)으로 정했고, 이 수준에서는 **직접 학습 + 반자동 배치**로 충분하다는 것이 지금까지의 결론입니다.

---

<!-- _class: closing -->
<!-- _paginate: false -->

## 감사합니다

사진 속 «벽이 바닥에 닿는 선» → 각도와 높이로 방 모양 → 벽 세우고 사진 입히기 → 돌하우스

Indyspot AI Corp &nbsp;·&nbsp; Engineering Manager &nbsp;·&nbsp; 2026-11-13
