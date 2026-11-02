#!/usr/bin/env node
/**
 * 주간 업무 보고용 화면 자동 캡처
 *
 * 사용법:
 *   node scripts/capture-weekly.mjs              # 이번 주 수요일 날짜로 저장
 *   node scripts/capture-weekly.mjs 2026-09-02   # 날짜 지정
 *   node scripts/capture-weekly.mjs --only home  # 특정 화면만 (id 부분일치)
 *   node scripts/capture-weekly.mjs --list       # 대상 목록만 출력
 *
 * 출력: weekly-reports/assets/<날짜>/NN-<id>.jpg  (2배 해상도 JPEG — 슬라이드 축소 표시 기준 충분히 선명하고 PNG 대비 1/5 용량)
 *
 * 인증: 관리자(:5277)는 ADMIN 권한을 가진 QC 계정(.env TEST_CLIENT_EMAIL/PASSWORD)으로
 *       client FE(:5174)에 실제 로그인하고, 같은 도메인 쿠키로 어드민에 들어간다 (오너 지시 2026-11-03).
 *       로그인이 실패하면 예전 방식(JWT_ACCESS_SECRET 자가서명 쿠키 주입)으로 대체한다.
 *       🔴 개발 서버 전용. 운영 도메인에는 쓰지 말 것.
 *
 * 실패는 조용히 넘기지 않는다 — 화면별 성공/실패를 표로 출력하고,
 * 한 건이라도 실패하면 exit code 1 로 끝난다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_REPO = '/home/kabkee/projects/Look360_Platform_Project/nestjs-look360-api';

const FE = 'http://100.64.25.50:5174';
const ADMIN = 'http://100.64.25.50:5277';
const API = 'http://100.64.25.50:3001/v1.0';

// ── 캡처 대상 ────────────────────────────────────────────────
// crop: 'hero' 처럼 이름을 주면 아래 CROPS 의 좌표로 잘라 별도 파일도 함께 만든다.
const SHOTS = [
  { id: 'place-page',     site: 'fe',    url: '/place/fzkets8c',          wait: 4500,
    desc: '장소 페이지 신설 — 장소 상세 + 연결 콘텐츠 + 같은 지역 장소 (IND-7753·IND-7841)' },
  { id: 'vr-minibar-mobile', site: 'fe', url: '/vr/1xdrlfot/31636',       wait: 6000, device: 'mobile',
    desc: 'VR 뷰어 모바일 미니바 — 파노라마명 2줄 · 경로 축약 (IND-7893)' },
  { id: 'admin-extvr-classify', site: 'admin', url: '/external-vr-classification', wait: 4000,
    desc: '관리자 — 외부VR 분류 검증 목록 · 신뢰도 배지 · 빠른 검수 (IND-7623·IND-7932)' },
  // ── distorted 영상 핫스팟 재생 시연 (IND-7810) — 자동재생·재생버튼이 보이도록 넉넉히 기다린다
  { id: 'video-1788',      site: 'fe', url: '/vr/6lmp0o6a?pano=19747', wait: 12000, waitUntil: 'load', desc: '영상 1788 재생버튼·자동재생' },
  { id: 'video-882',       site: 'fe', url: '/vr/l55md6ls?pano=6673',  wait: 12000, waitUntil: 'load', desc: '영상 882 재생버튼·자동재생' },
  { id: 'video-288',       site: 'fe', url: '/vr/e940jcdf?pano=4079',  wait: 12000, waitUntil: 'load', desc: '영상 288 클릭 토글' },
  { id: 'video-2859-1f',   site: 'fe', url: '/vr/c7bce52b?pano=33132', wait: 12000, waitUntil: 'load', desc: '영상 2859 1F 로비 404 복구' },
  { id: 'video-2859-3f',   site: 'fe', url: '/vr/c7bce52b?pano=33146', wait: 12000, waitUntil: 'load', desc: '영상 2859 3F 404 복구' },
  { id: 'video-826-ok',    site: 'fe', url: '/vr/qmwy4mq9?pano=6196',  wait: 12000, waitUntil: 'load', desc: '영상 826 정상 기준' },
  { id: 'video-826-5',     site: 'fe', url: '/vr/qmwy4mq9?pano=6200',  wait: 12000, waitUntil: 'load', desc: '영상 826 livepano_5' },
  { id: 'video-954',       site: 'fe', url: '/vr/19w11wcp?pano=7558',  wait: 12000, waitUntil: 'load', desc: '영상 954' },
  { id: 'video-2323',      site: 'fe', url: '/vr/27ayk33n?pano=27838', wait: 12000, waitUntil: 'load', desc: '영상 2323' },
  { id: 'video-2430',      site: 'fe', url: '/vr/ddtf13lr',            wait: 12000, waitUntil: 'load', desc: '영상 2430 (첫 장면)' },
  { id: 'video-2436',      site: 'fe', url: '/vr/hmsjc4mf?pano=28744', wait: 12000, waitUntil: 'load', desc: '영상 2436' },
  { id: 'video-2578',      site: 'fe', url: '/vr/2l6aav48?pano=29886', wait: 12000, waitUntil: 'load', desc: '영상 2578' },
  // ── 「그 밖의 VR 뷰어 개선」 항목별 시연 (2026-10-06 추가)
  { id: 'free-list',       site: 'fe', url: '/vr-info/xo6jh8ib',        wait: 4000, desc: '무료 콘텐츠 상세 — 파노라마 목록' },
  { id: 'free-jump',       site: 'fe', url: '/vr/xo6jh8ib?pano=33068',  wait: 9000, waitUntil: 'load', desc: '무료 — 주차장 출입구 장면으로 바로 열림' },
  { id: 'lang-group-ko',   site: 'fe', url: '/vr/wrpkbkcy?pano=4322',   wait: 9000, waitUntil: 'load', desc: '언어 전환 전 — 고공전경 그룹(한국어)' },
  { id: 'home-hero-ko',    site: 'fe', url: '/',                        wait: 5000, crop: 'hero', desc: '홈 히어로 — 한국어' },
  { id: 'home-hero-ja',    site: 'fe', url: '/',                        wait: 5000, crop: 'hero', lang: 'ja', desc: '홈 히어로 — 일본어' },
  { id: 'video-plan-doc',  site: 'fe', url: '/', abs: 'http://100.64.25.50:8088/ideas/2026-09-18-look360-360video-content-plan.html', wait: 2500, desc: '360동영상 기획서' },
  { id: 'post-avatar',     site: 'fe', url: '/vr/xo6jh8ib?pano=33044&tab=post', wait: 9000, waitUntil: 'load', desc: '360포스트 탭 바로 열기 + 프로필 동그라미' },
  { id: 'intro-gallery',   site: 'fe', url: '/vr/09a2e3fd?tab=intro',   wait: 9000, waitUntil: 'load', desc: '장소소개 탭 (갤러리 탭 표시)' },
  { id: 'channel-ellipsis', site: 'fe', url: '/vr/1lfn283t',            wait: 9000, waitUntil: 'load', device: 'mobile', desc: '긴 채널명 한 줄 말줄임 (모바일)' },
  // ── 채널 · VR 상세 · 목록 시연 (2026-10-06 추가)
  { id: 'channel-badge',   site: 'fe', url: '/channel/channel-cd5q7v89', wait: 4000, desc: '인증 채널 뱃지 — Look360 채널' },
  { id: 'channels-list',   site: 'fe', url: '/channels',                 wait: 4000, desc: '채널 탐색 목록 — 채널 이름 표시' },
  { id: 'breadcrumb-mobile', site: 'fe', url: '/vr-info/xo6jh8ib',       wait: 4000, device: 'mobile', desc: 'VR 상세 모바일 경로 한 줄' },
  { id: 'vr-list-country', site: 'fe', url: '/vr-list',                  wait: 4000, desc: 'VR 목록 — 국가 선택' },
  // ── 10/6~10/7 추가분 (2026-10-07 추가)
  { id: 'hero-next',       site: 'fe', url: '/',                        wait: 5000, crop: 'hero',
    actions: [{ do: 'click', sel: '.heroArrowNext' }, { do: 'wait', ms: 1500 }],
    desc: '홈 히어로 — 다음 슬라이드로 넘긴 직후 (IND-7974·IND-7984)' },
  { id: 'gallery-deeplink', site: 'fe', url: '/vr/09a2e3fd?tab=intro&section=gallery', wait: 9000, waitUntil: 'load',
    desc: '장소소개 갤러리 딥링크 — 링크로 진입 시 갤러리 섹션 (IND-7988)' },
  { id: 'story-reset',     site: 'fe', url: '/vr/59f1c404?story=6-5',   wait: 12000, waitUntil: 'load',
    actions: [{ do: 'click', sel: 'button:has-text("시작하기")' }, { do: 'wait', ms: 9000 }],
    desc: 'VR 스토리 아이템 진입 — 시점 초기화 · 컨트롤러 (IND-8002·IND-8005)' },
  { id: 'story-controls-mobile', site: 'fe', url: '/vr/59f1c404?story=6-5', wait: 12000, waitUntil: 'load', device: 'mobile',
    actions: [{ do: 'click', sel: 'button:has-text("시작하기")' }, { do: 'wait', ms: 9000 }],
    desc: 'VR 스토리 컨트롤러 모바일 — 카운터 겹침·특수문자 정리 (IND-8005)' },
  { id: 'admin-pano-search', site: 'admin', url: '/panorama?tab=edit&subTab=info', wait: 4000,
    actions: [{ do: 'fill', sel: 'input[placeholder*="콘텐츠 제목"]', text: '4qorh7b8' }, { do: 'press', key: 'Enter' }, { do: 'wait', ms: 3000 }],
    desc: '관리자 파노라마 통합 검색 — 콘텐츠 주소로 검색 (IND-7987)' },
  // ── 10/8~10/12 추가분 (2026-10-12 추가)
  { id: 'v360-upload',     site: 'fe', url: '/vr/ind8027fx?pano=33662', wait: 12000, waitUntil: 'load',
    desc: '360동영상(업로드형) 재생 레이어 — 화질 선택·진행바 (IND-8026 · 테스트 픽스처)' },
  { id: 'v360-youtube',    site: 'fe', url: '/vr/ind8027fx?pano=33663', wait: 12000, waitUntil: 'load',
    desc: '360동영상(YouTube형) — 드래그·자이로 입력 레이어 (IND-8104 · 테스트 픽스처)' },
  { id: 'v360-detail',     site: 'fe', url: '/vr-info/ind8027fx',        wait: 5000,
    desc: 'VR 상세 — 「파노라마 N · 360동영상 M」 표기 (IND-8032)' },
  { id: 'admin-v360-batch', site: 'admin', url: '/panorama?tab=mng&subTab=video_batch', wait: 4000,
    desc: '관리자 — 360동영상 일괄 매칭 업로드 (IND-8030)' },
  { id: 'map-panel',       site: 'fe', url: '/vr/59f1c404',             wait: 10000, waitUntil: 'load',
    actions: [{ do: 'click', sel: 'button[title="지도"]' }, { do: 'wait', ms: 3500 }],
    desc: 'vrViewer 지도 — 구글맵/미니맵 토글 중앙·헤더 재배치 (IND-8047)' },
  { id: 'share-embed',     site: 'fe', url: '/vr/59f1c404',             wait: 10000, waitUntil: 'load',
    actions: [{ do: 'click', sel: 'button[title="공유"]' }, { do: 'wait', ms: 1500 },
              { do: 'click', sel: 'text=임베드 코드' }, { do: 'wait', ms: 6000 }],
    desc: 'VR 공유 팝업 — 임베드 탭 사용자 지정 100%×600 기본값 (IND-8051)' },
  { id: 'title-info',      site: 'fe', url: '/vr/59f1c404',             wait: 10000, waitUntil: 'load',
    desc: 'vrViewer 제목 정보 — 공식채널 뱃지·언어칩 A+文·krpano 로딩 후 화면 (IND-8049)' },
  { id: 'pano-list-mobile', site: 'fe', url: '/vr/1xdrlfot/31636',      wait: 10000, waitUntil: 'load', device: 'mobile',
    desc: 'vrViewer 모바일 하단 — 썸네일 원본 비율·footer 26px (IND-8050)' },
  { id: 'story-intro-en',  site: 'fe', url: '/vr/59f1c404?story=6-5',   wait: 12000, waitUntil: 'load', lang: 'en',
    desc: 'VR 스토리 인트로 — 영어 사이트 언어 i18n (IND-8057)' },
  { id: 'story-planet-normal', site: 'fe', url: '/vr/b600e6a4?story=6-1', wait: 12000, waitUntil: 'load',
    actions: [{ do: 'click', sel: 'button:has-text("시작하기")' }, { do: 'wait', ms: 8000 }],
    desc: 'VR 스토리 시작 후 리틀플래닛 → 일반 뷰 (IND-8112·IND-8113)' },
  // ── 10/13~10/19 추가분 (2026-10-19 추가)
  { id: 'licenses',        site: 'fe', url: '/licenses',                 wait: 4000,
    desc: '오픈소스 라이선스 페이지 신설 — dr5hn ODbL 데이터 출처 (IND-8196)' },
  { id: 'policy-ja',       site: 'fe', url: '/policy?tab=agreement',     wait: 5000, lang: 'ja',
    desc: '약관 — 일본어 번역본 (IND-8396)' },
  { id: 'policy-ko-youth', site: 'fe', url: '/policy?tab=youth',         wait: 4000,
    desc: '약관 — 청소년 보호대책 책임자 문갑기(CTO) (IND-8321)' },
  { id: 'v360-yt-ourbar',  site: 'fe', url: '/vr/ind8027fx?pano=33663', wait: 12000, waitUntil: 'load',
    desc: 'YouTube형 360동영상 — YouTube 자체 UI 제거 · 우리 컨트롤바 (IND-8272)' },
  { id: 'story-53',        site: 'fe', url: '/vr/152165ca?story=5-3',    wait: 12000, waitUntil: 'load',
    actions: [{ do: 'click', sel: 'button:has-text("시작하기")' }, { do: 'wait', ms: 9000 }],
    desc: 'VR 스토리 아침고요 5-3 — 매체 수명주기 공통 장치 (IND-8041)' },
  // ── 10/20~10/26 추가분 (2026-10-26 추가)
  { id: 'w1026-faq-en',     site: 'fe', url: '/faq',                      wait: 5000, lang: 'en',
    desc: 'FAQ — 영어 사이트 언어로 제목·본문 자동번역 (IND-8526)' },
  { id: 'w1026-licenses',   site: 'fe', url: '/licenses',                 wait: 4000,
    desc: '「소프트웨어 라이선스」 — 고지 의무 항목만 (IND-8529)' },
  { id: 'w1026-extvr',      site: 'fe', url: '/vr-info/nsUMZzRN',         wait: 5000,
    desc: '외부VR 상세 — 기획 디자인 일치 · 탭 3개 · ✦ 버튼 (IND-8591)' },
  { id: 'w1026-vrinfo-badges', site: 'fe', url: '/vr-info/hmsjc4mf?tab=panos', wait: 5000,
    desc: '/vr-info 파노라마 그리드 — 썸네일 좌하단 형식·AI 배지 (IND-8528)' },
  { id: 'w1026-yt360-joypad', site: 'fe', url: '/vr/ind8027fx?pano=33663', wait: 12000, waitUntil: 'load',
    desc: 'YouTube 360 장면 — YouTube 자체 컨트롤 · 강제 clearMode · 조이패드 (IND-8535·IND-8625)' },
  { id: 'w1026-kaypark',    site: 'fe', url: '/vr/o1vj1ty0?pano=29315',   wait: 12000, waitUntil: 'load',
    desc: '2529 Kay Park 전시회 — 작품 핫스팟 복구(반짝임 제거) (IND-8648)' },
  { id: 'w1026-bookmark',   site: 'fe', url: '/channel/channel-cd5q7v89?tab=bookmark', wait: 5000,
    desc: '채널 북마크 탭 — 소속 콘텐츠 4분할 자동 썸네일 (IND-8531·IND-8621)' },
  { id: 'w1026-vrlist-mobile', site: 'fe', url: '/vr-list',               wait: 5000, device: 'mobile',
    desc: 'VR 목록 모바일 — 가격 ₩ 아이콘·필터 (IND-8590·IND-8595)' },
  // ── 2026-11-04 덱 (어드민 정합화 · 오너 지시로 QC 계정 로그인 경유 캡처)
  { id: 'w1104-admin-place-list', site: 'admin', url: '/place-management', wait: 6000,
    desc: '어드민 장소 관리 — 유형/테마 2축 필터 · 유형 컬럼 · 지역 검색 (IND-8923)' },
  { id: 'w1104-admin-place-modal', site: 'admin', url: '/place-management', wait: 6000,
    actions: [{ do: 'click', sel: 'button:has-text("새 장소 추가")' }, { do: 'wait', ms: 3000 }],
    desc: '어드민 장소 추가 팝업 — 취소·저장 버튼 하단 고정 (IND-9065)' },
  { id: 'w1104-admin-theme', site: 'admin', url: '/theme-management', wait: 6000,
    desc: '어드민 테마 관리 — 키·분류·번역 정상 표시 · 활성 여부 (IND-8924)' },
  { id: 'w1104-admin-region-matching', site: 'admin', url: '/admin/regions/matching?tab=aliases', wait: 6000,
    actions: [{ do: 'click', sel: 'button:has-text("지역 별칭"), .v-tab:has-text("지역 별칭")' }, { do: 'wait', ms: 2500 }],
    desc: '어드민 지역 매칭 — 미연결 장소·지역 별칭 단일 페이지 통합 · 별칭 탭 (IND-8931)' },
  { id: 'w1104-admin-vrstory', site: 'admin', url: '/vrstory', wait: 6000,
    desc: '어드민 VR스토리 목록 — 90건 · 미리보기/편집 (IND-8943)' },
  { id: 'w1104-admin-vrstory-viewer', site: 'admin', url: '/vrstory/91/viewer', wait: 12000, waitUntil: 'load',
    // 콘텐츠 언어(일본어) ≠ 사이트 언어라 자동번역 확인 모달이 뜬다 — 「원문으로 보기」로 닫고 화면을 찍는다
    actions: [{ do: 'clickFrameIfAny', sel: 'button:has-text("原文で視聴する"), button:has-text("원문으로 보기")' }, { do: 'wait', ms: 4000 }],
    desc: '어드민 VR스토리 뷰어 복구 — 죽은 IP·제거된 embed 경로 수정 후 재생 · 챕터/XML 칩 표시 (IND-8943)' },
];

const CROPS = {
  // 홈 히어로 영역만 (1440x900 뷰포트 기준)
  // IND-6777 로 히어로 좌우 여백이 제거돼 전체 폭을 쓴다 — 크롭도 폭 전체로 맞춘다
  hero: { x: 0, y: 119, width: 1440, height: 440 },
  // 관리자 사이드바(좌 256px)를 제외한 본문만
  adminBody: { x: 256, y: 64, width: 1184, height: 836 },
};

const VIEWPORT = { width: 1440, height: 900 };
// 모바일 캡처용 (iPhone 14 급) — 터치·모바일 플래그까지 켜야 반응형 분기가 실제와 같아진다
const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const JPEG = { type: 'jpeg', quality: 88 };   // git 저장소에 매주 쌓이므로 용량을 억제한다

// ── 인자 파싱 ────────────────────────────────────────────────
const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
if (args.includes('--list')) {
  console.log('캡처 대상:');
  for (const s of SHOTS) console.log(`  ${s.id.padEnd(22)} ${s.site.padEnd(6)} ${s.url.padEnd(26)} ${s.desc}`);
  process.exit(0);
}
const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

/** 이번 주 수요일(발행일) — 수요일이면 오늘, 아니면 직전 수요일 */
function thisWednesday() {
  const d = new Date();
  const diff = (d.getDay() - 3 + 7) % 7;   // 3 = 수요일
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}
const DATE = dateArg || thisWednesday();
const OUT_DIR = path.join(ROOT, 'weekly-reports', 'assets', DATE);

// ── 의존성 해결 (버전 하드코딩 금지) ─────────────────────────
function findPlaywright() {
  const bases = [
    path.join(ROOT, 'node_modules/playwright-core'),
    '/home/kabkee/Developments/paperclip/node_modules/playwright-core',
  ];
  const pnpm = '/home/kabkee/Developments/paperclip/node_modules/.pnpm';
  if (fs.existsSync(pnpm)) {
    for (const d of fs.readdirSync(pnpm).filter((x) => x.startsWith('playwright-core@')).sort().reverse()) {
      bases.push(path.join(pnpm, d, 'node_modules/playwright-core'));
    }
  }
  for (const b of bases) if (fs.existsSync(b)) return require_(path.join(b, 'index.js'));
  throw new Error(`playwright-core 를 찾지 못했습니다. 탐색 경로:\n  ${bases.join('\n  ')}`);
}

function adminToken() {
  const envPath = path.join(API_REPO, '.env');
  if (!fs.existsSync(envPath)) throw new Error(`API .env 없음: ${envPath} (관리자 화면 캡처 불가)`);
  const m = fs.readFileSync(envPath, 'utf8').match(/^JWT_ACCESS_SECRET=(.*)$/m);
  if (!m) throw new Error(`.env 에 JWT_ACCESS_SECRET 없음: ${envPath}`);
  const jwt = require_(path.join(API_REPO, 'node_modules/jsonwebtoken'));
  return jwt.sign(
    { sub: 1, id: 'email_kabkee@live.com', email: 'kabkee@live.com', name: 'kabkee',
      role: 'ADMIN', is_active: 1, service_version: 2 },
    m[1].trim(),
    { expiresIn: '60m' },
  );
}

/** .env 값은 따옴표로 감싸져 있을 수 있다 */
const unquote = (v) => v.trim().replace(/^['"]|['"]$/g, '');

/**
 * 어드민 로그인 — 오너 지시(2026-11-03): ADMIN 권한을 가진 QC 계정으로 client FE 에 «실제 로그인»한다.
 * 어드민(:5277)은 client 와 같은 도메인(100.64.25.50)이라 로그인 쿠키를 그대로 쓴다.
 * 어드민 라우터는 createWebHistory 라 경로에 `#` 을 붙이지 않는다.
 * 🔴 개발 서버 전용. 운영 도메인에는 쓰지 말 것.
 */
async function loginAsQcAdmin(ctx) {
  const envPath = path.join(API_REPO, '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const em = env.match(/^TEST_CLIENT_EMAIL=(.*)$/m);
  const pm = env.match(/^TEST_CLIENT_PASSWORD=(.*)$/m);
  if (!em || !pm) throw new Error(`.env 에 TEST_CLIENT_EMAIL/TEST_CLIENT_PASSWORD 없음: ${envPath}`);
  const email = unquote(em[1]);
  const pw = unquote(pm[1]);
  const page = await ctx.newPage();
  try {
    await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', pw);
    await page.click('button[type="submit"], button:has-text("로그인")').catch(() => page.keyboard.press('Enter'));
    await page.waitForTimeout(7000);
    if (/\/login/.test(page.url())) throw new Error(`로그인 실패 — URL 이 아직 ${page.url()} (계정·비밀번호 확인)`);
    console.log(`🔑 QC 계정 로그인 완료: ${email}`);
  } finally {
    await page.close();
  }
}

async function alive(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return r.status < 500;
  } catch { return false; }
}

// ── 실행 ─────────────────────────────────────────────────────
const targets = SHOTS.filter((s) => !only || s.id.includes(only));
if (!targets.length) { console.error(`❌ --only "${only}" 에 해당하는 대상이 없습니다.`); process.exit(1); }

console.log(`📅 발행일 ${DATE}  ·  대상 ${targets.length}개  ·  출력 ${path.relative(ROOT, OUT_DIR)}/\n`);

const health = {
  fe: await alive(FE),
  admin: await alive(ADMIN),
  api: await alive(`${API}/main-page/summary`),
};
console.log(`서버  FE ${health.fe ? '✅' : '❌'}  ADMIN ${health.admin ? '✅' : '❌'}  API ${health.api ? '✅' : '❌'}`);
if (!health.api) console.error('⚠️  API 가 죽어 있으면 화면이 비어 찍힙니다.');

const needFe = targets.some((s) => s.site === 'fe');
const needAdmin = targets.some((s) => s.site === 'admin');
if (needFe && !health.fe) { console.error(`❌ FE(${FE}) 응답 없음 — 개발 서버를 먼저 띄우세요.`); process.exit(1); }
if (needAdmin && !health.admin) { console.error(`❌ ADMIN(${ADMIN}) 응답 없음 — 관리자 개발 서버를 먼저 띄우세요.`); process.exit(1); }

fs.mkdirSync(OUT_DIR, { recursive: true });

/** 시스템 크롬 → ms-playwright 캐시의 chromium(최신 리비전) 순으로 찾는다. 찾은 playwright-core 가 기대하는 리비전이 캐시에 없을 수 있어서 경로를 직접 넘긴다 */
function findChrome() {
  if (fs.existsSync('/usr/bin/google-chrome')) return '/usr/bin/google-chrome';
  const cache = path.join(process.env.HOME || '', '.cache/ms-playwright');
  const revs = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of revs) {
    const p = path.join(cache, d, 'chrome-linux64/chrome');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const { chromium } = findPlaywright();
const browser = await chromium.launch({
  // 시스템 크롬이 없는 머신(kabkee-main WSL)은 playwright 번들 chromium 으로 대체한다
  executablePath: findChrome(),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ko-KR', deviceScaleFactor: 2 });

if (needAdmin) {
  // 오너 지시(2026-11-03): ADMIN 권한 QC 계정으로 client FE 에 실제 로그인한다.
  // 로그인이 실패하면 예전 방식(자가서명 JWT 쿠키 주입)으로 넘어간다 — 조용히 넘기지 않고 이유를 찍는다.
  try {
    await loginAsQcAdmin(ctx);
  } catch (e) {
    console.error(`⚠️  QC 계정 로그인 실패 → 자가서명 JWT 쿠키로 대체: ${e.message}`);
    const token = adminToken();
    await ctx.addCookies([{ name: 'accessToken', value: token, domain: '100.64.25.50', path: '/' }]);
    console.log('🔑 관리자 accessToken 쿠키 주입 완료 (60분 유효)');
  }
}

const page = await ctx.newPage();
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text().slice(0, 160)); });

// 모바일 대상이 있으면 전용 컨텍스트를 따로 연다 (viewport·isMobile 은 컨텍스트 단위 설정)
let mobilePage = null;
if (targets.some((s) => s.device === 'mobile')) {
  const mctx = await browser.newContext({ ...MOBILE, locale: 'ko-KR' });
  mobilePage = await mctx.newPage();
  mobilePage.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text().slice(0, 160)); });
  console.log(`📱 모바일 컨텍스트 생성 (${MOBILE.viewport.width}x${MOBILE.viewport.height})`);
}

const results = [];

for (const shot of targets) {
  // 🔴 번호는 SHOTS 전체에서의 위치로 고정한다 (--only 로 일부만 찍어도 파일명이 흔들리지 않도록)
  const seq = SHOTS.indexOf(shot) + 1;
  const base = `${String(seq).padStart(2, '0')}-${shot.id}`;
  const file = path.join(OUT_DIR, `${base}.jpg`);
  const origin = shot.site === 'admin' ? ADMIN : FE;
  const pg = shot.device === 'mobile' ? mobilePage : page;
  const before = pageErrors.length;
  try {
    // 사이트 언어는 localStorage('preferred_lang'), 자동번역 토글은 'vr_auto_translate' 가
    // 비로그인 상태의 정본이다 (useUserStore.js:23 · VrDetail.vue:1326-1339).
    // 지면을 먼저 열어 origin 을 확보한 뒤 값을 넣고 다시 연다.
    const ls = { ...(shot.lang ? { preferred_lang: shot.lang } : {}), ...(shot.ls ?? {}) };
    if (Object.keys(ls).length) {
      await pg.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await pg.evaluate((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, ls);
    }
    await pg.goto(shot.abs ?? (origin + shot.url), { waitUntil: shot.waitUntil ?? 'networkidle', timeout: 45000 });
    await pg.waitForTimeout(shot.wait ?? 2000);

    if (shot.type) {
      await pg.locator(shot.type.sel).first().pressSequentially(shot.type.text, { delay: 90 });
      await pg.waitForTimeout(shot.type.after ?? 1500);
    }

    // 다이얼로그 등 「눌러야 보이는 화면」을 위한 조작 시퀀스
    for (const a of shot.actions ?? []) {
      if (a.do === 'fill')  await pg.locator(a.sel).first().fill(a.text);
      if (a.do === 'press') await pg.keyboard.press(a.key);
      if (a.do === 'click') await pg.locator(a.sel).first().click({ force: true });
      // iframe 안의 요소 클릭 (어드민 VR스토리 뷰어의 embed 안 모달 등). frame 이 없으면 조용히 넘기지 않고 던진다.
      if (a.do === 'clickFrame') {
        await pg.frameLocator(a.frame ?? 'iframe').locator(a.sel).first().click({ force: true, timeout: a.timeout ?? 15000 });
      }
      // 있으면 클릭하고 없으면 넘어간다 (뜰 수도 안 뜰 수도 있는 모달)
      if (a.do === 'clickFrameIfAny') {
        const loc = pg.frameLocator(a.frame ?? 'iframe').locator(a.sel).first();
        try { await loc.click({ force: true, timeout: a.timeout ?? 8000 }); }
        catch { console.log(`    ↳ (건너뜀) iframe 요소 없음: ${a.sel}`); }
      }
      if (a.do === 'wait')  await pg.waitForTimeout(a.ms);
    }

    await pg.screenshot({ path: file, ...JPEG });
    const made = [`${base}.jpg`];

    if (shot.crop && CROPS[shot.crop]) {
      const cropFile = path.join(OUT_DIR, `${base}-crop.jpg`);
      await pg.screenshot({ path: cropFile, clip: CROPS[shot.crop], ...JPEG });
      made.push(`${base}-crop.jpg`);
    }

    // 다음 캡처가 오염되지 않도록 되돌린다
    if (shot.lang) await pg.evaluate(() => localStorage.setItem('preferred_lang', 'ko'));
    if (shot.ls) await pg.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), Object.keys(shot.ls));

    const errs = pageErrors.length - before;
    const kb = Math.round(fs.statSync(file).size / 1024);
    results.push({ id: shot.id, ok: true, files: made, kb, errs });
    console.log(`  ✅ ${base.padEnd(26)} ${String(kb).padStart(5)}KB${errs ? `  ⚠️ 콘솔에러 ${errs}건` : ''}`);
  } catch (e) {
    results.push({ id: shot.id, ok: false, error: e.message.split('\n')[0].slice(0, 140) });
    console.log(`  ❌ ${base.padEnd(26)} ${e.message.split('\n')[0].slice(0, 100)}`);
  }
}

await browser.close();

// ── 리포트 (조용한 실패 금지) ────────────────────────────────
const ok = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);
console.log(`\n${'─'.repeat(62)}`);
console.log(`결과  성공 ${ok.length}/${results.length}   저장 위치: ${path.relative(ROOT, OUT_DIR)}/`);
if (ok.length) {
  console.log('\n마크다운에 붙여넣기 — 🔴 이미지 슬라이드에는 «반드시» links 블록을 함께 넣을 것:');
  for (const r of ok) {
    const shot = SHOTS.find((s) => s.id === r.id);
    const origin = shot.site === 'admin' ? ADMIN : FE;
    for (const f of r.files) console.log(`  ![w:900](assets/${DATE}/${f})`);
    console.log(`  <div class="links"><span class="lbl">직접 확인</span>`);
    console.log(`  <a class="lnk${shot.site === 'admin' ? ' admin' : ''}" href="${origin}${shot.url}" target="_blank">${origin}${shot.url}</a></div>`);
  }
}
if (failed.length) {
  console.log('\n❌ 실패한 화면:');
  for (const r of failed) console.log(`  · ${r.id} — ${r.error}`);
  process.exit(1);
}
console.log('\n완료 ✅');
