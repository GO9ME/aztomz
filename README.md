# 한끗 — 트렌드 번역소

> **AZ와 MZ는 한 끗 차이** | 요즘 유행(밈·신조어·음식·디저트·핫플)을 1분에 번역하고, SNS 맛집이 광고인지 실후기인지 분석해주는 의존성 0·빌드 0·외부 폰트 CDN 0 정적 모바일 웹. 저장·후기·펄스 아이디어는 이 브라우저 localStorage에만 보관합니다.

## 구조 한눈에

| 파일·경로 | 역할 |
|---|---|
| `frontend/` | ★ 배포 대상(Vercel `outputDirectory`). 브라우저가 받는 정적 파일 전부 |
| `frontend/index.html` | 홈 — 오늘의 한끗·광고일까 진짜일까 미리보기(상위 6개)·요즘 트렌드 미리보기(상위 8개) + 더보기 → 전체 목록 |
| `frontend/list.html?type=ad\|trend` | 전체 목록 — 광고분석(10/페이지) 또는 트렌드(12/페이지) + 페이지네이션. `cat=음식`→`맛집`, `cat=핫플`→`카페·핫플` 별칭 매핑 |
| `frontend/trend.html?id=` | 상세 — 점수(광고의심도/신뢰도)·만족도·판단·추천·출처·후기·공유·같은 카테고리 우선 관련 콘텐츠 |
| `frontend/dictionary.html` | MZ 사전 — 신조어 카드(뜻·예문·예쁜 우리말·출처) 검색 + 최신 신조어/지난 유행어 분리 |
| `frontend/me.html` | 내 보관함 — 이 브라우저에 저장한 트렌드·후기·펄스 아이디어 |
| `frontend/login.html`·`signup.html` | 직접 접근 안정성을 위한 noindex 안내 페이지(서비스 내 링크 없음) |
| `frontend/pulse.html` | 트렌드 펄스 — 이번 주 트렌드 / 트렌드 레이더 / 저장한 아이디어 탭 |
| `frontend/assets/styles.css`·`app.js`·`pulse.js` | warm paper 기반 Neo Editorial Trend Radar 디자인 시스템 / localStorage 스토어와 공통 헬퍼(`H.*`) / 펄스 |
| `frontend/data/trends.js`·`pulse.js` | 브라우저가 로드하는 **생성물** — **직접 편집 금지** |
| `backend/` | 비공개(배포 안 됨) — 데이터 원본 + 빌드 스크립트 |
| `backend/data/trends.json`·`pulse.json` | ★ **canonical 데이터 원본** (사람·스크립트가 수정) |
| `backend/scripts/auto-build.mjs` | **자동 게시 엔진** — 출처 자동검증(404/410/관련성) · 중복 제거 · 통과분만 trends.json 반영 · images 필드 자동 주입(og:image) · shops 배열 URL 생존성 검증(죽은 링크 제거) · git push |
| `backend/scripts/recheck-ad.mjs` | **광고/진짜 일일 재확인** — 가장 오래된 신뢰분석 1건의 출처 재검증(ddgs) → 살아있으면 analyzedAt=오늘 갱신(→ 홈 featured 회전) |
| `backend/scripts/refresh.mjs` 등 | 정적 데이터 생성·출처검증·이미지 스크립트 |
| `tools/hermes-admin/` | 🔧 **Hermes 로컬 관리 콘솔** — 크론·설정·실행기록 관리(비배포, 127.0.0.1 전용) |
| `docs/` | 기획·아키텍처·메뉴별 문서 |

---

## 로컬 실행

### 정적 서버 띄우기
의존성 0, 빌드 0. 사이트 루트는 `frontend/`:
```bash
# 방법 1: 동봉 미니 서버 — 레포 루트에서 실행 → frontend/를 서빙 (포트 8123)
node .claude/static-server.cjs
# 방법 2: Python — frontend/ 안에서 실행
cd frontend && python -m http.server 8000
```

### 데이터 갱신 (선택사항)
```bash
node backend/scripts/validate-trends.mjs  # backend/data/trends.json 스키마 점검(권장)
node backend/scripts/refresh.mjs   # backend/data/trends.json → frontend/data/trends.js 재생성 (레포 루트에서)
```

> trends.json을 직접 편집한 후, 이 스크립트를 실행하면 trends.js가 자동 생성됩니다.  
> **trends.js는 직접 편집하지 마세요** — refresh.mjs의 생성물입니다.

### Hermes(고구미봇) 로컬 관리 콘솔 (선택사항)
```bash
# Windows
tools\hermes-admin\start.bat                  # 브라우저 자동 오픈 (포트 7766, 토큰 기반 보호)
# 또는
node tools/hermes-admin/server.mjs            # 수동 시작
```
크론 작업·설정·실행 기록을 웹 UI에서 관리. **로컬 전용**(127.0.0.1, 비배포). → **[콘솔 가이드](tools/hermes-admin/README.md)**

---

## 데이터 흐름

```
.pipeline/curate.json (Hermes가 생성한 후보 항목들)
    ↓
backend/scripts/auto-build.mjs (자동검증 + 썸네일 주입)
  · 중복 제거 · 출처 404/410 제거 · 본문 관련성 검증
  · images 필드 빈 항목 → 출처의 og:image 자동 추출·주입 (추가 fetch 없음)
    ↓
검증 통과분만 → backend/data/trends.json (canonical 원본)
    ↓
backend/scripts/validate-trends.mjs (스키마 점검; auto-build 내부 또는 수동)
    ↓
backend/scripts/refresh.mjs (generatedAt 갱신 + 생성)
    ↓
frontend/data/trends.js (브라우저가 로드 → H.TRENDS)
    ↓
사이트 frontend/*.html (마스트헤드·피처·리스트 렌더링)
    ↓
Vercel 자동 배포 (git push 시)
```

**핵심:** 
- trends.json만 수정. trends.js는 건드리지 말 것.
- auto-build.mjs가 출처 자동검증(게이트) — 죽음·무관·못읽음 출처만 있으면 자동 보류
- 자동 게시 항목의 썸네일은 auto-build.mjs가 출처 og:image로 자동 주입 — 모든 아이템이 커버 이미지 보장
- 저장/후기/펄스 아이디어는 서버에 저장되지 않는 로컬 개인화(localStorage) 기능
- 다른 브라우저·다른 기기와 동기화되지 않으며, `H.*`는 향후 백엔드가 필요할 때를 위한 추상화 계층으로 유지
- 디자인 톤은 `frontend/assets/styles.css`의 warm paper 기반 Neo Editorial Trend Radar를 따른다

---

## 배포

GitHub `GO9ME/aztomz`(public) → Vercel 정적 배포. `vercel.json`의 `outputDirectory: "frontend"`로 **frontend/만 서빙**(backend/ 비공개).  
**자동:** 각 push마다 Vercel이 재배포 (약 1~2분).

```bash
git add backend/data/trends.json frontend/data/trends.js
git commit -m "..."
git push origin main              # → Vercel 자동 재배포
```

---

## 문서 인덱스

- **[docs/prd.md](docs/prd.md)** — 프로젝트 기획·비전
- **[docs/architecture.md](docs/architecture.md)** — 정적 멀티페이지 구조·로컬 스토어 계약
- **[docs/local-first.md](docs/local-first.md)** — 정적 운영·localStorage 기반 로컬 개인화 전략
- **[docs/hermes.md](docs/hermes.md)** — 🤖 **Hermes(고구미봇) 작동 방식** — 파이프라인·스킬 12개·검증 게이트·cron
- **[docs/menus/](docs/menus/)** — 메뉴별 상세 문서
  - [오늘의 한끗(홈)](docs/menus/home.md) / [MZ 사전](docs/menus/dictionary.md)
  - [광고일까 진짜일까](docs/menus/ad-or-real.md) / [요즘 음식](docs/menus/food.md)
  - [요즘 디저트](docs/menus/dessert.md) / [요즘 핫플](docs/menus/hotplace.md)
  - [검색](docs/menus/search.md) / [공유](docs/menus/share.md) / [내 보관함](docs/menus/mypage.md) / [로그인 안내](docs/menus/auth.md)
- **[learnings.md](learnings.md)** — 고구미봇이 쌓는 분석 교훈
- **[CLAUDE.md](CLAUDE.md)** — 개발 철칙·메모

---

## 철칙 (신뢰가 제품의 본질)

| 항목 | 규칙 |
|---|---|
| **신선도** | `analyzedAt`은 **실제로 재분석한 항목만** 오늘 날짜로 갱신. 안 한 항목은 그대로 둠 → "갱신 필요" 노출 |
| **출처** | 검색 결과에 **실제로 나온 URL만** 사용. 추측·단축·조립 금지. auto-build.mjs가 404/410 제거 + 본문 관련성 검증 |
| **점수** | 모든 점수는 **추정치**이며 확정 판정이 아님. 단정 표현 금지 |
| **신뢰도 ≠ 만족도** | 신뢰도(믿을 만한가) ≠ 만족도(좋은가) — 별개 축으로 표기. 신뢰도 높아도 내용이 '별로'면 neg |
| **신조어** | 출처에 "2024 신조어" 류 표시면 2026.6 기준으로 한물 의심. 재검증 필수. 한물간 신조어는 `fresh:false` 또는 stage에 '끝물'·'한물' 표시 → 사전 '최신'에서 빠지고 '지난 유행어'로 보관 |
| **게시 정책** | auto-build.mjs가 출처 검증(관련성·생존성) 후 통과분만 자동 게시. 거짓·무관·404 출처만 있으면 자동 보류 |

---

## 데이터 스키마

각 trend 항목:
- `id` (string) — 고유 키
- `type` (string) — "신뢰분석" | "트렌드"
- `cat` (string) — 정규 7분류 중 하나: 디저트 · 맛집 · 카페·핫플 · 신조어 · 노래·챌린지 · 패션 · AI 프롬프트
- `title` (string) — 트렌드명
- `collectedAt` (YYYY-MM-DD) — **첫 수집일(불변)**. 사이트 "수집일별" 누적/필터 기준(`index.html?date=`). 재분석해도 안 바뀜
- `analyzedAt` (YYYY-MM-DD) — 분석 날짜(재분석 시 갱신)
- `ad` (0~100) — 광고 의심도
- `trust` (0~100) — 실제 후기 신뢰도
- `sat` (pos|neg|mix) — 만족도 (긍정·부정·혼재)
- `label` (string) — 한끗 판정 (예: "SNS 기대치 조절 필요")
- `verdict` (string) — 장문 분석
- `src` (array) — 출처 [제목, URL] 쌍
- `recs` (array) — 추천 목록 [항목, 평가, 점수]
- `reasons` (object) — **점수별 근거** `{ad, trust, sat}` (각 점수를 그렇게 본 이유, 상세페이지에 "왜 이 점수?"로 노출)
- `tags` (array) — **해시태그** (분야·지역·키워드, '#' 없이). 상세페이지에서 클릭 → `index.html?tag=값`으로 같은 태그 필터. 예: `["베이커리","성수","에그타르트"]`
- **선택:** `def` (신조어, 한 줄 뜻 — 사전 카드·상세 요약) / `example` (신조어, 사용 예문 — 상세 '💬 이렇게 써요') / `fresh` (신조어, false면 한물간 처리 — 사전 '최신'에서 제외, '지난 유행어'로 보관) / `pureKorean` (신조어, 예쁜 우리말) / `prompt` (AI 명령어, 길고 디테일하게) / `stage` (트렌드·신조어의 유행 단계. 신조어의 경우 '끝물'·'한물'·'지남' 등으로 표시하면 신선도 게이트 제외) / `article` (블로그형 본문 블록) / `video` (유튜브 임베드, **oembed 200(임베드 가능)만**) / `images` (대표 이미지 — 비어있으면 auto-build.mjs가 출처의 og:image 자동 추출·주입) / `shops` (선택사항, **소문난 맛집 위주** 목록 — `[{name, rep?, area?, url?, note?}]` 배열. `rep`은 맛집 평판 한 줄(예:"성수 젤라또 맛집", 상세페이지 초록 배지). 디저트·음식 트렌드일 때만 채움. auto-build.mjs가 각 url 생존성 검증(404/410/ERR 제거, 이름·평판·지역·메모는 유지). 최대 6곳. **단순 유통(편의점·마트)은 제외, verdict나 본문에서만 언급.**)

---

## 개발 환경

- **OS:** Windows 11 / **셸:** PowerShell (Bash 도구도 사용 가능)
- **배포:** GitHub `GO9ME/aztomz` → Vercel 정적 배포, push 자동 재배포
- **Hermes(고구미봇):** 트렌드 수집·분석·검증을 돌리는 AI 에이전트(별도 `E:\workspace\side_project\hermes`). 검증 게이트(최신성·출처·본문 관련성)를 통과한 항목만 자동 게시·배포하고, 미통과 항목은 보류. → **[작동 방식 문서](docs/hermes.md)**
- **Hermes 수동 시작:** `tools/start-hermes.bat` **더블클릭** — 게이트웨이가 떠 있으면 알려주고, 꺼져 있으면 켜서 cron이 자동으로 돌게 한다(로그인 시 자동 시작도 등록돼 있어 평소엔 불필요). 같은 파일이 `hermes\start-hermes.bat`에도 복사돼 있다.
