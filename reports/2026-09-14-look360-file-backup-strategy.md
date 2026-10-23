---
marp: true
theme: clean
paginate: true
title: Look360 파일 백업 전략 — S3 Files 비용 사고 정리 · 파일시스템 교체 · 로컬 전체 백업 · 증분 갱신 설계 (10/23 개정 — 변경분 세대 전환)
---

<!-- _class: cover -->
<!-- _paginate: false -->

# Look360 파일 백업 전략

## S3 Files 비용 사고 정리 &nbsp;·&nbsp; 파일시스템 교체 &nbsp;·&nbsp; 로컬 전체 백업 &nbsp;·&nbsp; 증분 갱신 (10/22 변경분 세대로 전환)

<hr>

Indyspot AI Corp &nbsp;·&nbsp; Engineering Manager &nbsp;·&nbsp; 2026-09-14 작성 &nbsp;·&nbsp; 2026-10-23 개정

---

## 📜 개정 이력 — 무엇이 언제 왜 바뀌었나

원안 슬라이드는 <span class="hl-amber">지우지 않고 남겼습니다</span>. 바뀐 슬라이드 제목에는 <span class="badge">변경됨</span> 표시를 달고, 새 내용은 <span class="hl-blue">Section 04</span>에 따로 정리했습니다.

| 날짜 | 무엇이 바뀌었나 | 왜 | 근거 |
|---|---|---|---|
| 9/14 | 원안 — 바뀐 장소는 <span class="hl-blue">장소 전체를 새 tar로</span> 다시 받기 | 복원 시 tar 하나만 풀면 끝나는 단순함 | Section 01~03 |
| 10/08 | 백업 대상에 <span class="hl-green">`l3-platform-file-storage` 버킷 추가</span> · 버전관리 + 구버전 30일 | 플랫폼 파일(영상·XML 등)이 백업 0이었음 · 오너 카드 「둘 다」 | IND-8045 |
| 10/14~15 | 실행 머신 표기 dsgn → <span class="hl-blue">kabkee-main</span> · 2차 백업도 같은 머신의 D:·E: | 개발 서버 이전 | cron `813e106` |
| 10/15 | Azure 비교표 «교체 후» 금액을 9/29 실측으로 정정 | 9/14 추정이 틀림 | 덱 `2278b2e` |
| 10/22 | 04:00 갱신이 <span class="hl-red">57.2GiB 안전장치</span>에 걸려 멈춤 → <span class="hl-amber">승인 안 함</span> | 실제 변경은 XML 88개(2.3MB)뿐 · 오너 결정 | IND-8672 |
| 10/22 | 증분 방식을 <span class="hl-green">바뀐 파일만 담는 변경분(delta) 세대</span>로 전환 | 작은 변경이 여러 장소에 흩어지면 전송량 폭증 | IND-8673 |
| 10/23 | 검증 7축 통과 · 첫 정기 실행 3건 정상 | — | IND-8685 |
| 10/23 | 복원 도구가 <span class="hl-green">권한을 살리도록</span> 수정 | 권한을 버리고 있었음 | 백업 `fd1c54e` |
| 10/23 | 추가 백업을 <span class="hl-amber">주간회의 안건</span>으로 (선호안 Deep Archive) | 사본 3벌이 한 컴퓨터 → 랜섬웨어에 함께 노출 | 오너 지시 |

---

<!-- _class: agenda -->

## 한 장 요약 (10/23 현재) — 「바뀐 장소」가 아니라 「바뀐 파일」만 받습니다

<div class="cols">
<div class="col">

### 🔁 무엇이 바뀌었나

- 9/14 원안: 파일 1개만 바뀌어도 <span class="hl-red">그 장소 전체(평균 0.8GB)</span>를 다시 받음
- 10/22 XML 88개 일괄 수정이 장소 71곳에 흩어져 <span class="hl-red">57.2GiB</span> 예정 → 안전장치가 멈춤
- 10/22부터 <span class="hl-green">바뀐 파일만 tar에 담고</span>, 목록표에는 장소의 <span class="hl-green">모든 파일과 «어느 tar에 있는지»</span>를 기록
- 같은 변경을 <span class="hl-green">2.3MB</span>로 처리 (약 2만 6천 분의 1)

### 🧭 오너 결정 (10/22)

- 막힌 57.2GiB는 <span class="hl-amber">옛 방식으로 승인하지 않고</span>, 새 방식으로 다시 처리

</div>
<div class="col">

### ✅ 지금 상태 (10/23 실측)

- <span class="hl-green">look360-v1-files</span> 04:00 · <span class="hl-green">l3-platform-file-storage</span> 04:30 · 2차 백업 06:00 — 모두 정상
- 복원 시험: 파일 39,342개 md5 <span class="hl-green">불일치 0</span>
- 9/13 기준본(tar 2,311개)은 <span class="hl-green">그대로 첫 기준점</span>으로 사용 · 변경 0

### ⚠️ 새로 생긴 주의점

- 오래된 tar를 지울 때 <span class="hl-red">아직 참조 중인 tar를 지우면 복원 불가</span> → 참조 계산으로 보호
- 복원 도구가 권한을 버리던 문제는 <span class="hl-green">10/23 수정</span> → `--out-tar`로 만든 tar를 서버에서 `tar -xp`
- 원본·2차 사본 3벌이 <span class="hl-amber">한 컴퓨터(kabkee-main)</span>에 있음 → <span class="hl-amber">주간회의에서 추가 백업 논의</span> (p.38)

</div>
</div>

---

<!-- _class: agenda -->

## 한 장 요약 (9/14 원안) — 「캐시가 만든 비용을 끄고, 백업은 AWS 밖에 두기로」

<div class="cols">
<div class="col">

### 💸 무슨 일이 있었나

- 9/3 권한 복구 작업이 파일 1,657만 개를 다시 쓰면서 <span class="hl-red">9월 12일간 평소보다 $228</span> 추가 청구
- 서버용 캐시(고성능 스토리지)에 <span class="hl-red">439GB</span>가 쌓여 매일 $4.84씩 과금

### 🛠️ 지금까지 한 조치

- 캐시 자동 적재 끄기 + 만료 1일 → 439GB가 <span class="hl-amber">158.9GB에서 멈춤</span> (파일 항목 최소 과금)
- <span class="hl-green">9/14 19:31 파일시스템 교체</span>로 남은 158.9GB 제거 · 서버 전환 1.2초
- 파일 현재 버전 <span class="hl-green">16,566,507개 전체를 dsgn에 백업·전수 검증</span>
- 중복 구버전 약 1,630만 개 정리 착수 (고유본 21,192개는 먼저 백업)

</div>
<div class="col">

### ✅ 백업 결정 (확정)

- AWS Backup(월 <span class="hl-red">11.5~16.4만원</span>) 대신 <span class="hl-green">로컬 백업 + 버저닝 30일</span>
- <span class="hl-green">매일 04:00</span> dsgn에서 <span class="hl-green">바뀐 장소만 다시 받는 증분 갱신</span>, 예상 월 <span class="hl-blue">1,500~4,500원</span>
- 보관은 <span class="hl-green">기간 기준</span>: 30일 전부 + 월간 12개월 + 기준본

### 🎯 현재 단계 (9/14)

- <span class="hl-green">구현·가동 시작</span>: 목록 생성 설정 · dsgn 04:00 증분 갱신 · 이 컴퓨터 06:00 2차 백업
- <span class="hl-green">완료</span>: 파일시스템 교체 · 2차 백업 archive1 복사·sha256 검증 (문제 0)
- <span class="hl-amber">대기</span>: 첫 S3 목록 도착(최대 48시간) · archive2 복사 진행 중 · 기존 파일시스템 삭제(2~3일 관찰 후)

</div>
</div>

---

<!-- _class: sec -->

<span class="sec-num">Section 01</span>

## 비용 사고 — 무엇이 얼마나 나왔나

9월 청구서가 평소의 두 배를 넘었습니다. 원인은 한 번의 대량 작업과, 그 작업이 채워 넣은 서버용 캐시였습니다.

---

## 💸 9월 추가 비용의 구성 <span class="badge-date">9/1~9/12 청구 실측</span>

<div class="stats">
<div class="card"><div class="num">$228</div><div class="lab">평소 대비 추가 (약 33.8만원)</div></div>
<div class="card"><div class="num">$146</div><div class="lab">9/3 하루 (S3·캐시·이벤트)</div></div>
<div class="card"><div class="num">$4.84</div><div class="lab">캐시 저장비 / 일 (9/10~)</div></div>
<div class="card"><div class="num">$110</div><div class="lab">캐시 누적 청구 (5월~9/13)</div></div>
</div>

| 항목 | 추가 금액 | 원인 |
|---|---|---|
| S3 요청 | <span class="hl-red">$124.90</span> | 권한 정보를 바꾸려고 파일 전체를 자기 자신 위에 다시 복사 |
| 캐시 적재·저장·읽기 | <span class="hl-red">$80.04</span> | 폴더를 열 때마다 작은 파일을 캐시로 자동 복사 (기본 설정) |
| EventBridge | $19.46 | 복사된 파일마다 동기화 이벤트 1건 |

> 세 항목 모두 <span class="hl-amber">9/3 권한 복구 작업 하나</span>에서 시작됐습니다. 같은 파일이 같은 날 최대 9번까지 반복 복사됐습니다.

---

## 🧭 캐시는 방문자 속도와 무관했습니다

| 누가 읽나 | 경로 | 캐시 필요 여부 |
|---|---|---|
| 사이트 방문자 | CloudFront → S3 직결 | <span class="hl-green">불필요</span> — 캐시를 거치지 않음 |
| 서버 PHP (파일 읽기) | 마운트 → S3 | <span class="hl-green">불필요</span> — 월 0.46GB, 재읽기는 서버 메모리가 처리 |
| 서버 PHP (업로드) | 마운트 → 캐시 → S3 | 구조상 항상 거침 · 금방 비워져 비용 미미 |

<div class="cols">
<div class="col">

### 단가가 13배

- S3 저장 <span class="hl-blue">GB당 37원</span>
- 캐시 저장 <span class="hl-red">GB당 488원</span>
- 참고: Azure HDD <span class="hl-gray">GB당 51.5원</span>

</div>
<div class="col">

### 조치

- 9/13 21:12 자동 적재 <span class="hl-green">끄기</span>
- 9/14 12:05 만료 <span class="hl-green">7일 → 1일</span>
- 캐시 <span class="hl-blue">439GB → 158.9GB</span>에서 멈춤 (9/14 12:36)
- 9/14 19:31 <span class="hl-green">파일시스템 교체</span>로 남은 분량 제거

</div>
</div>

---

## ⚖️ Azure 시절과 비교한 월 비용

파일 저장 계층만 비교했습니다. Azure는 7월 실청구, AWS는 실측 용량 × 청구서 단가입니다(환율 1,479.5원).

| 구분 | 월 비용 | Azure 대비 |
|---|---|---|
| Azure (데이터 디스크 + 스냅샷 + 백업 볼트) | 154,781원 | 기준 |
| AWS — 캐시 439GB가 쌓였을 때 | <span class="hl-red">256,383원</span> | <span class="hl-red">+66%</span> |
| AWS — 캐시 데이터를 비운 뒤 (파일 항목 158.9GB 남음 · 교체 전) | <span class="hl-amber">약 116,000원</span> | <span class="hl-amber">−25%</span> |
| AWS — 파일시스템 교체 후 (9/29 실측 · 고성능 계층 78,000 + 버킷 23,000) | <span class="hl-green">약 101,000원</span> | <span class="hl-green">−35%</span> |

> 이전 결정 자체는 옳았습니다. <span class="hl-amber">S3 Files의 기본 캐시 설정</span>이 켜진 채 대량 작업을 만난 것이 비용을 뒤집었습니다. 9/14 작성 당시 «교체 후 약 38,500원(−75%)» · «교체 + 정리 약 20,000원(−87%)» 은 새 파일시스템 용량을 0에 가깝게 본 추정이었고, <span class="hl-red">틀린 값</span>으로 확인돼 9/29 실측으로 정정했습니다. 새 파일시스템도 9/18~9/20 마운트 전체 탐색으로 파일 항목 기록이 169.92GB까지 다시 찼고(항목 기록은 만료되지 않음), 이 값이 상한이라 월 비용은 더 늘지 않고 고정됩니다.

---

## 🔁 파일시스템 교체 — 남은 158.9GB는 «파일 항목 기록»이었습니다 <span class="badge-date">9/14</span>

<div class="stats">
<div class="card"><div class="num">158.9GB</div><div class="lab">만료로 안 빠진 용량 (월 약 7.8만원)</div></div>
<div class="card"><div class="num">1,661만</div><div class="lab">기록된 파일 항목 수</div></div>
<div class="card"><div class="num">10KiB</div><div class="lab">항목 1개 최소 과금 크기</div></div>
<div class="card"><div class="num">1.2초</div><div class="lab">서버 연결 전환 시간</div></div>
</div>

<div class="cols">
<div class="col">

### 왜 안 줄었나

- 캐시에 담긴 <span class="hl-green">파일 내용은 만료로 전부 빠졌습니다</span>
- 남은 것은 파일시스템이 기억하는 <span class="hl-amber">파일 목록(이름·크기·권한)</span>입니다
- 9/3 권한 복구가 모든 폴더를 열어 <span class="hl-red">1,661만 항목 × 10KiB = 158.9GB</span>
- 목록 기록은 <span class="hl-red">만료 대상이 아니라</span> 설정으로 지울 수 없습니다

</div>
<div class="col">

### 어떻게 없앴나

- S3의 파일은 그대로 두고, 서버가 붙는 <span class="hl-green">파일시스템만 새로 만들어</span> 연결했습니다
- 새 파일시스템은 <span class="hl-green">실제로 연 폴더만</span> 기록해서 작게 유지됩니다
- 기존 파일시스템은 연결만 끊고 보관 → <span class="hl-amber">2~3일 관찰 후 삭제</span> (보관 중 하루 약 $1.7)

</div>
</div>

---

## ✅ 교체 절차와 검증 — 운영 폴더를 건드리기 전에 먼저 대조했습니다

| 순서 | 작업 | 확인 결과 |
|---|---|---|
| ① | 새 파일시스템 생성 → <span class="hl-green">연결 전에</span> 자동 적재 끄기·만료 1일 적용 | 기본값(적재 켬·만료 30일)이 한 번도 동작하지 않음 |
| ② | 서버 임시 경로에 새 파일시스템을 <span class="hl-blue">나란히 연결</span>해 기존과 대조 | 폴더 23개·항목 2,960개 — 이름·소유자 차이 <span class="hl-green">0</span>, 업로드 계정 쓰기 권한 상실 <span class="hl-green">0</span> |
| ③ | 파일 내용 대조 + 업로드 계정(www-data) 쓰기 시험 | 내용 일치 · 쓴 파일이 <span class="hl-green">약 1분 뒤 S3 반영</span> |
| ④ | S3로 아직 안 넘어간 변경 <span class="hl-green">0건</span> 확인 → 서버 연결 교체 | 전환 1.2초 · 사이트·파일 응답 정상 |
| ⑤ | 기존 파일시스템 보관 · 9/17 자동 보고에 새 용량과 삭제 알림 추가 | 되돌리기 = 백업한 설정 파일 복원 후 재연결 |

> 폴더 권한(www-data)은 S3의 폴더 표시 객체에도 저장돼 있어 새 파일시스템이 그대로 읽습니다. 교체 직후 본 타일 이미지 403은 장소 폴더 안의 `.htaccess`가 직접 접근을 막는 기존 동작이었습니다.

---

## 🧭 다음에 권한을 또 바꿔야 한다면

권한 변경은 폴더 규모와 상관없이 <span class="hl-amber">S3 파일을 한 번씩 다시 쓰는 작업</span>입니다. 9/3의 S3 요청비 $125와 구버전 1,630만 개가 여기서 나왔습니다. 피할 수 있는 것은 <span class="hl-green">파일 항목 기록(바닥값)</span> 쪽입니다.

| 상황 | 방법 | 운영 파일시스템의 항목 기록 | 비용 (추정) |
|---|---|---|---|
| 특정 장소·폴더만 문제 | <span class="hl-green">그 폴더만</span> 권한 수정 | 그 폴더 항목만 (수천 개 · 수 원) | 거의 0 |
| 전체 변경 — <span class="hl-green">권장</span> | <span class="hl-green">작업용 임시 파일시스템</span>을 만들어 거기서 실행 → 끝나면 삭제 | <span class="hl-green">생기지 않음</span> (추정) · 임시분만 하루 약 $1.7 | S3 재기록 약 $75~125 |
| 전체 변경 — 대안 | S3 일괄 작업(Batch Operations)으로 권한 정보만 교체 | <span class="hl-green">생기지 않음</span> (추정) | 요청 약 $75 + 작업비 약 $17 |
| 이번 방식 | 운영 파일시스템에서 실행 → 나중에 교체 | <span class="hl-red">교체 전까지 매일 과금</span> | 교체 작업 약 15분 |

> 🔑 재발을 막는 쪽이 가장 쌉니다: 서버 업로드는 권한 정보가 자동으로 기록되고(9/14 업로드 실측), S3에 직접 올리는 파일만 <span class="hl-blue">권한 정보(file-owner 등)를 함께 넣으면</span> 복구 작업 자체가 필요 없습니다. 어떤 방법이든 전체 재기록은 구버전이 한 벌 생기므로 <span class="hl-amber">30일 구버전 규칙</span>이 정리합니다.

---

<!-- _class: sec -->

<span class="sec-num">Section 02</span>

## 구버전 정리와 전체 백업

지우기 전에 먼저 받아두고, 받은 것은 파일 하나까지 검증했습니다.

---

## 🗂️ 구버전 전수조사 결과 <span class="badge-date">9/13 22:38 기준</span>

| 구분 | 수량 | 처리 |
|---|---|---|
| 현재 버전 (사이트에 나가는 파일) | <span class="hl-blue">16,566,507개 · 429GiB</span> | 로컬 백업 완료 |
| 구버전 — 현재 파일과 내용이 같은 사본 | 약 1,628만 개 · 약 482GiB | 삭제 (잃는 데이터 없음) |
| 구버전 — 현재와 내용이 다른 고유본 | <span class="hl-amber">21,192개 · 0.57GiB</span> | <span class="hl-green">먼저 백업 후 삭제</span> |
| 파노라마 외 경로 구버전 | 46,025개 · 13.5GiB | 9/13 삭제 완료 |

<div class="cols">
<div class="col">

### 고유본은 두 장소뿐

- `pano/1/1773/` — 재생성 전 타일
- `pano/0/100/` — 과거 데이터로 교체하기 전 파일

</div>
<div class="col">

### 삭제 방식

- 직접 삭제 164만 개 후 <span class="hl-red">S3 속도 제한</span> 발생
- 남은 분량은 <span class="hl-green">S3 lifecycle 임시 1일 규칙</span>으로 자동 삭제 중

</div>
</div>

---

## 📦 로컬 전체 백업 — AWS 안에서 묶고 한 번에 받기 <span class="badge-date">9/13~9/14</span>

<div class="stats">
<div class="card"><div class="num">16,566,507</div><div class="lab">검증 통과 파일</div></div>
<div class="card"><div class="num">2,311</div><div class="lab">장소·경로별 tar</div></div>
<div class="card"><div class="num">456GiB</div><div class="lab">dsgn H: 저장 용량</div></div>
<div class="card"><div class="num">약 $55</div><div class="lab">총비용 (추정)</div></div>
</div>

| 단계 | 방법 | 결과 |
|---|---|---|
| 묶기 | 서울 리전 임시 서버가 장소 폴더별로 tar 생성 | 1시간 5분 · 초당 약 4,000개 · 실패 0 |
| 받기 | dsgn이 완성된 tar를 반복해서 내려받기 | 인터넷 전송은 tar 2,311개뿐 |
| 검증 | tar sha256 + 파일별 md5를 목록표와 대조 | 누락 0 · 불일치 0 |
| 정리 | 임시 서버·버킷·권한 삭제 | 재조회로 삭제 확인 |

---

<!-- _class: sec -->

<span class="sec-num">Section 03</span>

## 앞으로의 백업 — 방법 비교와 선택

AWS Backup, 로컬 백업, 버저닝만 쓰는 방법을 비용·보호 범위·운영 수고로 비교했습니다.

---

## 🔍 세 가지 방법 비교

| 항목 | A. AWS Backup | <span class="hl-green">B. 로컬 백업 + 버저닝 30일</span> | C. 버저닝 30일만 |
|---|---|---|---|
| 월 고정비 | <span class="hl-red">11.5~16.4만원</span> | <span class="hl-green">약 1,500~4,500원</span> | 거의 0 |
| 최근 실수 복구 | 35일 안 아무 시점 | 30일 (버저닝) | 30일 (버저닝) |
| 버킷 삭제·계정 사고 | 복구 가능 (같은 계정) | <span class="hl-green">복구 가능 (AWS 밖 사본)</span> | <span class="hl-red">불가</span> |
| 전체를 로컬로 꺼내기 | <span class="hl-red">복원+다운로드 약 21~26만원</span> | <span class="hl-green">이미 로컬에 있음</span> | 원본에서 다시 받기 약 8만원 |
| 운영 수고 | 없음 (자동) | 자동화 스크립트 관리 | 없음 |
| 대량 작업의 영향 | 백업 대상 급증 → 보관비 최대 2배 | 내용이 같으면 다시 받지 않음 | 구버전 30일치 증가 |

> 금액은 서울 리전 가격표 기준 추정입니다. AWS Backup은 <span class="hl-amber">128KB 미만 파일을 128KB로 과금</span>합니다(요금 페이지 원문 확인). 타일 평균이 30KB라 실제 429GB가 약 2TB로 계산됩니다.

---

## ✅ 왜 B를 선택했나 <span class="badge">복원 부분 변경 → p.35</span>

<div class="cols">
<div class="col">

### 비용

- AWS Backup 보관비만으로 <span class="hl-red">Azure 시절 파일 저장 비용 전체를 넘습니다</span>
- B는 바뀐 장소만 받아서 대부분 <span class="hl-green">월 100GB 무료 전송분 안</span>에서 끝납니다

### 독립성

- 사본이 <span class="hl-green">AWS 계정 밖(dsgn)</span>에 있어 계정 사고·버킷 삭제에도 남습니다
- 필요할 때 <span class="hl-green">장소 tar 하나만 풀면</span> 바로 복원됩니다

</div>
<div class="col">

### 이미 갖춘 것

- 검증된 전체 백업과 <span class="hl-blue">묶기·검증 스크립트</span>가 있습니다
- 최근 실수는 <span class="hl-green">버저닝 30일</span>이 S3 안에서 무료로 막아줍니다

### 감수하는 것과 대응

- dsgn이 <span class="hl-amber">켜져 있어야</span> 갱신됩니다 → 절전 안 함 설정 확인
- <span class="hl-amber">윈도우 업데이트 재부팅</span> 가능 (9/9 05:49 사례) → 끊겨도 다음 날 이어서 하는 구조
- 갱신 사이의 변경은 버저닝 30일 창에 의존합니다
- 디스크 1개 위험 → <span class="hl-green">2차 사본을 이 컴퓨터 디스크 2개에</span>

</div>
</div>

---

## 🔄 구현 방식 — 매일 04:00 장소 단위 증분 갱신 <span class="badge">④ 변경됨 10/22 → Section 04</span>

| 순서 | 동작 | 이유 |
|---|---|---|
| ① | S3 Inventory가 매일 파일 목록(키·크기·ETag·수정시각) 생성 | 1,657만 개를 직접 조회하지 않음 · 1회 약 $0.04 |
| ② | 어제 목록과 <span class="hl-blue">장소 폴더별로 비교</span> — ETag가 달라도 크기가 같으면 <span class="hl-blue">체크섬(CRC64) 재확인</span> | 내용이 같은 재기록(9/5, 9.65GB)은 기록만 하고 받지 않음 |
| ③ | 한 번에 <span class="hl-amber">샤드 200곳 또는 50GB 이상</span>이면 멈추고 Slack 확인 요청 | 대량 작업이 모르는 사이 대량 다운로드로 번지는 것 차단 |
| ④ | 바뀐 장소는 <span class="hl-green">현재 상태 전체를 새 tar로</span> dsgn이 원본에서 직접 받기 | 복원 시 최신 tar 하나만 풀면 끝 · S3에 사본을 두지 않음 |
| ⑤ | tar sha256 + 파일별 md5 검증 | 기존 검증 스크립트 재사용 |
| ⑥ | <span class="hl-green">기간 기준 보관</span> 적용 (다음 장) | 자주 바뀌는 장소의 수정 전 원본 보존 |

> 장소 하나를 통째로 다시 받아도 비용은 작습니다: 중간값 49MB는 1원 미만, 재생성된 `pano/1/1773/`(0.5GB)은 약 80원, 가장 큰 `pano/0/100/`(8GB)도 약 1,500원입니다(추정).

---

## 📅 주기와 보관 규칙 — 실측 변경 빈도로 정했습니다 <span class="badge">유지 · 삭제 방식 보완 → p.33</span>

<div class="cols">
<div class="col">

### 실제 변경 빈도 (목록표 실측)

| 날짜 | 바뀐 파일 | 성격 |
|---|---|---|
| 9/5 | 40,169개 · 545샤드 | <span class="hl-gray">ETag 형식만 바뀐 재기록</span> |
| 9/7 | 17,379개 · 2샤드 | <span class="hl-red">1773 타일 재생성</span> |
| 9/8~9/13 | 하루 4~11개 | <span class="hl-green">평소 수준</span> |

- 평소엔 <span class="hl-green">매일 돌려도 받을 게 거의 없음</span> → <span class="hl-green">매일 04:00</span>
- 새 장소는 짧게 여러 번 바뀜 — `1773`은 <span class="hl-amber">열흘 중 4일</span>

</div>
<div class="col">

### 보관 규칙 — 개수가 아니라 기간

| 대상 | 보관 |
|---|---|
| 기준본 (9/13 전체) | 1년 뒤 새 기준본까지 |
| 최근 30일 세대 | <span class="hl-green">전부</span> |
| 30일 지난 세대 | 장소별 <span class="hl-green">월 1개 · 12개월</span> |
| 12개월 지난 월간 세대 | 삭제 |

- «최근 3세대»는 `1773` 같은 장소에서 <span class="hl-red">일주일 안에 원본이 밀려남</span>
- 30일은 <span class="hl-blue">S3 버저닝 30일</span>과 복원 가능 기간을 맞춤

</div>
</div>

---

## 🕓 일정과 재부팅 (9/14 원안) <span class="badge">변경됨 → p.36</span>

| 시각 | 무엇이 | 어디서 | 비고 |
|---|---|---|---|
| 04:00 | 증분 갱신 (목록 비교 → 바뀐 장소 받기 → 검증) | dsgn | 평소 몇 초~몇 분 · 대량 변경은 확인 요청으로 멈춤 |
| 05:00 | 재부팅 검사 (<span class="hl-amber">가동 3.5일 초과 시 재부팅</span>, 약 4일마다) | 이 컴퓨터 | T2 브릿지 하드정지 예방 장치 (8/10 설정) |
| 06:00 | 2차 백업 (dsgn → archive1 → archive2 복사 + sha256 대조) | 이 컴퓨터 | dsgn 작업이 아직 돌면 그날은 건너뜀 |
| 불규칙 | 윈도우 업데이트 재부팅 | dsgn | 9/9 05:49 사례 · 정기 재부팅은 없음 |

<div class="cols">
<div class="col">

### 끊겨도 안전한 구조

- tar는 <span class="hl-blue">`.partial`</span>로 받고 → 다시 읽어 md5 검증 → 정식 이름으로 변경
- 상태 기록은 <span class="hl-green">검증이 끝난 뒤에만</span> 갱신 → 다음 날 같은 지점부터 재시도

</div>
<div class="col">

### 동시 실행 방지

- dsgn·이 컴퓨터 모두 <span class="hl-blue">잠금 파일</span>로 중복 실행 차단
- 2차 백업은 dsgn 잠금을 확인해 <span class="hl-green">쓰는 중인 파일을 복사하지 않음</span>

</div>
</div>

---

## ⚖️ 장소 단위 vs 파일 단위 (9/14 판단) <span class="badge">10/22 번복 → p.30</span>

| 항목 | 파일 단위 증분 | <span class="hl-green">장소 단위 갱신 (선택)</span> |
|---|---|---|
| 장소 일부만 수정됐을 때 받는 양 | <span class="hl-green">바뀐 파일만</span> | 장소 전체 |
| 파노라마 재생성·신규 업로드 | 사실상 장소 전체 | 장소 전체 |
| 복원 절차 | 기준 tar + 증분 tar를 날짜순으로 전부 풀고 삭제 기록 반영 | <span class="hl-green">최신 tar 하나</span> |
| 복원 실수 가능성 | <span class="hl-red">높음</span> (순서·누락) | <span class="hl-green">낮음</span> |
| 로컬 용량 | 가장 적음 | 바뀐 장소 × 보관 기간만큼 증가 (1년 수십 GB 추정) |
| 기존 백업과의 연속성 | 새 구조 필요 | <span class="hl-green">장소별 tar 구조 그대로</span> |

> 사고가 났을 때 필요한 것은 <span class="hl-amber">빠르고 틀리지 않는 복원</span>입니다. 약간의 추가 다운로드를 감수하고 복원 단순성을 택했습니다.

---

## ♻️ 복원할 때 주의 — 권한까지 살리려면 «서버 폴더»에 풉니다 <span class="badge">절차 변경 → p.35</span>

백업 tar에는 파일마다 <span class="hl-green">주인·권한(www-data)</span>이 함께 기록돼 있습니다. 어디에 푸느냐에 따라 이 정보가 살기도 하고 사라지기도 합니다.

| 복원 방법 | 절차 | 결과 |
|---|---|---|
| <span class="hl-green">✅ 서버 폴더에 풀기 (기본)</span> | 장소 tar를 서버로 옮긴 뒤 root로 `tar -xp --numeric-owner --warning=no-unknown-keyword -f <장소>.tar -C /var/www/html/files` | <span class="hl-green">주인·권한 그대로</span> · 약 1분 안에 S3 반영 |
| <span class="hl-red">🚫 S3에 직접 올리기</span> | tar를 풀어 `aws s3 cp` · `sync` 로 업로드 | <span class="hl-red">권한 정보가 빠져 root 소유·읽기 전용</span> → 업로드·수정 실패 → 권한 복구 재발 |
| 불가피하게 S3에 직접 올릴 때 | 파일마다 `file-owner` `33` · `file-group` `33` · `file-permissions` `0100664`, 폴더 표시 객체(`pano/0/` 같은 빈 객체)에는 `0042775` 를 함께 넣기 | 권한 유지 |

> 9/3 권한 복구가 필요했던 이유가 이것입니다. S3에 직접 올린 파일은 권한 정보가 없어 <span class="hl-amber">root 소유로 보입니다</span>(AWS 문서 기본값). 복원은 덮어쓰기라 복원 전 상태도 <span class="hl-blue">구버전으로 30일</span> 남습니다.

---

## 🧰 필요한 것과 비용 (9/14 원안) <span class="badge">대상 버킷 추가 → p.36</span>

<div class="cols">
<div class="col">

### AWS 설정

- <span class="hl-green">✓</span> 목록 저장용 버킷 — **파일 목록만** 저장 · 7일 자동 삭제
- <span class="hl-green">✓</span> 무인 실행용 읽기 전용 인증
- <span class="hl-green">✓</span> `look360-v1-files` 매일 목록 생성 (현재 버전 · 크기/수정시각/ETag)
- <span class="hl-amber">9/16~17</span> 버킷 전체 구버전 30일 규칙 (임시 1일 규칙 교체)
- S3에는 <span class="hl-blue">백업 사본을 두지 않음</span> — dsgn이 원본에서 직접 받음

### 실행 설정

- <span class="hl-green">✓</span> dsgn 갱신 스크립트 + cron <span class="hl-green">매일 04:00</span> (시험 7종 통과)
- <span class="hl-green">✓</span> 이 컴퓨터 2차 백업 + cron <span class="hl-green">매일 06:00</span>
- <span class="hl-green">✓</span> 실패 · 대량 변경 · 미실행 시에만 Slack

</div>
<div class="col">

### 예상 비용 (추정)

| 항목 | 금액 |
|---|---|
| Inventory 목록 생성 | 1회 약 $0.04 |
| 목록 보관 (7일치) | 월 100원 미만 |
| 바뀐 장소 다운로드 | 대부분 무료 전송분 안 |
| 조회 요청 | 1만 건 약 $0.0035 |
| **월 합계** | **약 $1~3** |

### 일정

- 첫 Inventory 목록: 설정 후 최대 48시간
- 구현·시험: 약 1~2일 (추정)

</div>
</div>

---

## 🔑 무인 실행용 인증 — 읽기 전용 액세스 키로 준비 완료 <span class="badge-date">9/14</span>

현재 로그인(SSO)은 최대 1일이라 매일 자동 실행에는 쓸 수 없습니다. <span class="hl-green">`look360-backup-reader` 를 만들어 검증까지 마쳤습니다</span> — 읽기는 허용, 쓰기·삭제·설정 변경은 정책 시뮬레이터에서 전부 <span class="hl-green">explicitDeny</span> (실제 삭제 호출 없이 판정). 키 교체 알림: 12/13.

| 방식 | 보안 | 설정 난이도 | 판단 |
|---|---|---|---|
| <span class="hl-green">읽기 전용 IAM 사용자 + 액세스 키</span> | 키는 만료가 없음 · 권한을 «이 버킷·목록 읽기»로 제한 → 유출 시 <span class="hl-amber">파일 열람은 가능</span>하지만 <span class="hl-green">수정·삭제 불가</span> | 쉬움 | <span class="hl-green">추천</span> (90일마다 교체) |
| IAM Roles Anywhere | 인증서로 임시 자격증명 발급 · 오래 쓰는 키 없음 | 인증서·신뢰 설정 필요 | 보안을 더 중시할 때 |
| SSO 로그인 | 안전 | 쉬움 | <span class="hl-red">매일 로그인 필요 → 자동화 불가</span> |

> 🔴 관리자 권한 액세스 키는 만들지 않습니다. 참고: SSO 세션은 <span class="hl-amber">CLI 로그인 시각이 아니라 브라우저 포털 로그인 시각</span>부터 계산되는 것으로 보입니다(9/14 토큰 기록 기반 추정).

---

## 🎯 결정 현황 — 9/14 기록과 <span class="hl-blue">10/23 현재</span> <span class="badge">변경 3건</span>

9/14에 확정했던 항목은 왼쪽 그대로 두고, 지금 상태를 오른쪽에 덧붙였습니다.

| 항목 | 9/14 상태 | 10/23 현재 |
|---|---|---|
| 방식 · 인증 | 확정 · 준비 완료 | 유지 |
| 주기 · 보관 규칙 | 확정 (매일 04:00 · 기간 기준) | 유지 · <span class="hl-amber">삭제는 참조 계산 후</span> (p.33) |
| 갱신 단위 | 장소 전체 tar | <span class="hl-red">변경</span> → <span class="hl-green">바뀐 파일만</span> (10/22 · p.32) |
| 체크섬 재확인 · 대량 변경 확인 | 확정 | 유지 · 판정 기준을 <span class="hl-amber">실제 받을 양</span>으로 |
| 백업 대상 | `look360-v1-files` | <span class="hl-red">변경</span> → <span class="hl-green">+ `l3-platform-file-storage`</span> (10/08) |
| 2차 사본 | 이 컴퓨터 디스크 2개 · 매일 | <span class="hl-red">변경</span> → <span class="hl-amber">kabkee-main 한 대</span>에 모임 · 회의 안건 (p.38) |
| 알림 | 실패·확인 필요 시에만 | 유지 |
| 구현 | 완료 · 9/14 가동 | 유지 · 10/22 변경분 방식으로 교체 |
| 파일시스템 교체 | 완료 · 9/14 19:31 | 유지 |

---

## 📋 9/14에 예정했던 후속 작업 → 결과 <span class="badge-date">10/23 조회</span>

- <span class="badge-date">9/14 저녁</span> archive2 복사·sha256 검증 → <span class="hl-green">✅ 9/14 20:06 완료</span>
- <span class="badge-date">9/15~16</span> 첫 S3 목록 → 첫 증분 갱신 → <span class="hl-green">✅ 9/15 04:11 실행</span>
- <span class="badge-date">9/16~17</span> 임시 1일 규칙 → <span class="hl-green">버킷 전체 30일 규칙</span> → <span class="hl-green">✅ 적용</span> (두 버킷 모두)
- <span class="badge-date">9/16~17</span> 기존 파일시스템 삭제 → <span class="hl-green">✅ 삭제됨</span> (현재 새 FS 1개뿐)
- <span class="badge-date">9/17 10:00</span> Slack 자동 보고 → <span class="hl-gray">스크립트는 있음 · 발송 기록은 이번에 확인 안 함</span>
- 월 예산 알림 재조정 (당시 $200 · CloudWatch $300) → <span class="hl-amber">⏳ 아직 $200 · $300 그대로</span>

> 9/14 원문 일정은 지우지 않고 화살표(→) 뒤에 결과를 붙였습니다. 「⏳」은 아직 처리되지 않은 항목입니다.
---

## 🧯 이번에 확인한 운영 함정 (9월)

| 함정 | 무슨 일이 있었나 | 앞으로의 원칙 |
|---|---|---|
| ETag가 다르면 내용이 다르다? | ETag가 다른 구버전 25만 개 대부분이 업로드 방식 차이일 뿐 같은 내용 | <span class="hl-green">체크섬(CRC64)·md5로 확인</span> |
| 옆 버전과 같으면 사본이다? | A→A→B→C→B 체인에서 현재와 다른 구버전을 놓침 | <span class="hl-green">반드시 현재 버전과 비교</span> |
| 빠르게 지우면 빨리 끝난다? | 동시 삭제 128개 → S3 속도 제한 | <span class="hl-green">대량 삭제는 lifecycle에 맡기기</span> |
| 종료 기록이 있으면 완료다? | 로그인 만료로 전부 실패한 다운로드를 완료로 판정 | <span class="hl-green">종료코드 + 개수 대조까지</span> |
| 캐시는 성능에 도움된다? | 방문자는 CloudFront를 쓰고 캐시는 비용만 증가 | <span class="hl-green">자동 적재 끄기 유지</span> |
| 용량이 멈추면 다 빠진 것이다? | 158.9GB는 데이터가 아니라 파일 항목 1,661만 개의 최소 과금분 | <span class="hl-green">전체 폴더 순회는 임시 파일시스템에서</span> |

---

<!-- _class: sec -->

<span class="sec-num">Section 04 · 10/23 개정</span>

## 장소 단위 갱신 → 변경분(delta) 세대로

9/14 원안의 «바뀐 장소는 통째로 다시 받기»가 10/22 XML 일괄 수정에서 57.2GiB 다운로드로 번졌습니다. 원안의 판단 근거와, 그것이 어디서 어긋났는지를 함께 남깁니다.

---

## 🚨 10/22 04:00 — 안전장치가 다운로드 전에 멈췄습니다

<div class="stats">
<div class="card"><div class="num">88개</div><div class="lab">실제로 바뀐 파일 (거의 전부 XML)</div></div>
<div class="card"><div class="num">71곳</div><div class="lab">그 파일이 흩어진 장소(샤드)</div></div>
<div class="card"><div class="num">57.2GiB</div><div class="lab">원안 방식이 받으려던 양</div></div>
<div class="card"><div class="num">2.3MB</div><div class="lab">실제로 바뀐 내용의 합</div></div>
</div>

| 바뀐 파일 | 개수 | 성격 |
|---|---|---|
| `customxml/N/custom.xml` | 60 | 장소별 핫스팟·커스텀 설정 XML |
| `panostory_N.xml` | 20 | 스토리(vrstory) XML |
| `N.xml` | 5 | 장소 뷰어 XML |
| `bbs/` | 3 | png 1 + 폴더 표시 객체 2 |

> 안전장치(<span class="hl-amber">샤드 200곳 또는 50GiB 이상이면 멈춤</span>)는 설계대로 동작했습니다. 데이터 손실은 없었고, 멈춘 동안 바뀐 파일은 S3 버전관리가 지키고 있었습니다. 수정 작업은 10/20 22시~10/21 09시에 몰려 있었습니다(IND-8648 계열 핫스팟 복구로 추정).

---

## 🧭 9/14 판단은 어디서 어긋났나 — 전제와 실제

| 9/14 원안의 전제 | 10/22에 드러난 실제 |
|---|---|
| 장소가 바뀔 때는 대개 <span class="hl-blue">재생성·신규 업로드처럼 장소 전체</span>가 바뀐다 (9/7 `1773` 사례) | <span class="hl-red">XML 일괄 수정</span>은 여러 장소에 파일 1~3개씩 흩어진다 |
| 장소 하나를 통째로 다시 받아도 <span class="hl-blue">1원~1,500원</span>이라 싸다 | 장소 하나는 싸지만 <span class="hl-red">71곳이 한날 겹치면 57GB</span> · 2차 백업 디스크 쓰기도 2배 |
| 바뀐 장소 × 보관 기간 = <span class="hl-blue">1년 수십 GB</span> 증가 (추정) | 이런 일괄 수정이 몇 번만 반복돼도 그 추정을 넘는다 |
| 복원은 <span class="hl-green">최신 tar 하나</span>면 끝난다 — 가장 중요한 가치 | 이 가치는 맞았다 → 새 방식도 <span class="hl-green">목록표 하나로 복원</span>되게 설계 |

<div class="cols">
<div class="col">

### 🚫 검토했다가 버린 안: «XML만 따로 백업»

- 파일 종류로 규칙을 나누면 <span class="hl-red">jpg가 대량으로 바뀌는 날</span> 같은 문제가 다시 생깁니다
- 기준은 <span class="hl-green">파일 종류가 아니라 «바뀐 파일»</span>이어야 합니다

</div>
<div class="col">

### 🔑 남길 교훈

- «평소 변경 빈도»(하루 4~11개)만 보고 <span class="hl-amber">변경이 흩어지는 패턴</span>을 시험하지 않았습니다
- 안전장치를 둔 덕분에 <span class="hl-green">받기 전에 멈췄습니다</span> — 계속 유지합니다

</div>
</div>

---

## 📌 오너 결정 (10/22) — 57.2GiB는 옛 방식으로 승인하지 않는다

| 선택지 | 내용 | 판단 |
|---|---|---|
| A. 그날 바로 `--approve` | 원안 방식으로 장소 71곳 전체 57.2GiB 다운로드 (전송비 약 $7 추정) | <span class="hl-red">채택 안 함</span> |
| <span class="hl-green">B. 고친 뒤 새 방식으로 처리</span> | 변경분 방식을 만든 다음, 막힌 같은 목록(`2026-10-21T01-00Z`)을 새 방식으로 처리 | <span class="hl-green">채택</span> |

<div class="cols">
<div class="col">

### 왜 B인가

- 막힌 동안에도 바뀐 파일은 <span class="hl-green">S3에 그대로</span> 있고, <span class="hl-green">구버전 30일</span>이 덮어쓴 이전 내용까지 지킵니다 → 며칠 기다려도 잃는 것이 없습니다
- A로 받으면 57GB짜리 세대 71개가 <span class="hl-amber">보관 규칙상 최대 12개월</span> 남고, 2차 디스크 2개에도 같은 양이 복사됩니다

</div>
<div class="col">

### 결과 (10/22 20:39 수동 1회)

- 같은 목록을 새 방식으로 처리 → <span class="hl-green">2,380,411바이트</span>만 다운로드
- 변경분 세대 70개 + 새 장소 `bbs__2026__10` 전체 세대 1개
- 이후 정기 실행은 다시 <span class="hl-green">매일 자동</span>입니다
- 🔴 이번 건에서 <span class="hl-red">`--approve` 실행 기록 0건</span> (cron.log 확인)

</div>
</div>

---

## 🔄 새 구조 — 바뀐 파일만 담고, 목록표는 장소 전체를 적습니다 <span class="badge-new">10/22 확정</span>

| 구성 | 기준(전체) 세대 | <span class="hl-green">변경분(delta) 세대</span> |
|---|---|---|
| 본문 tar | 장소 전체 (`.tar`) | <span class="hl-green">바뀐(추가·수정) 파일만</span> (`.delta.tar`) · 삭제만 있으면 tar 없음 |
| 목록표 (`.csv.gz`) | 모든 파일 | <span class="hl-green">그 시점의 모든 파일</span> + 파일마다 <span class="hl-blue">«본문이 든 tar»</span> (삭제된 파일은 빠짐) |
| 기록 (`.json`) | tar 이름·크기·sha256 | 같은 3개 항목 유지 → <span class="hl-green">2차 백업 검증 스크립트 그대로</span> |

<div class="cols">
<div class="col">

### 9/13 기준본은 그대로 첫 기준점

- 9/13 전체 백업 tar 2,311개를 목록표가 <span class="hl-blue">`@base/<장소>.tar`</span>로 가리킵니다
- 기준본은 <span class="hl-green">읽기만 하고</span> 수정·이동·삭제하지 않습니다 (작업 전후 4,622개 파일 크기·시각 동일)
- 9/14~10/21에 만든 전체 세대도 그대로 기준점으로 인정됩니다

</div>
<div class="col">

### 복원은 여전히 «목록표 하나»에서 시작

- 원하는 날짜의 목록표를 열면 <span class="hl-green">파일마다 꺼낼 tar가 적혀 있습니다</span>
- 열어야 하는 tar는 <span class="hl-amber">최대 10개</span>로 제한 (다음 장 규칙)
- 꺼낸 파일마다 <span class="hl-green">md5·크기를 목록표와 대조</span>하고, 하나라도 틀리면 실패 처리

</div>
</div>

---

## ♻️ 기준점 다시 만들기 · 오래된 세대 지우기 · 안전장치

<div class="cols">
<div class="col">

### 기준(전체) 세대를 다시 만드는 조건 — 바뀐 장소에서만 판단

| 조건 | 이유 |
|---|---|
| 기준점이 없음 (새 장소) | 기댈 곳이 없음 |
| 참조할 tar가 없거나 위치 불명 | 안전 우선 |
| 이번 변경이 장소의 <span class="hl-blue">50% 이상</span> | 전체로 받아도 비용이 같음 |
| 열어야 할 tar가 <span class="hl-blue">10개 이상</span> | 복원 단계 수 상한 |
| 쌓인 변경분이 장소의 <span class="hl-blue">30% 이상</span> | 변경분이 기준보다 커지는 것 방지 |
| 기준점 나이 <span class="hl-blue">45~59일</span> (장소마다 다름) | 다시 만드는 날을 분산 |

- 나이·사슬·누적 조건의 재생성은 <span class="hl-amber">하루 20GiB까지</span>만 · 넘치면 다음 날로 미룸
- 기준본 나이는 9/13이 아니라 <span class="hl-blue">채택일 10/22부터</span> 셈 (9/13부터 세면 첫날 2,311곳이 전부 만기)

</div>
<div class="col">

### 오래된 세대 지우기 — «참조 중이면 안 지운다»

- 남길 목록표는 원안 규칙 그대로: <span class="hl-green">30일 전부 + 월 1개 12개월</span>
- 남긴 목록표가 <span class="hl-red">하나라도 가리키는 tar는 절대 지우지 않음</span>
- 목록표를 못 읽거나 tar가 없으면 <span class="hl-amber">그 장소는 아무것도 안 지움</span>
- 1회 500개 초과·`generations/` 밖 경로는 삭제 중단 (원안 가드 유지)

### 안전장치

- 기준은 그대로 <span class="hl-blue">200곳 또는 50GiB</span>
- 판정 대상이 «장소 크기 합» → <span class="hl-green">«실제로 받을 양»</span>으로 바뀜

</div>
</div>

---

## ✅ 검증 — 운영에 넣기 전과 후 <span class="badge-date">10/22~10/23</span>

<div class="stats">
<div class="card"><div class="num">39,342</div><div class="lab">복원 후 md5 대조 · 불일치 0</div></div>
<div class="card"><div class="num">0</div><div class="lab">목록표가 가리키는데 없는 tar (v1 149 · l3 216)</div></div>
<div class="card"><div class="num">46/46</div><div class="lab">자체 시험 통과 (QC 재실행)</div></div>
<div class="card"><div class="num">19KB</div><div class="lab">10/23 04:00 첫 정기 실행 다운로드</div></div>
</div>

| 시험 | 방법 | 결과 |
|---|---|---|
| 변경분에 바뀐 파일만 들어가나 | 수정·추가·삭제를 흉내 낸 세대를 만들어 tar 내용 대조 | <span class="hl-green">통과</span> · 삭제만 있으면 tar 없음 |
| 오래된 세대 삭제가 참조 tar를 지키나 | 시계를 과거로 돌려 삭제를 실제로 발동 | 목록표 4개 정리 · <span class="hl-green">참조 tar 2개 보호</span> · 미참조 1개만 삭제 |
| 목록표가 S3와 같은가 | 장소 7곳 목록표 ↔ S3 현재 목록 | 추가 0 · 누락 0 · 크기 차이 0 |
| 정기 실행 | 10/23 04:00 · 04:30 · 06:00 | 3건 모두 <span class="hl-green">정상</span> · 2차 디스크 2개 검증 문제 0 |

> 시험은 운영 폴더가 아닌 <span class="hl-blue">별도 폴더</span>에서 했고, S3에는 쓰지 않았습니다. QC 관찰 1건: 리포트의 장소 목록이 50건에서 잘려 보이지만 합계 수치는 정확합니다(판정 영향 없음).

---

## ♻️ 복원 방법 (10/22 이후) — 이제 «tar 하나 풀기»가 아닙니다

변경분 세대가 생긴 장소는 <span class="hl-red">tar 하나에 장소 전체가 들어 있지 않습니다</span>. 최신 `.delta.tar`만 풀면 바뀐 파일 몇 개만 나옵니다.

| 단계 | 방법 | 주의 |
|---|---|---|
| ① 재구성 | kabkee-main에서 `incremental_backup.py [--src 버킷] --restore <장소> [--at YYYYMMDD] --out <빈 폴더> --out-tar <장소>.tar` | 목록표대로 필요한 tar에서 꺼내고 md5 대조 · <span class="hl-green">원래 소유자·권한을 담은 tar 1개</span> 생성 |
| ② 반영 | tar를 서버로 옮겨 root로 `tar -xp --numeric-owner -f <장소>.tar -C /var/www/html/files` | <span class="hl-green">9/14 절차와 같은 명령</span> · 약 1분 안에 S3 반영 · 기존 파일은 구버전으로 30일 남음 |
| 기록 | 리포트 `owners` 에 소유자·권한 분포가 찍힘 | `0:33 0644`가 보이면 복원 후 그 파일만 `chown 33:33` · <span class="hl-amber">권한만 바뀐 변경은 백업이 감지 못함</span>(내용·ETag 동일 — 10/23 XML 80개) |
| 🚫 금지 | 복원 결과를 `aws s3 cp/sync`로 직접 올리기 | 권한 정보가 빠져 9/3 권한 복구 사고가 재발 |

> 🔧 10/22 첫 버전의 복원 도구는 파일을 <span class="hl-red">소유자·권한 없이</span> 써서 손으로 권한을 맞춰야 했습니다 → <span class="hl-green">10/23 수정</span>. `pano__0__352`(기준본+변경분)를 root로 풀어 원본 tar 헤더와 <span class="hl-green">7,324건 모두 일치</span>를 확인했습니다(selftest 85/85). 실제 서버 복원 리허설은 아직입니다.

---

## 🗄️ 백업 대상과 일정 — 10/23 현재

| 시각 | 무엇이 | 대상 | 저장 위치 |
|---|---|---|---|
| 04:00 | 변경분 갱신 (S3 Inventory 목록 비교) | `look360-v1-files` (레거시 사이트 파일 1,657만 개) | kabkee-main H: `look360-v1-files-backup-20260913` |
| 04:30 | 변경분 갱신 (<span class="hl-blue">직접 목록 조회</span> · 인벤토리 없음) | <span class="hl-green">`l3-platform-file-storage`</span> (l3 플랫폼 파일 1.6만 개 · 27.8GB, 10/08 실측) | kabkee-main H: `l3-platform-file-storage-backup-20261008` |
| 06:00 | 2차 백업 (복사 + sha256 대조) | 위 두 폴더 | kabkee-main <span class="hl-blue">D: `/mnt/archive1` · E: `/mnt/archive2`</span> |

<div class="cols">
<div class="col">

### 9/14 원안에서 바뀐 점

- <span class="hl-green">버킷 단위 백업</span>으로 l3 플랫폼 버킷 추가 (10/08 · IND-8045) — 버전관리 + 구버전 30일도 함께 적용
- 두 버킷 모두 <span class="hl-green">같은 스크립트·같은 변경분 방식</span>
- 05:00 재부팅 검사(옛 컴퓨터 전용 T2 예방 장치)는 현재 일정에 없음

</div>
<div class="col">

### ⚠️ 발견한 위험 → 10/23 결정

- 9/14 원안은 2차 사본을 <span class="hl-blue">다른 컴퓨터</span>의 디스크 2개에 두었습니다
- 지금은 원본 백업(H:)과 2차 사본(D:·E:)이 <span class="hl-amber">모두 kabkee-main 한 대</span>에 있습니다
- <span class="hl-red">컴퓨터 단위 사고(랜섬웨어·도난·전원)</span>에 3벌이 함께 노출 → <span class="hl-amber">주간회의 논의</span> (p.38)

</div>
</div>

---

## 🧯 10월에 추가된 운영 함정

| 함정 | 무슨 일이 있었나 | 앞으로의 원칙 |
|---|---|---|
| 평소 변경이 적으면 장소 단위로 충분하다? | 하루 4~11개였지만 <span class="hl-red">XML 일괄 수정 하루</span>가 장소 71곳을 건드림 | <span class="hl-green">«얼마나 자주»가 아니라 «얼마나 흩어지나»</span>까지 시험 |
| 안전장치에 걸리면 승인하면 된다? | 승인했다면 57GB가 1년 보관 + 디스크 2개에 복사 | <span class="hl-green">먼저 실제 변경을 확인</span>하고, 방식이 틀렸으면 고친 뒤 처리 |
| 파일 종류별로 따로 백업하면 효율적이다? | XML만 따로 하면 jpg 대량 변경 날 같은 문제 재발 | <span class="hl-green">«바뀐 파일만»</span>이 기준 |
| 오래된 tar는 날짜만 보고 지우면 된다? | 변경분 방식에선 오래된 기준 tar를 <span class="hl-red">최신 목록표가 계속 참조</span> | <span class="hl-green">참조 계산 후 삭제</span> · 못 읽으면 안 지움 |
| 기준본 나이는 만든 날부터 센다? | 9/13부터 세면 전환 첫날 <span class="hl-red">2,311곳이 한꺼번에 만기</span> | 채택일(10/22)부터 세고 장소마다 분산 |
| 복원은 tar 하나 풀면 된다? | 변경분 tar엔 바뀐 파일만 있음 · 첫 복원 도구는 권한까지 버림 | <span class="hl-green">`--restore --out-tar` → 서버에서 `tar -xp`</span> |

---

## 🧊 추가 백업 선호안 — 별도 AWS 계정 Glacier Deep Archive <span class="badge">주간회의 논의 · 미결정</span>

<div class="cols">
<div class="col">

### 💰 비용 — 넣고 두는 건 거의 공짜, «꺼낼 때»만 비용

| 항목 (서울 리전 · AWS 공식 가격표) | 단가 | 이번 규모 약 490GB |
|---|---|---|
| 저장 | <span class="hl-green">$0.002 / GB·월</span> | <span class="hl-green">월 약 $1 (약 1,450원)</span> |
| 올리기 (PUT 요청) | $0.06 / 1,000건 | 첫 업로드 tar 2,311개 약 $0.2 · 매일 몇 개는 사실상 0 |
| 올리기 (전송) | 무료 | 0 |
| 꺼내기 준비 (대량 · 최대 48시간) | $0.005 / GB | 전체 약 $2.5 · 장소 1GB 약 7원 |
| 내려받기 (인터넷 전송) | $0.126 / GB | <span class="hl-amber">전체 약 $50~62</span> · 장소 1GB 약 190원 |

</div>
<div class="col">

### 🗑️ 삭제 규칙 — <span class="hl-red">180일 전에 지우면 6개월치는 낸다</span>

- 올리자마자 지워도 <span class="hl-amber">월 비용 × 6개월</span>이 청구됩니다 (490GB 기준 약 $6) → 계산과 예시는 p.39

### 🔐 설계 원칙

- <span class="hl-green">별도 AWS 계정</span> → 지금 계정에 사고가 나도 남음
- kabkee-main에는 <span class="hl-green">«올리기만 되고 지우기는 안 되는»</span> 권한만 부여 → 이 컴퓨터가 감염돼도 못 지움

</div>
</div>

> 출처: AWS 공식 가격 파일 `AmazonS3GlacierDeepArchive` · `AmazonS3` · `AWSDataTransfer` (서울 리전, 10/23 조회) · S3 문서 「Comparing the Amazon S3 storage classes」(최소 보관 180일 · 객체당 메타데이터 40KB — tar 묶음이라 무시 수준). 내려받기 금액은 월 100GB 무료 전송분 사용 여부에 따라 달라집니다.

---

## 🗑️ Deep Archive 삭제 비용 — 180일 전에 지우면 «월 비용 × 6개월»을 냅니다

<div class="cols">
<div class="col">

### 규칙 (S3 문서 · 서울 공식 가격표)

- 최소 보관 기간 <span class="hl-red">180일</span>
- 그 전에 <span class="hl-amber">지우거나 덮어쓰면</span> 남은 일수만큼의 저장비를 그 자리에서 한 번에 청구 (`EarlyDelete-GDA` $0.002 / GB·월, 일할 계산)
- 계산식: <span class="hl-blue">용량(GB) × $0.002 × (180 − 보관한 날) ÷ 30</span>
- 그래서 «언제 지우든» 객체 하나당 <span class="hl-amber">최소 180일치 저장비</span>는 반드시 나갑니다. 그 이상의 위약금은 없습니다

### 490GB 전체를 올렸다가 지우는 경우

| 지운 시점 | 이미 낸 저장비 | 삭제 때 추가 청구 | 총액 |
|---|---|---|---|
| <span class="hl-red">올리자마자 (0일)</span> | $0 | <span class="hl-red">$5.88 = 월 $0.98 × 6</span> | 약 8,700원 |
| 30일 뒤 | $0.98 | $4.90 (5개월치) | 약 8,700원 |
| 90일 뒤 | $2.94 | $2.94 (3개월치) | 약 8,700원 |
| 180일 뒤 | $5.88 | <span class="hl-green">$0</span> | 약 8,700원 |

</div>
<div class="col">

### 우리 운영에서 생기는 경우

| 상황 | 영향 (추정) |
|---|---|
| 매일 올리는 변경분 tar (평소 수십 KB~수 MB) | 30일 보관 뒤 지워도 180일치 — <span class="hl-green">1원 미만</span> |
| 기준점 재생성 (장소마다 45~59일) → 옛 기준 tar 삭제 | 1GB 장소 1곳당 약 $0.009 (약 13원) |
| 10/22 같은 일괄 변경 71곳이 한꺼번에 기준 재생성 | 57GB 기준 약 $0.5 (약 730원) |
| 시험 삼아 전체를 올렸다가 «안 쓰기로» 하고 바로 삭제 | <span class="hl-red">약 $6 (약 8,700원)</span> |

### 🔑 그래서

- Deep Archive 사본은 <span class="hl-green">로컬 보관 규칙(30일·월 1개 12개월)을 그대로 따르지 않고</span>, 180일 미만 삭제를 피하는 쪽으로 따로 정하는 것이 맞습니다 (구현 때 결정)
- 금액 자체가 작아서 «실수로 지워도 큰돈은 안 나간다» — 다만 <span class="hl-amber">0원은 아니다</span>

</div>
</div>

---

<!-- _class: closing -->
<!-- _paginate: false -->

## 정리

<span class="hl-gray">9/14 원안</span> — 캐시가 만든 비용은 <span class="hl-green">설정으로 끄고</span>, 설정으로 못 지우는 파일 항목 기록은 <span class="hl-green">파일시스템 교체로 없앴습니다</span>. 파일 1,657만 개는 <span class="hl-green">AWS 밖에 검증된 사본</span>으로 확보했고, 매일 바뀐 장소를 받아 디스크 2개에 복사하기로 했습니다.

<span class="hl-blue">10/23 개정</span> — 10/22 XML 88개 수정이 장소 71곳 57.2GiB 재다운로드로 번질 뻔해, <span class="hl-green">바뀐 파일만 받는 변경분 세대</span>로 전환했습니다. 막힌 57.2GiB는 승인하지 않고 새 방식으로 <span class="hl-green">2.3MB</span>에 처리했습니다. 복원 도구의 권한 보존도 <span class="hl-green">10/23에 고쳤습니다</span>. 사본 3벌이 한 컴퓨터에 있는 문제(랜섬웨어 한 번에 전부 손실 가능)는 <span class="hl-amber">주간회의에서 추가 백업 방식을 논의</span>합니다(선호안 Deep Archive).

<hr>

Indyspot AI Corp &nbsp;·&nbsp; Engineering Manager &nbsp;·&nbsp; 2026-09-14 작성 &nbsp;·&nbsp; 2026-10-23 개정
