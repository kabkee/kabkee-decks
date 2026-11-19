---
marp: true
theme: clean
paginate: true
title: S3 Files 와 WebP 전환 — 전환 작업이 S3 Files 비용에 주는 영향
---

<!-- _class: cover -->
<!-- _paginate: false -->

# S3 Files 와 WebP 전환

## 전환 작업을 어떻게 하면 S3 Files 비용이 늘지 않는가

<hr>

Indyspot AI Corp &nbsp;·&nbsp; 2026-11-19 &nbsp;·&nbsp; 「레거시 큐브 타일 WebP 전환 실행 계획」 부속 자료

---

<!-- _class: agenda -->

## 요약 — 전환을 서버 폴더가 아니라 S3 API 로만 하면 S3 Files 비용은 거의 늘지 않습니다

<div class="cols">
<div class="col">

### ① S3 Files 란
- 운영 서버의 `/var/www/html/files` 는 서버 디스크가 아니라 S3 버킷 `look360-v1-files` 를 **폴더처럼 붙여 놓은 것**입니다
- 서버가 쓴 파일은 약 1분 뒤 S3 에 반영됩니다 · 원본은 S3 입니다
- 관람자가 받는 타일은 CloudFront 가 **S3 에서 직접** 가져오므로 S3 Files 를 거치지 않습니다

### ② 요금이 붙는 세 가지
- **목록 정보**: 서버 폴더에서 한 번이라도 보인 파일마다 10KiB 이상 · 월 $0.33/GB · 계속 유지
- **읽기** $0.03/GB · **쓰기** $0.07/GB (서버 폴더를 거칠 때만)

</div>
<div class="col">

### ③ 전환 방식별 차이
- <span class="hl-red">서버 폴더로 변환</span>: 1회 약 $23~26 + 목록 정보 월 약 $39 증가 (JPG 를 지울 때까지)
- <span class="hl-green">S3 API 로 변환 (계획안)</span>: 읽기·쓰기 0원 · 목록 정보 증가는 시범 장소에서 실측해 확정

### ④ 지켜야 할 것
- 읽기는 kabkee-main 로컬 백업, 업로드·삭제는 S3 API
- 서버 폴더는 **정확한 경로 몇 개**만 확인
- 시범 전후로 `Inodes` 지표를 비교해 직접 업로드의 영향을 확정

</div>
</div>

---

## S3 Files 의 특징 — WebP 전환에 관계되는 것만

| 특징 | WebP 전환에 주는 의미 | 근거 |
|---|---|---|
| 서버 폴더와 S3 버킷은 같은 데이터입니다 | WebP 를 S3 에 올리면 서버 PHP 도 같은 파일을 봅니다 | 서버 쓰기 → 약 1분 뒤 S3 반영 |
| 관람자 타일은 CloudFront → S3 로 바로 갑니다 | 전환 후 관람 트래픽은 S3 Files 요금과 무관합니다 | CloudWatch 데이터 읽기 하루 0~0.34GB (11월) |
| 서버 폴더에서 파일을 조회하면 그 파일의 **목록 정보(inode)** 가 생기고, 개당 최소 10KiB 로 과금됩니다 | 서버 폴더로 WebP 1,224만 개를 쓰면 약 117GB 가 늘어 월 약 $39 | 1,661만 개 × 10KiB ≈ 158GB = 실제 청구 158.3 GB-월 |
| 목록 정보는 자동으로 사라지지 않습니다 | 한 번 늘면 해당 파일을 지울 때까지 남습니다 | 1,659만 개(09-19) → 1,661만 개(11-18) 로 그대로 |
| 읽기·쓰기 요금은 서버 폴더를 거칠 때만 붙습니다 | S3 API 로 직접 읽고 쓰면 0원입니다 | Cost Explorer `APN2-Files-Read` $0.03/GB · `-Write` $0.07/GB |
| 서버 폴더에서 `find` · `du` · `ls -R` · `rm -r` 를 쓰면 하위 전체를 조회합니다 | 변환·검증·삭제에 서버 폴더 일괄 명령을 쓰면 안 됩니다 | AGENTS.md «서버 마운트 순회 금지» |
| 파일마다 소유자·권한 값이 S3 메타데이터로 붙어 있습니다 | WebP 를 올릴 때 같은 값(`file-owner: 33` · `file-permissions: 0100664`)을 넣어야 서버가 읽을 수 있습니다 | `head-object` 실측 |

---

## 전환 방식별 S3 Files 비용 — 타일 1,224만 개 · 275.6GB 기준

| 항목 | 서버 폴더에서 변환 | <span class="hl-green">S3 API 로 변환 (계획안)</span> |
|---|---|---|
| JPG 읽기 | 275.6GB × $0.03 = **$8.3** | 0원 · kabkee-main 로컬 백업에서 읽음 |
| WebP 쓰기 | 215~245GB × $0.07 = **$15~17** | 0원 · S3 API 업로드 (S3 요청 요금 약 $55 는 별도, 계획 덱에 포함) |
| 목록 정보 | 1,224만 개 × 10KiB ≈ 117GB → <span class="hl-red">월 약 $39 증가</span> | <span class="hl-amber">미확인</span> · 서버 폴더가 그 경로를 조회할 때만 생기는 것으로 추정 |
| 서버 부하 | 운영 웹과 CPU·네트워크를 나눠 씀 | 없음 |
| 사고 위험 | 일괄 명령 한 번으로 버킷 전체 목록 정보가 생길 수 있음 | 서버 폴더를 건드리지 않음 |

- 목록 정보 증가는 **JPG 와 WebP 가 같이 있는 기간**에만 생깁니다. JPG 를 지우면 개수는 지금과 같아집니다(삭제할 때 목록 정보가 같이 빠지는지도 시범에서 확인).
- 계획 덱의 절감액(저장 월 $0.8~1.5 · 트래픽 1TB 초과 시 타일 1TB 당 월 $20~27)과 비교하면, 서버 폴더 방식의 월 $39 는 **절감액보다 큽니다.** 그래서 S3 API 방식만 씁니다.

---

## 전환 중 지켜야 할 것

| 단계 | 할 일 | 하지 않을 것 |
|---|---|---|
| 읽기 | kabkee-main 로컬 백업(`/mnt/h/look360-v1-files-backup-20260913/`)에서 JPG 를 읽습니다 | 서버 폴더에서 읽기 |
| 업로드 | S3 API 로 올리고 `ContentType: image/webp` + 소유자·권한 메타데이터를 같이 지정합니다 | 서버에서 `cp` · `rsync` |
| 존재 확인 | 백업 목록표 또는 `head-object` 로 확인합니다 | 서버 폴더 `ls` · `find` |
| 서버 쪽 확인 | 시범 장소에서 **정확한 경로 1~2개**만 열어 서버 PHP 가 읽는지 봅니다 | 폴더 전체 대조 |
| JPG 삭제 | S3 API `delete-objects` 로 지웁니다 (백업 확인 후) | 서버에서 `rm` · `rm -r` |
| 영향 측정 | 시범 업로드 전후로 CloudWatch `AWS/S3/Files` `Inodes` 를 비교합니다 | — |

<span class="hl-amber">시범 판정</span> 시범 3곳의 타일 수만큼 `Inodes` 가 늘면 직접 업로드도 목록 정보를 만든다는 뜻입니다. 그 경우 장소 단위로 «WebP 업로드 → 확인 → JPG 삭제» 간격을 짧게 잡아 같이 있는 기간을 줄입니다.

---

## 지금의 S3 Files 비용과 WebP 전환의 관계

| 항목 | 값 |
|---|---|
| 지금 S3 Files 비용 | 월 약 $52 (목록 정보 1,661만 개 ≈ 158GB) + 읽기 월 $2~5 |
| WebP 전환 후 (S3 API 방식) | 변화 없음 · JPG 가 WebP 로 바뀌어도 파일 개수는 같습니다 |
| 이 비용을 줄이는 방법 | WebP 전환과 별개의 과제입니다 (목록 정보는 파일시스템을 새로 만들어야 지워짐) |

<span class="hl-gray">정리</span> WebP 전환은 S3 Files 비용을 줄이지도 늘리지도 않게 진행합니다. S3 Files 비용 절감은 따로 결정합니다.

---

## 측정 방법과 근거

| 항목 | 방법 |
|---|---|
| 요금 단가 | Cost Explorer `GetCostAndUsage` 사용 유형 `APN2-Files-TimedStorage-ByteHrs` ($0.33/GB-월) · `APN2-Files-Read` ($0.03/GB) · `APN2-Files-Write` ($0.07/GB) · 2026-08-01~11-17 청구액 ÷ 사용량 |
| 목록 정보 개수 | CloudWatch `AWS/S3/Files` `Inodes` (`fs-05467532f91faba9d`, 09-15~11-18 일별 최대값) |
| 관람 트래픽 경로 | CloudWatch `DataReadBytes` (11월 하루 0~0.34GB) · CloudFront 배포 `E134ZI2PZY55NN` |
| 타일 규모 | 백업 목록표 `state/pano__*.csv.gz` 의 `mres_*/l*/*.jpg` (2026-11-17 기준) |
| 파일 메타데이터 | `head-object pano/0/329/53/mres_f/l1/1/l1_f_1_1.jpg` |
| 조회 방식 | 관리자 SSO 로 조회만 · 서버 폴더 순회 없음 · 설정 변경 없음 |
| 미확인 | S3 API 로 직접 올린 파일에도 목록 정보가 생기는지 · S3 에서 지운 파일의 목록 정보가 같이 빠지는지 (둘 다 시범에서 측정) |

---

<!-- _class: closing -->
<!-- _paginate: false -->

## 감사합니다

WebP 전환은 kabkee-main 로컬 백업에서 읽고 S3 API 로 올리면 S3 Files 비용이 거의 늘지 않습니다. 서버 폴더로 변환하면 월 약 $39 가 늘어 절감액을 넘기 때문에 쓰지 않습니다.

Indyspot AI Corp &nbsp;·&nbsp; 2026-11-19
