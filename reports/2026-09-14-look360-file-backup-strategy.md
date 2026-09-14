---
marp: true
theme: clean
paginate: true
title: Look360 파일 백업 전략 — S3 Files 비용 사고 정리 · 로컬 전체 백업 · 장소 단위 증분 갱신 설계
---

<!-- _class: cover -->
<!-- _paginate: false -->

# Look360 파일 백업 전략

## S3 Files 비용 사고 정리 &nbsp;·&nbsp; 로컬 전체 백업 &nbsp;·&nbsp; 장소 단위 증분 갱신

<hr>

Indyspot AI Corp &nbsp;·&nbsp; Engineering Manager &nbsp;·&nbsp; 2026-09-14

---

<!-- _class: agenda -->

## 한 장 요약 — 「캐시가 만든 비용을 끄고, 백업은 AWS 밖에 두기로」

<div class="cols">
<div class="col">

### 💸 무슨 일이 있었나

- 9/3 권한 복구 작업이 파일 1,657만 개를 다시 쓰면서 <span class="hl-red">9월 12일간 평소보다 $228</span> 추가 청구
- 서버용 캐시(고성능 스토리지)에 <span class="hl-red">439GB</span>가 쌓여 매일 $4.84씩 과금

### 🛠️ 지금까지 한 조치

- 캐시 자동 적재 끄기 + 만료 1일 → <span class="hl-green">439GB → 195GB, 계속 감소</span>
- 파일 현재 버전 <span class="hl-green">16,566,507개 전체를 dsgn에 백업·전수 검증</span>
- 중복 구버전 약 1,630만 개 정리 착수 (고유본 21,192개는 먼저 백업)

</div>
<div class="col">

### ✅ 백업 결정

- AWS Backup(월 <span class="hl-red">11.5~16.4만원</span>) 대신 <span class="hl-green">로컬 백업 + 버저닝 30일</span>
- 갱신은 <span class="hl-green">바뀐 장소만 다시 받는 증분 방식</span>, 예상 월 <span class="hl-blue">1,500~4,500원</span>

### 🎯 오너 결정 대기

- 무인 실행용 인증 방식 · 갱신 주기 · 알림 방식
- 구현 착수 지시 (구현은 약 1~2일 규모)

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
- 캐시 <span class="hl-blue">439GB → 195GB</span> (9/14 12:00)

</div>
</div>

---

## ⚖️ Azure 시절과 비교한 월 비용

파일 저장 계층만 비교했습니다. Azure는 7월 실청구, AWS는 실측 용량 × 청구서 단가입니다(환율 1,479.5원).

| 구분 | 월 비용 | Azure 대비 |
|---|---|---|
| Azure (데이터 디스크 + 스냅샷 + 백업 볼트) | 154,781원 | 기준 |
| AWS — 캐시 439GB가 쌓였을 때 | <span class="hl-red">256,383원</span> | <span class="hl-red">+66%</span> |
| AWS — 캐시를 비운 뒤 | <span class="hl-green">약 38,500원</span> | <span class="hl-green">−75%</span> |
| AWS — 캐시 비움 + 중복 구버전 정리 | <span class="hl-green">약 20,000원</span> | <span class="hl-green">−87%</span> |

> 이전 결정 자체는 옳았습니다. <span class="hl-amber">S3 Files의 기본 캐시 설정</span>이 켜진 채 대량 작업을 만난 것이 비용을 뒤집었습니다.

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

## ✅ 왜 B를 선택했나

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

### 감수하는 것

- dsgn이 <span class="hl-amber">켜져 있어야</span> 갱신됩니다 (절전 안 함 설정 확인)
- 갱신 사이의 변경은 버저닝 30일 창에 의존합니다
- 로컬 디스크 1개라 <span class="hl-amber">두 번째 사본</span>을 권장합니다

</div>
</div>

---

## 🔄 구현 방식 — 장소 단위 증분 갱신

| 순서 | 동작 | 이유 |
|---|---|---|
| ① | S3 Inventory가 매일 전체 파일 목록(키·크기·ETag·수정시각) 생성 | 1,657만 개를 직접 조회하지 않음 · 1회 약 $0.04 |
| ② | 새 목록과 지난 목록을 <span class="hl-blue">장소 폴더별로 비교</span> | 추가·내용 변경·삭제가 있는 장소만 골라냄 |
| ③ | 바뀐 장소는 <span class="hl-green">현재 상태 전체를 새 tar로</span> 받기 | 복원 시 최신 tar 하나만 풀면 끝 |
| ④ | 권한만 바뀐 파일(ETag 동일)은 기록만 | 9/3 같은 대량 권한 변경에도 재다운로드 없음 |
| ⑤ | tar sha256 + 파일별 md5 검증 | 기존 검증 스크립트 재사용 |
| ⑥ | 장소별 tar <span class="hl-green">최근 3세대 보관</span> | 잘못된 업데이트가 반영돼도 되돌릴 수 있음 |

> 장소 하나를 통째로 다시 받아도 비용은 작습니다: 중간값 49MB는 1원 미만, 재생성된 `pano/1/1773/`(0.5GB)은 약 80원, 가장 큰 `pano/0/100/`(8GB)도 약 1,500원입니다(추정).

---

## ⚖️ 장소 단위 vs 파일 단위

| 항목 | 파일 단위 증분 | <span class="hl-green">장소 단위 갱신 (선택)</span> |
|---|---|---|
| 장소 일부만 수정됐을 때 받는 양 | <span class="hl-green">바뀐 파일만</span> | 장소 전체 |
| 파노라마 재생성·신규 업로드 | 사실상 장소 전체 | 장소 전체 |
| 복원 절차 | 기준 tar + 증분 tar를 날짜순으로 전부 풀고 삭제 기록 반영 | <span class="hl-green">최신 tar 하나</span> |
| 복원 실수 가능성 | <span class="hl-red">높음</span> (순서·누락) | <span class="hl-green">낮음</span> |
| 로컬 용량 | 가장 적음 | 보관 세대 수만큼 증가 |
| 기존 백업과의 연속성 | 새 구조 필요 | <span class="hl-green">장소별 tar 구조 그대로</span> |

> 사고가 났을 때 필요한 것은 <span class="hl-amber">빠르고 틀리지 않는 복원</span>입니다. 약간의 추가 다운로드를 감수하고 복원 단순성을 택했습니다.

---

## 🧰 필요한 것과 비용

<div class="cols">
<div class="col">

### AWS 설정

- 목록 저장용 버킷 1개 신규 (90일 자동 삭제)
- `look360-v1-files` 에 Inventory 설정 추가 (매일 · 현재 버전 · 크기/수정시각/ETag)
- 버킷 전체 <span class="hl-green">구버전 30일 보관 규칙</span> (임시 1일 규칙 교체)
- <span class="hl-amber">무인 실행용 읽기 전용 인증</span>

### dsgn 설정

- 갱신 스크립트 (기존 묶기·검증 코드 재사용)
- WSL cron 매일 새벽 실행
- 실패·이상 변경량 시 Slack 알림

</div>
<div class="col">

### 예상 비용 (추정)

| 항목 | 금액 |
|---|---|
| Inventory 목록 | 1회 약 $0.04 |
| 바뀐 장소 다운로드 | 대부분 무료 전송분 안 |
| 조회 요청 | 1만 건 약 $0.0035 |
| **월 합계** | **약 $1~3** |

### 일정

- 첫 Inventory 목록: 설정 후 최대 48시간
- 구현·시험: 약 1~2일 (추정)

</div>
</div>

---

## 🔑 무인 실행용 인증 — 어떤 방식이 필요한가

현재 로그인(SSO)은 최대 1일이라 매일 자동 실행에는 쓸 수 없습니다.

| 방식 | 보안 | 설정 난이도 | 판단 |
|---|---|---|---|
| <span class="hl-green">읽기 전용 IAM 사용자 + 액세스 키</span> | 키는 만료가 없음 · 권한을 «이 버킷·목록 읽기»로 제한 → 유출 시 <span class="hl-amber">파일 열람은 가능</span>하지만 <span class="hl-green">수정·삭제 불가</span> | 쉬움 | <span class="hl-green">추천</span> (90일마다 교체) |
| IAM Roles Anywhere | 인증서로 임시 자격증명 발급 · 오래 쓰는 키 없음 | 인증서·신뢰 설정 필요 | 보안을 더 중시할 때 |
| SSO 로그인 | 안전 | 쉬움 | <span class="hl-red">매일 로그인 필요 → 자동화 불가</span> |

> 🔴 관리자 권한 액세스 키는 만들지 않습니다. 참고: SSO 세션은 <span class="hl-amber">CLI 로그인 시각이 아니라 브라우저 포털 로그인 시각</span>부터 계산되는 것으로 보입니다(9/14 토큰 기록 기반 추정).

---

## 🎯 오너 결정 대기와 후속 일정

<div class="cols">
<div class="col">

### 결정할 것

| 항목 | 추천 |
|---|---|
| 인증 방식 | 읽기 전용 액세스 키 |
| 갱신 주기 | 매일 새벽 |
| 알림 | 실패·이상 시 + 주간 요약 |
| 두 번째 사본 | 월 1회 다른 디스크로 복사 |
| 구현 착수 | 지시 대기 |

</div>
<div class="col">

### 예정된 후속 작업

- <span class="badge-date">9/16~17</span> 구버전 정리 완료 확인 → 임시 1일 규칙을 <span class="hl-green">버킷 전체 30일 규칙</span>으로 교체
- <span class="badge-date">9/17 10:00</span> Slack 자동 보고 — 캐시 용량 + 교체 시점 알림
- 월 예산 알림 금액 재조정 (현재 $200 · CloudWatch $300)
- 로그인 세션 1일 설정 적용 여부 확인

</div>
</div>

---

## 🧯 이번에 확인한 운영 함정

| 함정 | 무슨 일이 있었나 | 앞으로의 원칙 |
|---|---|---|
| ETag가 다르면 내용이 다르다? | ETag가 다른 구버전 25만 개 대부분이 업로드 방식 차이일 뿐 같은 내용 | <span class="hl-green">체크섬(CRC64)·md5로 확인</span> |
| 옆 버전과 같으면 사본이다? | A→A→B→C→B 체인에서 현재와 다른 구버전을 놓침 | <span class="hl-green">반드시 현재 버전과 비교</span> |
| 빠르게 지우면 빨리 끝난다? | 동시 삭제 128개 → S3 속도 제한 | <span class="hl-green">대량 삭제는 lifecycle에 맡기기</span> |
| 종료 기록이 있으면 완료다? | 로그인 만료로 전부 실패한 다운로드를 완료로 판정 | <span class="hl-green">종료코드 + 개수 대조까지</span> |
| 캐시는 성능에 도움된다? | 방문자는 CloudFront를 쓰고 캐시는 비용만 증가 | <span class="hl-green">자동 적재 끄기 유지</span> |

---

<!-- _class: closing -->
<!-- _paginate: false -->

## 정리

캐시가 만든 비용은 <span class="hl-green">설정으로 끄고</span>, 파일 1,657만 개는 <span class="hl-green">AWS 밖에 검증된 사본</span>으로 확보했습니다. 앞으로는 <span class="hl-green">바뀐 장소만 매일 받아</span> 월 수천 원으로 최신 백업을 유지합니다.

<hr>

Indyspot AI Corp &nbsp;·&nbsp; Engineering Manager &nbsp;·&nbsp; 2026-09-14
