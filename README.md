# 한끗 — 트렌드 번역소

> **AZ와 MZ는 한 끗 차이** | 요즘 유행(밈·신조어·음식·디저트·핫플)을 1분에 번역하고, SNS 맛집이 광고인지 실후기인지 분석해주는 모바일 웹.

## 구조 한눈에

| 파일·경로 | 역할 |
|---|---|
| `frontend/` | ★ 배포 대상(Vercel `outputDirectory`). 브라우저가 받는 정적 파일 전부 |
| `frontend/index.html` | 홈 — 오늘의 한끗·광고일까 진짜일까 미리보기(상위 6개)·요즘 트렌드 미리보기(상위 8개) + 더보기 → 전체 목록 |
| `frontend/trend.html?id=` | 상세 — 점수(광고의심도/신뢰도)·만족도·판단·추천·출처·후기 |
| `frontend/list.html` | 전체 목록 — `?type=ad\|trend` + `?cat=` + `?page=` (페이지네이션) |
| `frontend/{login,signup,me,pulse}.html` | 인증·마이페이지·트렌드 펄스 |
| `frontend/assets/styles.css`·`app.js`·`pulse.js` | 디자인 시스템 / 모의 스토어(H.*) / 펄스 |
| `frontend/data/trends.js`·`pulse.js` | 브라우저가 로드하는 **생성물** — **직접 편집 금지** |
| `backend/` | 비공개(배포 안 됨) — 데이터 원본 + 빌드 스크립트 |
| `backend/data/trends.json`·`pulse.json` | ★ **canonical 데이터 원본** (사람·스크립트가 수정) |
| `backend/scripts/auto-build.mjs` | **자동 게시 엔진** — 출처 자동검증(404/410/관련성) · 중복 제거 · 통과분만 trends.json 반영 · git push |
| `backend/scripts/recheck-ad.mjs` | **광고/진짜 일일 재확인** — 가장 오래된 신뢰분석 1건의 출처 재검증(ddgs) → 살아있으면 analyzedAt=오늘 갱신(→ 홈 featured 회전) |
| `backend/scripts/refresh.mjs` 등 | 일일 갱신·출처검증·이미지 스크립트 |
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
node backend/scripts/refresh.mjs   # backend/data/trends.json → frontend/data/trends.js 재생성 (레포 루트에서)
```

> trends.json을 직접 편집한 후, 이 스크립트를 실행하면 trends.js가 자동 생성됩니다.  
> **trends.js는 직접 편집하지 마세요** — refresh.mjs의 생성물입니다.

---

## 데이터 흐름

```
.pipeline/curate.json (Hermes가 생성한 후보 항목들)
    ↓
backend/scripts/auto-build.mjs (자동검증: 중복 제거 · 출처 404/410 제거 · 본문 관련성 검증)
    ↓
검증 통과분만 → backend/data/trends.json (canonical 원본)
    ↓
backend/scripts/refresh.mjs (validation + 생성)
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
- **[docs/architecture.md](docs/architecture.md)** — 시스템 구조·백엔드 전환 계획
- **[docs/hermes.md](docs/hermes.md)** — 🤖 **Hermes(고구미봇) 작동 방식** — 파이프라인·스킬 12개·검증 게이트·cron
- **[docs/menus/](docs/menus/)** — 메뉴별 상세 문서
  - [홈](docs/menus/home.md) / [사전](docs/menus/dictionary.md) / [음식](docs/menus/food.md) / [디저트](docs/menus/dessert.md) / [핫플](docs/menus/hotplace.md)
  - [광고분석](docs/menus/ad-or-real.md) / [검색](docs/menus/search.md) / [공유](docs/menus/share.md)
  - [마이페이지](docs/menus/mypage.md) / [인증](docs/menus/auth.md)
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
| **신조어** | 출처에 "2024 신조어" 류 표시면 2026.6 기준으로 한물 의심. 재검증 필수 |
| **게시 정책** | auto-build.mjs가 출처 검증(관련성·생존성) 후 통과분만 자동 게시. 거짓·무관·404 출처만 있으면 자동 보류 |

---

## 데이터 스키마

각 trend 항목:
- `id` (string) — 고유 키
- `type` (string) — "신뢰분석" | "트렌드"
- `cat` (string) — 카테고리 (디저트·성수 카페·AI 프롬프트 등)
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
- **선택:** `pureKorean` (신조어) / `prompt` (AI 명령어, 길고 디테일하게) / `stage` (트렌드) / `article` (블로그형 본문 블록) / `video` (유튜브 임베드, **oembed 200(임베드 가능)만**) / `images` (대표 이미지)

---

## 개발 환경

- **OS:** Windows 11 / **셸:** PowerShell (Bash 도구도 사용 가능)
- **배포:** GitHub `GO9ME/aztomz` → Vercel 정적 배포, push 자동 재배포
- **Hermes(고구미봇):** 트렌드 수집·분석·검증을 돌리는 AI 에이전트(별도 `E:\workspace\side_project\hermes`). 스킬 12개 · 검증 게이트 2종(최신성·출처) · cron(주간 트렌드 갱신 + 펄스 요일 로테이션). 사이트 반영은 **사람 승인 후**. → **[작동 방식 문서](docs/hermes.md)**
- **Hermes 수동 시작:** `tools/start-hermes.bat` **더블클릭** — 게이트웨이가 떠 있으면 알려주고, 꺼져 있으면 켜서 cron이 자동으로 돌게 한다(로그인 시 자동 시작도 등록돼 있어 평소엔 불필요). 같은 파일이 `hermes\start-hermes.bat`에도 복사돼 있다.
