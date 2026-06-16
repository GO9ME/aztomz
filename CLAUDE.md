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
| `frontend/dictionary.html` | MZ 사전 — 검증된 신조어 카드(뜻·예문·순화어·출처) 검색/열람 |
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
| `dictionary.md` | MZ 사전 (dictionary.html) |
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
- **트렌드 `cat`은 정규 7분류만**: 디저트 · 맛집 · 카페·핫플 · 신조어 · 노래·챌린지 · 패션 · AI 프롬프트.
  "디저트·음료" 같은 세분 카테고리 신설 금지(홈 필터가 1개짜리 칩으로 파편화). 지역·세부는 title/tags로.

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
- **영상(`video`)은 임베드 가능한 것만.** 상세페이지에 넣는 유튜브 영상은 oembed가 200이어야 한다
  (`youtube.com/oembed?url=...` → 401/404면 '재생 없음'으로 떠 안 쓴다). `youtube_search.py`가 `✅임베드` 표시.

### 파이프라인 · 운영

- **자동 게시(검증 통과분만).** 일일 파이프라인은 봇이 수집·분석 후 `backend/scripts/auto-build.mjs`로
  **출처를 자동검증**해 통과한 항목만 `backend/data/trends.json`에 반영하고 **git push(자동 배포)**한다.
  사람 승인 대신 **자동 검증이 게이트** — 죽음(404)·무관·못읽음 출처만 있는 항목은 자동 보류(미게시).
  · 검증·JSON병합·git은 **결정적 스크립트가 전담**(봇이 trends.json·git을 직접 만지지 않는다).
  · 잘못 올라간 게 있으면 **사후에** 사람이 수정·삭제(자동은 검증 통과까지, 최종 책임은 사람).
  · 일일 에이전트 크론: **21:30 `한끗 자동 수집·게시`**(hangeut-run→auto-build). 요일 로테이션 → **목 = 신조어**(주간 사전 갱신). 저녁 시간대(아침엔 PC가 꺼져 있어서).
  · **503 자동복구(모델 교체 아님).** Gemini가 21시대 용량초과(503/429)로 죽는 날을 위해, **22:00 `한끗 수집 재시도 게이트`**(no-agent, `hangeut_retry_gate.py`)가 그날 수집이 `error`면 **같은 모델로 1회 재실행**(성공·미실행이면 no-op). ⚠️ 단, 오늘(2026-06-16)처럼 프리뷰 모델이 **수 시간 지속 과부하**면 재시도도 503 — 같은 모델 유지로는 그날 누락 불가피(다음날 21:30이 메꿈). PC가 ~22:30까지만 켜져 있어 재시도 창도 그 안.
- **광고/진짜 일일 재확인.** "광고일까 진짜일까"는 카테고리와 무관하게 **매일 1건**(가장 오래된 신뢰분석)을
  `backend/scripts/recheck-ad.mjs`로 출처 재검증한다(결정적·LLM 없음). 살아있는 출처가 1개+면 `analyzedAt`을
  오늘로 갱신 → **홈 '오늘의 한끗'이 그 항목으로 회전**(고정 아님). 0개면 갱신 안 하고 '사람 확인 필요' 보고.
  · 일일 no-agent 크론: **21:15 `한끗 광고/진짜 일일 재확인`**(recheck_ad.py→recheck-ad.mjs). 메인 수집(21:30)보다 먼저 끝나 trends.json 쓰기 충돌 없음(결정적·빠름).
- 인스타/틱톡/페북 **직접 스크래핑 금지(ToS).** ddgs 공개검색 + 유튜브 API만 사용.
- 실서비스(Supabase) 전환 시 **UI/페이지는 손대지 말고** `app.js`의 `H.*` 내부 구현만 교체.

### 비밀 · 보안

- 목 인증은 **데모 전용.** 실서비스 비밀번호 운영에 절대 쓰지 않는다.
- **API 키·토큰을 코드·문서·커밋에 남기지 않는다.** 비밀은 `.claude/`·`.env`(둘 다 gitignore)에만.

---

## 환경 메모

- OS: Windows 11 / 셸: PowerShell (Bash 도구도 사용 가능)
- 배포: GitHub `GO9ME/aztomz`(public) → Vercel 정적 배포, push마다 자동 재배포
- Hermes(고구미봇): 별도 레포 `E:\workspace\side_project\hermes`. cron은 **전부 KST 21~22시대(저녁, PC 켜진 시간대)** — 펄스/수집 분야 안내 21:00, 주간 갱신 월 21:00, 광고/진짜 재확인 21:15, 메인 `한끗 자동 수집·게시` **21:30**(목=신조어 주간 사전), **수집 재시도 게이트 22:00**(503 실패시에만 같은 모델 재실행). ⚠️ Hermes는 로컬이라 **그 시각에 PC+게이트웨이가 켜져 있어야** 실행됨(`tools/start-hermes.bat`). PC는 보통 ~22:30까지만 켜짐.
  Gemini 무료 OAuth가 21시대에 구글측 429(용량)로 막히는 일이 있음. 타사 폴백은 검토 후 폐기
  (OpenRouter 키들은 크레딧 $0 무료 계정이라 유료 모델 불가, Anthropic OAuth는 서드파티 앱이
  extra usage 크레딧 필요) — **Gemini 단독 운용 확정**(2026-06-11).
  기본 모델 **`gemini-3-flash-preview` 단독 운용** — 폴백 없음(`fallback_providers: []`, 사용자 결정).
  lite 계열은 리서치를 대충 해 기본으론 부적합(폴백 후보로만 유효). 429가 길거나 프리뷰 모델이
  은퇴(404)하면 크론이 실패하니, 그날은 수동 재실행하거나 `hermes config`에서 모델 교체.
  그래도 크론이 429로 죽은 날은 나중에 `hermes cron run 9ddacd750b48`로 수동 재실행.
  OpenRouter 키는 hermes에서 해지함(`.env` 주석 + auth 풀 삭제, 백업 `auth.json.bak.20260611_openrouter`).
