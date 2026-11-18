---
marp: true
theme: clean
paginate: true
title: 레거시 큐브 타일 WebP 전환 실행 계획 — 시범 3곳 → 점진 전환
---

<!-- _class: cover -->
<!-- _paginate: false -->

# 레거시 큐브 타일 WebP 전환 실행 계획

## 시범 장소 3곳 통째 전환 → 나머지 점진 전환 · kabkee-main 에서 천천히

<hr>

Indyspot AI Corp &nbsp;·&nbsp; 2026-11-18 &nbsp;·&nbsp; 11-13 «files/pano WebP 전환 검토» 후속

---

<!-- _class: agenda -->

## 결론 — 효과는 저장비가 아니라 CloudFront 전송비에서 나오므로, 전송량 확인부터 시작합니다

<div class="cols">
<div class="col">

### ① 범위
- <span class="hl-blue">`mres_*` 큐브 타일만</span> · 1,758곳 · 1,224만 개 · 275.6GB
- `512_` · `1024_` 는 2차, 썸네일·og·GIF·첨부는 제외

### ② 화질과 용량
- 레거시는 원본이 없어(`retouched` 2개뿐) <span class="hl-amber">JPG q60 → WebP 재인코딩</span>만 가능
- WebP q70 = <span class="hl-green">−16.4%</span> (SSIM 0.959) · q75 = −11.2% (0.963)

</div>
<div class="col">

### ③ 핵심 설계
- 장면마다 <span class="hl-blue">확장자 값 `tile_ext`</span> · XML 생성기가 이 값을 읽음
- 레거시 생성기는 편집할 때마다 XML 을 다시 쓰며 `.jpg` 를 고정 → <span class="hl-red">XML 만 고치면 되돌아감</span>
- JPG 는 관찰 기간 동안 유지 · 롤백 = 값만 되돌림

### ④ 실행 위치
- <span class="hl-green">kabkee-main</span> · 로컬 백업에서 읽어 다운로드 비용 0원
- 1회 비용 약 $55 (업로드 요청) · 하루 30~50곳 · 4~8주

</div>
</div>

---

## 🎯 결정 필요 — 오너 확인 사항

| # | 결정할 것 | 제안 |
|---|---|---|
| 1 | CloudFront 월 전송량 확인 방법 | 콘솔(Billing·Cost Explorer)에서 직접 확인, 또는 CloudWatch 읽기 권한 프로필 발급 |
| 2 | 시범 장소 3곳 | 크기 소·중·대 1곳씩 + 그중 1곳은 커스텀·다국어 XML 사용 장소 |
| 3 | 품질값 | 시범 장소에서 <span class="hl-blue">q70 · q75</span> 를 뷰어로 나란히 비교한 뒤 결정 |
| 4 | JPG 삭제 시점 | 관찰 <span class="hl-blue">30일</span> 후 · 백업 대조 완료분만 · `files/pano` 삭제 금지 규칙에 따라 오너 승인 필수 |
| 5 | 버킷 이전 버전 만료 규칙 | 버전 관리가 켜져 있으면 삭제해도 용량이 안 줄어듦 → 만료 규칙 추가 여부 |
| 6 | 진행 방식 | 에픽 발주 또는 직접 구현 (오빠 지시 필요) |

---

## 먼저 바로잡을 전제 — 저장 용량으로 아끼는 돈은 월 $1 수준입니다

| 구분 | 계산 | 월 절감 (추정) |
|---|---|---|
| S3 저장 | 275.6GB × 16% ≈ 44GB × $0.025 | <span class="hl-gray">약 $1.1</span> |
| CloudFront 전송 (타일 1TB/월 가정) | 1TB × 16% ≈ 160GB × $0.12 | 약 $19 |
| CloudFront 전송 (타일 5TB/월 가정) | 5TB × 16% ≈ 800GB × $0.12 | <span class="hl-green">약 $95</span> |

- 효과는 **관람자가 받는 타일 양**에 비례합니다. 그래서 전송량 상위 장소부터 바꾸는 것이 맞습니다.
- 실제 월 전송량은 아직 모릅니다. 현재 AWS 프로필(`look360-backup-reader`)은 CloudWatch 조회 권한이 없어 `AccessDenied` 가 났습니다.
- <span class="hl-amber">0단계 판정 기준</span> 전송량을 확인해 월 절감액이 1회 비용(약 $55 + 작업 시간)을 몇 달 안에 회수하는지 봅니다.

---

## 대상 규모 — 장소 1,758곳 · 타일 1,224만 개 · 275.6GB

백업 목록표(`state/pano__*.csv.gz`, 2026-11-17 기준)에서 `mres_[fblrud]/l*/…jpg` 만 집계했습니다. 서버 마운트는 순회하지 않았습니다.

| 지표 | 값 |
|---|---|
| 장소 수 | 1,758곳 |
| 타일 수 · 용량 | 12,246,880개 · 275.6GB |
| 장소당 중앙값 | 50MB |
| 장소당 상위 10% | 407MB 이상 |
| 가장 큰 장소 | `100` 5.9GB · `137` 3.5GB · `861` 2.4GB · `66` 2.3GB · `314` 1.7GB |

원본 이미지(`retouched` · `origin`)는 버킷 전체에서 20개뿐이라, 레거시 장소는 **원본에서 다시 생성하는 방식을 쓸 수 없습니다.**

---

## 범위 — XML 의 `<cube url>` 한 줄로만 참조되는 타일만 바꿉니다

| 대상 | 처리 | 이유 |
|---|---|---|
| `mres_*/l*/…jpg` 큐브 타일 | <span class="hl-green">전환</span> | 전체 JPG 의 78% · XML `<level><cube url>` 에서만 참조 |
| `512_*` · `1024_*` 모바일·태블릿 큐브 | <span class="hl-amber">2차</span> | `VrShareModal.vue` 등 XML 밖에서도 `.jpg` 고정 참조 |
| `pv.jpg` (미리보기 큐브 띠) | <span class="hl-gray">유지</span> | 작고, 생성기마다 별도 리터럴 |
| `view_*` · `imglink_*` (썸네일·og) | <span class="hl-gray">유지</span> | og:image · 메일 · 폴백 리터럴 수십 곳 |
| `imglink_*.gif` · 게시판 첨부 · 장소 사진 | <span class="hl-gray">범위 밖</span> | 타일이 아님 |

---

## 왜 «XML 만 고치면 끝»이 아닌가

레거시 XML 생성기는 **DB 를 기준으로 투어 XML 을 통째로 다시 쓰고**, 타일 확장자를 `.jpg` 로 고정합니다. 핫스팟·스티커를 편집할 때마다 이 생성기가 돕니다.

```php
// a.createCyberTourXML.php:523 · :525
'/mres_%s/l' . $countOfPanoLevelsReverse . '/%v/l' . $countOfPanoLevelsReverse . '_%s_%v_%h.jpg'
```

| 상황 | 결과 |
|---|---|
| XML 만 `.webp` 로 고치고 JPG 유지 | 다음 편집 때 `.jpg` 로 되돌아감 → 절감 효과 사라짐 |
| XML 만 고치고 JPG 삭제 | 다음 편집 때 <span class="hl-red">검은 화면</span> |

투어 XML 예시(`pano/0/329/865.xml`)도 장면마다 `53/mres_%s/l2/%v/l2_%s_%v_%h.jpg` 형태로 적혀 있습니다.

---

## 핵심 설계 — 장면마다 확장자 값을 두고, 생성기가 다시 쓰게 합니다

1. **장면(pano)마다 `tile_ext`** (기본값 `jpg`) 를 DB 에 둡니다.
2. **XML 을 만드는 모든 곳이 이 값을 읽습니다.**
   - 레거시: `a.createCyberTourXML.php` · `_multiLanguage` · `_remote` · `look360_ucc/…/a.getKrpanoXml.php` · `a.krpanoXmlForIndoorMap.php` · `panoTour_customXml.php`
   - 플랫폼: `nestjs-look360-api/src/utils/krpano-xml-builder.ts` · `panostory-xml-builder.ts`
3. 장면 단위 순서를 고정합니다: **WebP 전부 업로드 → 검증 → `tile_ext=webp` → 생성기로 XML 재생성.** 생성기가 쓰면 `xmlBackup/` 도 자동으로 남습니다.
4. **롤백** = `tile_ext=jpg` 로 되돌리고 XML 재생성. 그래서 관찰 기간에는 JPG 를 지우지 않습니다.
5. **장면 스킵 규칙** — 한 장면 안에서는 확장자를 섞을 수 없으므로, 장면 전체 절감률이 <span class="hl-amber">8% 미만</span>이면(질감 많은 숲 장면 등) JPG 로 둡니다.

<span class="hl-amber">미확인</span> 레거시 pano 테이블과 플랫폼 `tile_info` 의 동기화 경로는 이번에 조회하지 못했습니다(MySQL 연결 끊김). 1단계 첫 작업입니다.

---

## 단계 — 읽는 쪽부터, 서비스 동작은 시범 장소에서 처음 바뀝니다

| 단계 | 할 일 | 통과 조건 |
|---|---|---|
| 0 판정 근거 | CloudFront 월 전송량과 `/files/pano/*/mres_*` 비중 확인 | 월 절감액 추정치 확보 |
| 1 읽는 쪽 | `tile_ext` 컬럼 추가 · 생성기 6곳 + 플랫폼 빌더가 값을 읽도록 수정 (기본 `jpg`) | 전 장소 XML 재생성 결과가 바이트 단위로 동일 |
| 2 변환 도구 | kabkee-main 배치 스크립트 (장소 단위 · 재개 가능 · 장부 기록) | 장소 1곳 드라이런 · 실측 절감률 |
| 3 시범 | 레거시 장소 3곳 통째 전환 | 검증 목록 전부 통과 + 2주 관찰 |
| 4 품질 확정 | 시범 장소에서 q70 · q75 비교 | 오너 승인 |
| 5 점진 전환 | 밤 시간대 하루 30~50곳 · 전송량 상위 장소부터 | 일일 장부 · 오류 0건 |
| 6 JPG 정리 | 관찰 기간이 끝난 장소부터 삭제 | <span class="hl-red">오너 승인 필수</span> |

---

## 시범 검증 목록 — 장소 3곳에서 모두 통과해야 다음 단계로 갑니다

| 축 | 확인할 것 |
|---|---|
| 뷰어 | look360.kr 레거시 뷰어 (운영 krpano 는 아직 1.24 배포 전) · 플랫폼 client |
| 기기 | iOS Safari · 안드로이드 Chrome · 카카오톡 인앱 브라우저 · VR 모드 |
| 재생성 | 핫스팟 편집 후 XML 이 다시 쓰여도 `.webp` 유지 |
| CDN | CloudFront Function `look360-files-guard-strip` (배포 `E134ZI2PZY55NN`) 이 `.webp` 를 통과시키는지 |
| 마운트 | 서버 마운트에서 **정확한 경로 1개**로 새 파일이 보이는지 (순회 금지) |
| 메타데이터 | `ContentType: image/webp` · S3 Files 소유자·권한 값 유지 |
| 화질 | 원본 JPG 와 WebP 를 같은 시점에서 나란히 비교 (질감 많은 장면 포함) |
| 전송량 | 시범 장소의 전환 전후 타일 전송량 비교 |

---

## 실행 위치 — kabkee-main 을 추천합니다

| 위치 | 판단 |
|---|---|
| <span class="hl-green">kabkee-main</span> | 원본 JPG 를 로컬 백업(`/mnt/h/look360-v1-files-backup-20260913/tars/`)에서 읽어 **S3 다운로드 비용 0원** · 20코어 · 인코딩 약 44 CPU시간(실측 13ms/타일) |
| AWS 본서버 | <span class="hl-red">비추천</span> · 운영 웹과 CPU 를 나눠 씀 · `/var/www/html/files` 를 건드리면 순회 과금 위험 · S3 API 로만 읽으면 가능은 함 |
| ncore | 보조 작업자로 가능 · 타일 데이터를 먼저 옮겨야 하므로 kabkee-main 이 바쁠 때만 |

- 백업은 하루 단위로 갱신되므로, 변환 직전에 **목록표의 `md5` 와 S3 현재값을 대조**해 바뀐 타일은 S3 에서 새로 받습니다.
- 업로드는 S3 API 로 직접 합니다(서버 마운트 경유 금지).

---

## 비용과 기간 (추정)

| 항목 | 값 | 근거 |
|---|---|---|
| 업로드 요청 | 약 $55 (1회) | PUT 1,224만 건 × $0.0045/1천 |
| 원본 다운로드 | 0원 | 로컬 백업 사용 (S3 에서 받으면 약 $35 추가) |
| 인코딩 | 약 44 CPU시간 | 기존 리포트 실측 13ms/타일 |
| 전환 기간 저장 증가 | 최대 약 +230GB (월 약 $6) | JPG · WebP 공존 기간 |
| 전체 기간 | 약 4~8주 | 밤 시간대 하루 30~50곳 · 업로드 속도가 병목 |

<span class="hl-amber">추정 값</span> 단가는 AWS 서울 공시가 기준이며 실제 청구액과 다를 수 있습니다. 절감률은 기존 리포트의 표본 500장(장소 120곳) 실측 기준이라 장소마다 다를 수 있습니다.

---

## 놓치면 사고가 나는 함정

| 함정 | 대응 |
|---|---|
| 기존 타일에 S3 Files 메타데이터가 있음 (`file-owner: 33` · `file-permissions: 0100664`, `head-object` 실측) | 같은 메타데이터 + `ContentType: image/webp` 를 함께 지정해 업로드 |
| 버킷 버전 관리 (목록표에 `version_id` · 백업에 `noncurrent-unique/`, 설정은 권한 부족으로 미확인) | 켜져 있으면 삭제해도 이전 버전이 남음 → 이전 버전 만료 규칙 필요 |
| `files/pano` 삭제 금지 규칙 (09-03 오너 결정) | 6단계는 백업 대조 후 오너 승인 · 변수 보간 `rm` 금지 |
| 재인코딩 이중 손실 | 장면 스킵 규칙(절감 8% 미만) + 4단계 육안 비교 |
| 일부만 올라간 장면 | 장면 단위로 «전부 업로드 → 검증 → 값 변경» 순서 고정 |
| 서버 마운트 순회 과금 | 존재 확인은 목록표 · `head-object` 로만 |

---

## 측정 방법과 근거

| 항목 | 방법 |
|---|---|
| 대상 규모 | `look360-v1-files` 백업 목록표 `state/pano__*.csv.gz` 1,764개에서 `mres_*/l*/*.jpg` 집계 (2026-11-17 기준) |
| 원본 존재 여부 | 같은 목록표에서 파일명 `retouch` · `origin` 집계 → 20개 |
| XML 형식 | S3 에서 `pano/0/329/865.xml` 1개를 받아 확인 |
| 생성기 고정 지점 | `Look360_ksq1.2` 소스 검색 (`a.createCyberTourXML.php:523` · `:525` 등) |
| 타일 메타데이터 | `head-object pano/0/329/53/mres_f/l1/1/l1_f_1_1.jpg` |
| 화질·용량 비율 | 11-13 «files/pano WebP 전환 검토» 덱의 기존 데이터 재인코딩 실측 |
| 미확인 | CloudFront 전송량 (CloudWatch 권한 없음) · 버킷 버전 관리 설정 (권한 없음) · DB 동기화 경로 (MySQL 연결 끊김) |

---

<!-- _class: closing -->
<!-- _paginate: false -->

## 감사합니다

레거시 큐브 타일은 WebP q70 재인코딩으로 −16% 안팎을 기대할 수 있습니다. 효과는 CloudFront 전송비에서 나오므로 전송량 확인 → 읽는 쪽 수정 → 시범 3곳 → 점진 전환 순서로 진행합니다.

Indyspot AI Corp &nbsp;·&nbsp; 2026-11-18
