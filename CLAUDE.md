# 한끗 (az2mz) — 프로젝트 가이드 (CLAUDE.md)

> 정식명: **AZ와 MZ는 한 끗 차이** · 서비스명: **한끗** · 레포: **az2mz**
> 요즘 유행(밈·신조어·음식·디저트·핫플)을 1분에 번역하고, SNS 맛집이 광고인지 실후기인지
> 분석해주는 모바일 웹. 의존성 0·빌드 0 정적 멀티페이지. (자세히는 [docs/architecture.md](docs/architecture.md))

---

## 구조 한눈에

| 경로 | 역할 |
|---|---|
| `frontend/` | ★ 배포 대상(Vercel `outputDirectory`). 브라우저가 받는 정적 파일 |
| `frontend/index.html` | 홈 — 오늘의 한끗·급상승·광고일까 진짜일까·요즘 트렌드 |
| `frontend/trend.html?id=` | 상세 — 점수(광고/신뢰)·만족도·한끗 판단·추천·출처·후기 |
| `frontend/{login,signup,me,pulse}.html` | 인증 · 마이페이지(내 한끗) · 트렌드 펄스 |
| `frontend/assets/styles.css`·`app.js`·`pulse.js` | 디자인 시스템 / 목 스토어(`H.*`) / 펄스 |
| `frontend/data/trends.js`·`pulse.js` | `backend/scripts`가 생성 — **직접 편집 금지** |
| `backend/` | 비공개(배포 안 됨) — 원본 데이터 + 스크립트 |
| `backend/data/trends.json`·`pulse.json` | ★ **canonical 데이터 원본** (사람·스크립트가 수정) |
| `backend/scripts/refresh.mjs` · `check-links.mjs` · `check-source.mjs` 등 | 일일 갱신 / 출처 검증 / 이미지 |
| `.github/workflows/daily-refresh.yml` | 매일 06:00 KST 크론 갱신 |
| `docs/` · `README.md` · `learnings.md` | 문서 (아래 정책으로 자동 최신화) |

---

## 📌 문서 자동 최신화 정책 (필수)

**작업의 범위·기능·메뉴·데이터 스키마·배포 방식이 바뀌면, 마무리 단계에서 반드시
`docs-organizer` 서브에이전트(haiku 모델)를 호출해 문서를 최신화한다.** 본 작업과 분리해
저렴한 haiku로 돌려서 비용을 아끼고, 메인 작업의 컨텍스트를 흐리지 않는다.

호출 방법 — `Agent` 도구:

```
Agent(
  subagent_type: "docs-organizer",   // .claude/agents/docs-organizer.md (haiku 고정)
  description: "문서 최신화",
  prompt: "이번 변경 요약: <무엇이 어떻게 바뀌었는지 2~5줄>. 변경 파일: <목록>."
)
```

> `docs-organizer`가 등록 안 됐으면 `subagent_type: "general-purpose"` + `model: "haiku"`로
> 같은 작업을 시키고, 에이전트 정의 파일([.claude/agents/docs-organizer.md](.claude/agents/docs-organizer.md))의
> 지침을 그대로 전달한다.

### 대상 문서

- **`README.md`** (루트) — 개요·구조·로컬 실행·배포·문서 인덱스
- **`docs/prd.md`** — 사실 변동(메뉴·네이밍·콘텐츠 수량·기능 포함여부 등)만 반영.
  기획 스펙 본문은 **함부로 재작성하지 않고** 드리프트만 교정 (큰 변경은 제안으로 보고)
- **`docs/menus/*.md`** — 메뉴별 문서. 각 문서: 목적 · 진입 화면 · 표시 데이터 필드 ·
  현재 구현 상태 · 관련 코드/데이터 위치

### 트리거 (호출하는 경우)

- 메뉴·화면 추가/삭제/이름 변경
- `data/trends.json` 필드(스키마) 변경
- 기능(검색·저장·후기·광고분석·공유 등) 추가/변경
- 배포·파이프라인·cron·스크립트 변경
- 네이밍·전략 변경

### 호출하지 않는 경우

- 오타·미세 스타일 수정, 콘텐츠 1~2건 추가 등 **문서에 영향 없는 변경**
- 진행 중(미완성) 작업 — 완료·검증 후 한 번만 호출

### 메뉴별 문서 목록 (`docs/menus/`)

| 파일 | 메뉴 |
|---|---|
| `home.md` | 오늘의 한끗 (홈) |
| `dictionary.md` | MZ어 / 밈 사전 |
| `food.md` | 요즘 음식 |
| `dessert.md` | 요즘 디저트 |
| `hotplace.md` | 요즘 핫플 |
| `ad-or-real.md` | 광고일까 진짜일까 |
| `search.md` | 검색 |
| `share.md` | 공유 |
| `mypage.md` | 내 한끗 (마이페이지) |
| `auth.md` | 로그인 / 회원가입 |

---

## 🚫 철칙 (Rules) — 다시는 반복하지 않기

> 작업 전 [learnings.md](learnings.md)를 **먼저 읽고** 적용한다. 아래는 반복 사고를 막는 고정 규칙.
> 새 교훈이 생기면 `learnings.md`에 한 줄 추가하고, 영구·치명적인 것은 이 절에도 올린다.

### 데이터 · 생성물

- `frontend/data/trends.js`는 **생성물 → 손대지 않는다.** `backend/data/trends.json`만 고치고
  `node backend/scripts/refresh.mjs`로 재생성한다. canonical 원본은 항상 `backend/data/trends.json`.
- **거짓 신선도 금지.** `analyzedAt`은 **실제로 재분석한 항목만** 오늘 날짜로 갱신.
  안 한 항목은 그대로 둬서 "갱신 필요"로 정직하게 노출되게 한다. (신뢰가 제품의 본질)

### 출처 · 검증

- **출처 URL 추측·단축·조립 금지.** 검색 결과에 **실제로 나온 URL만** 쓴다.
  반영 전 `node backend/scripts/check-links.mjs`로 상태(404) 점검.
- **200 OK여도 본문이 그 트렌드를 안 다루면 가짜 출처.**
  `node backend/scripts/check-source.mjs [파일] [--only=id,id]`로 본문 관련성을 확인한다.
- ddgs·파이썬 호출 시 **`PYTHONIOENCODING=utf-8`(또는 `PYTHONUTF8=1`) 강제.**
  안 하면 Windows cp949 크래시로 한글 키워드가 0으로 잡혀 멀쩡한 출처를 '무관'으로 오판한다.
- 다이닝코드 `profile.php`·인스타그램 페이지는 본문을 못 읽는다(JS앱/로그인벽).
  출처는 **본문이 실제로 읽히는 링크**(tistory·언론기사·trip.com 등)로 쓴다.

### 콘텐츠 판단

- 모든 점수(광고 의심도·후기 신뢰도)는 **추정치이며 확정 판정이 아니다.** 단정 표현 금지.
- **후기 신뢰도(믿을 만한가) ≠ 만족도(좋은가)** — 별개 축으로 분리해서 표기한다.
- **트렌드·신조어도 빨리 늙는다.** 출처가 "2024 신조어" 류면 한물 의심.
  지금(2026 상반기) 기준으로 재검증한다.
- 세대 비하 금지. "아재" 표현은 유머로만, 공격적으로 쓰지 않는다.

### 파이프라인 · 운영

- **자동 게시 금지.** 일일 파이프라인은 **검수용 초안**만 디스코드에 올린다.
  `data/trends.json` 반영은 **사람 승인 후** `hangeut-build`가 한다.
- 인스타/틱톡/페북 **직접 스크래핑 금지(ToS).** ddgs 공개검색 + 유튜브 API만 사용.
- 실서비스(Supabase) 전환 시 **UI/페이지는 손대지 말고** `app.js`의 `H.*` 내부 구현만 교체.

### 비밀 · 보안

- 목 인증은 **데모 전용.** 실서비스 비밀번호 운영에 절대 쓰지 않는다.
- **API 키·토큰을 코드·문서·커밋에 남기지 않는다.** 비밀은 `.claude/`·`.env`(둘 다 gitignore)에만.

---

## 환경 메모

- OS: Windows 11 / 셸: PowerShell (Bash 도구도 사용 가능)
- 배포: GitHub `GO9ME/aztomz`(public) → Vercel 정적 배포, push마다 자동 재배포
- Hermes(고구미봇): 별도 레포 `E:\workspace\side_project\hermes`. cron 2개(07:00 갱신·07:30 리서치 초안)
