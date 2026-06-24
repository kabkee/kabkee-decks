---
marp: true
theme: clean
paginate: true
title: AI 활용 개발 환경 셋업 — 문갑기가 쓰고 있는 툴 실전 가이드
---

<!-- _class: cover -->
<!-- _paginate: false -->

# AI 활용 개발 환경 셋업

## 문갑기가 쓰고 있는 툴 실전 가이드

<hr>

2026-06-24

---

<!-- _class: agenda -->

## 오늘 다룰 도구 7가지

<div class="cols">
<div class="col">

### 📊 발표 도구
1. **Marp CLI** — MD로 슬라이드 만들기

### 🔗 구글 연동
2. **gog CLI** — Drive · Gmail · Calendar 터미널 연동

### 🔒 네트워크 보안
3. **Tailscale** — IP 공개 없이 안전한 원격 접속
4. **OpenVPN** — 기관 내부망 접속 (옵션)

</div>
<div class="col">

### 🤖 AI 개인 비서
5. **Hermes Agent** — 쓸수록 나를 아는 AI 파트너

### 💻 원격 작업
6. **원격 컴퓨터 연동** — SSH · 원격 데스크탑 · NoMachine

### 🎨 AI 디자인
7. **OpenDesign** — 디자인 · 랜딩페이지 · 이미지/영상 올인원

</div>
</div>

---

<!-- _class: sec -->

# 1. Marp CLI

## Markdown → 슬라이드 자동 생성

---

## Marp CLI — 왜 필요한가?

> "PPT 디자인 조정하는 시간을 줄이고, 내용에만 집중하자"

**기존 방식** : PowerPoint/Keynote 열고 → 글자 크기 맞추고 → 정렬하고 → 색 고르고…

**Marp 방식** : `.md` 파일에 내용만 쓰면 → 슬라이드 자동 생성

<div class="cols">
<div class="col">

### 언제 쓰나?
- 발표 자료를 **빠르게** 만들 때
- **git으로 버전 관리**가 필요한 슬라이드
- AI(Claude, GPT)로 내용 생성 후 **바로 슬라이드화**
- 코드 블록이 많은 **기술 발표**

</div>
<div class="col">

### 왜 좋은가?
- Markdown = 텍스트 → **git commit 가능**
- **HTML · PDF · PPT(pptx)** 출력 지원
- 테마는 CSS로 한 번만 만들면 끝
- AI가 내용도 써주고, 슬라이드도 만들어줌

</div>
</div>

---

<style scoped>
section { font-size: 20px; }
pre { font-size: 0.65em; }
blockquote { font-size: 0.5em; margin-top: 6px; }
</style>

## Marp CLI — 설치 & 사용법

<div class="cols">
<div class="col">

```bash
# 설치
npm install -g @marp-team/marp-cli

# MD → HTML 슬라이드 (가장 많이 씀)
marp slide.md -o slide.html

# MD → PPT
marp slide.md -o slide.pptx

# 실시간 미리보기 (저장하면 브라우저 자동 갱신)
marp --watch slide.md
```

</div>
<div class="col">

**MD 파일 맨 위 — Marp 모드 활성화 선언:**

```yaml
---
marp: true
theme: default   # gaia / uncover / 커스텀 CSS 가능
paginate: true
---

# 1번 슬라이드 내용

---

# 2번 슬라이드 — --- 로 페이지 구분
```

> **AI 활용 팁** : "이 내용으로 Marp 슬라이드 MD 작성해줘" → Claude에 그대로 요청!

</div>
</div>

---

<!-- _class: sec -->

# 2. gog CLI

## 구글 서비스를 터미널에서

---

<style scoped>
section { font-size: 20px; }
pre { font-size: 0.65em; }
blockquote { font-size: 0.5em; margin-top: 8px; }
</style>

## gog CLI — 왜 필요한가?

> "AI가 내 구글 캘린더에 일정을 직접 넣어줬으면…"

**gog** = Google-on-CLI. 터미널에서 구글 서비스를 직접 호출하는 도구

<div class="cols">
<div class="col">

### 언제 쓰나?
- AI(Claude, Codex)가 **캘린더 일정 자동 생성/조회**
- 스크립트로 **Google Drive 파일 자동 업로드**
- **Gmail 발송 자동화** (알림 메일, 리포트 등)
- Claude Code에서 **구글 슬라이드 자동 생성**

</div>
<div class="col">

### 설정 흐름 (개념)

```
1. gog auth login
   → 브라우저에서 구글 로그인
   → OAuth2 토큰이 로컬에 저장됨

2. 이후 터미널에서 바로 사용
   gog calendar list
   gog drive upload report.pdf
   gog slides create "발표제목"
```

</div>
</div>

> **설정 주의** : 처음 인증 시 keyring 설정 필요. 서버(headless)는 `--manual` 플래그로 처리.
> 구글 OAuth 앱 등록이 필요해서 초기 설정이 좀 번거로움 — 한 번만 하면 끝!

---

<!-- _class: sec -->

# 3. Tailscale

## IP 공개 없이 어디서나 안전하게 연결

---

## Tailscale — 왜 필요한가?

> "집 컴퓨터를 카페에서 쓰고 싶은데, 포트를 열면 해킹 위험…"

**기존 방식** : 공유기 포트 포워딩 → 내 IP/포트가 인터넷에 노출 → 보안 취약

**Tailscale** : WireGuard 기반 메시 VPN — **아무것도 외부에 공개하지 않고 연결**

<div class="cols">
<div class="col">

### 작동 원리

```
[카페 노트북]          [집 데스크탑]
 100.64.0.1    ←→     100.64.0.2
      ↑                    ↑
      └── Tailscale 가상 IP ──┘
          (외부 인터넷에 노출 없음)
```

- 각 기기에 **가상 사설 IP** (100.x.x.x) 부여
- 이 IP로만 통신 → 방화벽/포트포워딩 불필요

</div>
<div class="col">

### 언제 쓰나?
- **집 서버에 카페에서** 안전하게 접속
- AI 코딩 중 **다른 컴퓨터 자원 활용**
- 팀원과 **로컬 개발 서버 공유** (포트 오픈 없이)
- Codex / opencode-go의 **원격 머신 접근 허용**

</div>
</div>

---

<style scoped>
section { font-size: 20px; }
pre { font-size: 0.65em; }
blockquote { font-size: 0.5em; margin-top: 6px; }
</style>

## Tailscale — 설치 & 설정

<div class="cols">
<div class="col">

```bash
# 설치 (Ubuntu/Debian)
curl -fsSL https://tailscale.com/install.sh | sh

# 로그인 — 브라우저에서 구글/깃허브 계정으로 승인
sudo tailscale up

# 내 Tailscale IP 확인
tailscale ip -4
# → 100.x.x.x (이 IP로 기기 간 통신)

# 연결된 기기 목록 확인
tailscale status
```

</div>
<div class="col">

**접속 예시 :**

```bash
# 집 컴퓨터에 SSH (Tailscale IP 사용)
ssh username@100.64.0.2

# SSH config 파일로 단축키 등록
# ~/.ssh/config
Host home
  HostName 100.64.0.2
  User kabkee
```

> **AI 연동 팁** : Codex / opencode-go / z.ai 같은 오픈소스 모델도
> Tailscale IP로 로컬 서버에 안전하게 연결 가능!

</div>
</div>

---

<!-- _class: sec -->

# 4. OpenVPN

## 기관 내부망을 외부에서 (옵션)

---

## OpenVPN — 언제 필요한가?

> Tailscale로 개인 기기 연결은 해결. 학교·회사 내부망은 OpenVPN.

**Tailscale vs OpenVPN 비교**

| 항목 | Tailscale | OpenVPN |
|------|:---------:|:-------:|
| 설정 난이도 | ⭐ 쉬움 | ⭐⭐⭐ 어려움 |
| 주요 용도 | 개인 기기 간 연결 | 기관 내부망 접속 |
| VPN 서버 | 불필요 (Tailscale이 중계) | 필요 (학교/회사가 운영) |
| 속도 | 빠름 (P2P) | 중간 (서버 경유) |
| 보안 설정 | 자동 | 수동 (인증서 등) |

**언제 쓰나?**
- 학교/회사 **내부 시스템** 외부에서 접속
- 학교 도서관 **전자 학술 자료** 외부 이용
- 인턴/취업 후 **사내망 접속** (IT팀이 설정 파일 제공)

> **결론** : 개인 프로젝트 → **Tailscale 우선**, 기관망 접속 → **OpenVPN**

---

<!-- _class: sec -->

# 5. Hermes Agent

## 쓸수록 나를 아는 AI 파트너

---

## Hermes Agent — 왜 특별한가?

> "ChatGPT는 매번 처음부터 설명해야 하는데… 나를 기억하는 AI가 있으면?"

**Hermes Agent** = 자가 학습 + 영구 기억 + 개인화 AI 에이전트

<div class="cols">
<div class="col">

### 일반 AI vs Hermes

| | 일반 AI | Hermes |
|--|:-------:|:------:|
| 기억 | 대화 종료 시 소멸 | **영구 누적** |
| 개인화 | 없음 | **쓸수록 강해짐** |
| 접근 | 브라우저 | Telegram · Slack · Discord |
| 운영 | 클라우드 종속 | **내 서버 자율 운영** |
| 비용 | 구독료 | 오픈소스 (무료~저렴) |

</div>
<div class="col">

### 언제 쓰나?
- **나만의 AI 비서** (일정 · 메모 · 알림 관리)
- 공부 내용 누적 → **나중에 질문하면 기억함**
- Telegram에서 **언제 어디서나** AI와 소통
- 반복 작업 자동화 (알림, 요약, 분류 등)
- openclaw의 **오픈소스 대체** — 무료로 운영

</div>
</div>

---

<style scoped>
section { font-size: 20px; }
pre { font-size: 0.65em; }
</style>

## Hermes Agent — 운영 방식

<div class="cols">
<div class="col">

**두 가지 운영 방식 중 선택**

```
A. 외부 서버 설치 (24시간 운영 추천)
   ─────────────────────────────
   [집 서버 or Oracle Free Tier (무료)]
   → Tailscale로 보안 접근
   → 24시간 켜 있어서 언제든 응답
   → 새벽에 물어봐도 즉시 답변

B. 개인 노트북 설치 (Hermes Desktop)
   ─────────────────────────────
   → 노트북 켤 때만 활성화
   → 가볍게 시작하기 좋음
```

</div>
<div class="col">

**채널 연동 설정 (개념)**

```
Hermes → Telegram Bot 토큰 설정
       → Slack Webhook URL 등록
       → Discord Bot 연결

사용 예:
  텔레그램에서
  "오늘 내 일정 정리해줘"
  → Hermes가 내 데이터 기반
    개인화 응답
```

</div>
</div>

---

<!-- _class: sec -->

# 6. 원격 컴퓨터 연동

## SSH · 원격 데스크탑 · NoMachine

---

<style scoped>
section { font-size: 19px; }
pre { font-size: 0.63em; }
</style>

## 원격 접속 방법 3가지

<div class="cols">
<div class="col">

### SSH (터미널 접속)
```bash
# 기본 접속
ssh username@100.64.0.2

# 설정 파일로 단축키 등록
# ~/.ssh/config
Host home
  HostName 100.64.0.2
  User kabkee
  IdentityFile ~/.ssh/id_ed25519

# 이후 이렇게만 접속
ssh home
```
**언제** : 코드 작업, 서버 관리, AI 도구 원격 실행

</div>
<div class="col">

### 원격 데스크탑 (Windows GUI)
```
Windows 설정 → 원격 데스크탑 활성화
클라이언트:
  Windows: mstsc → Tailscale IP 입력
  Mac: Microsoft Remote Desktop 앱
```
**언제** : GUI 필요, Windows 전용 프로그램

### NoMachine (Mac/Linux GUI)
```
download.nomachine.com 에서
서버 + 클라이언트 모두 설치
→ Tailscale IP로 접속
```
**언제** : Linux/Mac 빠른 GUI 원격 (RDP보다 쾌적)

</div>
</div>

---

<style scoped>
section { font-size: 20px; }
pre { font-size: 0.65em; }
blockquote { font-size: 0.5em; margin-top: 8px; }
</style>

## Codex로 원격 서버 SSH 접속

> Codex CLI가 SSH 명령을 대신 실행 — 명령어 몰라도 자연어로 OK!

<div class="cols">
<div class="col">

```bash
# Codex 설치
npm install -g @openai/codex

# 자연어로 SSH 작업 지시
codex "100.64.0.2 서버에 접속해서
홈 디렉토리 파일 목록 보여줘"

# 자동 승인 모드 (바로 실행)
codex --approval-mode full-auto \
  "ssh kabkee@100.64.0.2 \
  'ls ~/projects && df -h'"
```

</div>
<div class="col">

**실전 활용 시나리오:**

```
카페 노트북 → Codex CLI
           → 집 서버 (Tailscale)

"빌드 실행해줘"
→ ssh 접속 후 자동 실행

"로그 마지막 100줄 보여줘"
→ 결과 요약까지 해줌

"오류 나는 파일 찾아서 수정"
→ 파일 수정까지 자동
```

> **핵심** : 명령어 안 외워도 됨
> 하고 싶은 걸 말하면 Codex가 SSH로 수행

</div>
</div>

---

<!-- _class: sec -->

# 7. OpenDesign

## 디자인 · 이미지 · 영상 AI 올인원

---

## OpenDesign — 왜 필요한가?

> "디자인 툴은 Figma, 이미지는 Midjourney, 영상은 또 다른 앱… 하나로 안 되나?"

**OpenDesign** (`open-design.ai`) = Claude Design의 오픈 대안 — 디자인 전 과정을 하나의 도구에서

<div class="cols">
<div class="col">

### 무엇을 할 수 있나?
- **랜딩페이지 자동 생성** — 텍스트 설명만으로 완성
- **디자인 샘플** 빠르게 시안 제작
- **이미지 생성** — AI로 소재 즉시 생성
- **동영상 생성** — 홍보영상, 인트로 등
- **한국어 지원** (open-design.ai/ko/)

</div>
<div class="col">

### 언제 쓰나?
- **졸업 작품 발표** 랜딩페이지가 필요할 때
- **포트폴리오** 비주얼 소재 빠르게 제작
- **앱/서비스 UI 시안** 아이디어 단계 시각화
- 디자이너 없이 **1인 개발자** 프로젝트 완성
- Claude Design 유료 구독 **대신** 무료/저렴하게

</div>
</div>

---

<style scoped>
section th:last-child { color: #FDE68A; }
section th:last-child strong { color: #FDE68A; }
</style>

## OpenDesign vs 기존 도구 비교

| 기능 | Figma | Midjourney | CapCut | **OpenDesign** |
|------|:-----:|:----------:|:------:|:--------------:|
| UI 디자인 | ✅ | ❌ | ❌ | ✅ |
| 이미지 생성 | ❌ | ✅ | ❌ | ✅ |
| 영상 생성 | ❌ | ❌ | ✅ | ✅ |
| 랜딩페이지 | ❌ | ❌ | ❌ | ✅ |
| 학습 난이도 | 중간 | 쉬움 | 쉬움 | **쉬움** |
| 가격 | 유료 | 유료 | 무료~ | **무료~** |

**실전 활용 시나리오:**

```
1. 아이디어 설명 입력
   "피트니스 앱 랜딩페이지, 밝고 에너지 넘치는 느낌"

2. OpenDesign이 자동으로
   → 레이아웃 + 이미지 + 텍스트 시안 생성

3. 필요한 부분만 수정 → 텍스트 변경, 색상 조정
```

> **접속** : [open-design.ai/ko](https://open-design.ai/ko/) — 가입 후 바로 사용 가능

---

<!-- _class: sec -->

# 보너스: Claude Code 토큰 절약

## RTK + Serena — Claude Code 전용 최적화 2종 세트

---

<style scoped>
section { font-size: 20px; }
pre { font-size: 0.65em; }
blockquote { font-size: 0.5em; margin-top: 8px; }
</style>

## Claude 토큰 최적화 — RTK & Serena

> Claude Code를 쓴다면: 토큰 = 비용 + 속도. 두 도구로 60~90% 절약 가능.

<div class="cols">
<div class="col">

### 🦀 RTK (Rust Token Killer)

**문제** : `git status`, `cat` 출력이 그대로 컨텍스트에 들어가 토큰 낭비

**해결** : Claude Code Hook으로 명령 출력을 **자동 필터링**

```bash
# Hook 등록 한 번이면 자동 적용
# git status → rtk git status (투명하게 작동)

rtk gain           # 절약량 통계 확인
rtk gain --history # 명령별 이력 조회
rtk discover       # 최적화 가능 명령 탐지
```

- 별도 명령 없이 **기존 명령 그대로** 사용
- 불필요한 출력 라인 제거 → 입력 토큰 대폭 감소

</div>
<div class="col">

### 🔍 Serena (MCP 서버)

**문제** : 파일 전체를 Read해야 심볼/참조를 찾을 수 있어 토큰 낭비

**해결** : LSP(Language Server) 기반 **정밀 코드 탐색**

```
파일 전체 읽기  →  find_symbol / find_declaration
(수천 토큰)         (필요한 심볼만 수십 토큰)

get_symbols_overview   # 파일 구조 개요만 조회
find_referencing_symbols  # 참조 위치만 추출
```

- 코드베이스 이해 시 **파일 통째 읽기** 대신 필요 심볼만
- Claude Code 세션 시작 시 `initial_instructions` 한 번 호출

> **둘 다 Claude Code 전용** — Codex CLI 사용자에겐 해당 없음

</div>
</div>

---

<style scoped>
section { font-size: 20px; }
pre { font-size: 0.65em; }
blockquote { font-size: 0.5em; margin-top: 6px; }
</style>

## 그 외 토큰 절약 — 설정으로 줄이기

<div class="cols">
<div class="col">

### 📄 `.claudeignore`

Claude Code가 읽지 말아야 할 파일·폴더 차단

```
# .claudeignore (프로젝트 루트에 생성)
node_modules/
dist/
*.lock
*.log
coverage/
```

→ 탐색 시 통째로 컨텍스트에 실려오는 낭비 방지

---

### ⚡ `/compact` 명령

대화가 길어지면 히스토리를 **AI가 직접 요약 압축**

```
/compact
→ 현재까지 대화를 요약본으로 교체
→ 이후 토큰 사용량 리셋 효과
```

</div>
<div class="col">

### 🗂️ CLAUDE.md 분리 (Lazy Loading)

전역 CLAUDE.md는 **매 세션 자동 로드** → 짧을수록 유리

```
# 나쁜 예 — 모든 규칙을 전역에 다 쓰기
~/.claude/CLAUDE.md  ← 수백 줄 규칙

# 좋은 예 — 필요한 것만 @참조로 분리
~/.claude/CLAUDE.md  ← 핵심 10줄만
  @rules/api.md       ← API 작업할 때만
  @rules/deploy.md    ← 배포할 때만
```

서브 프로젝트별 `.claude/CLAUDE.md` 분리도 가능
→ 해당 폴더 작업 시에만 로드

> **공통점** : 설정 한 번으로 매 세션 자동 적용 — 별도 명령 불필요

</div>
</div>

---

<!-- _class: sec -->

# 정리

## 나만의 AI 개발 환경 로드맵

---

## 단계별 구축 순서

<div class="cols">
<div class="col">

### Phase 1 — 기초 (1주일)
1. ✅ **Marp CLI** 설치
   → 발표 자료를 MD로 관리 시작
2. ✅ **Tailscale** 설치
   → 노트북 + 집 컴퓨터 + 스마트폰 연결

### Phase 2 — 연결 (2~3주)
3. 🔗 **Codex SSH** 설정
   → Codex CLI로 원격 서버에 자연어로 명령
4. 🔗 **gog CLI** 인증
   → 구글 서비스 터미널 연동

</div>
<div class="col">

### Phase 3 — AI 심화 (한 달+)
5. 🤖 **Hermes Agent** 설치
   → Telegram 연동, 개인화 시작
6. 🤖 **Claude Code / Codex** 원격 서버 실행
   → 노트북 배터리 아끼며 AI 풀 활용
7. 🎨 **OpenDesign** 활용
   → 포트폴리오/발표용 비주얼 AI로 빠르게 제작

### 핵심 원칙 3가지
- **Tailscale 먼저** — 보안 기반 없이 포트 열지 말 것
- **AI에게 도움 받기** — 설정 막히면 그냥 물어봐
- **한 번에 다 하려 하지 말 것** — Phase별로 천천히

</div>
</div>

<hr>

_도구는 수단이다. 일단 하나씩 써보는 것이 가장 빠른 학습이다._
