# Hermes(고구미봇) — 한끗 트렌드 분석 에이전트

> 한끗의 콘텐츠(트렌드 수집·분석·검증·정리)는 사람이 다 하지 않는다.
> **Hermes 에이전트(디스코드 봇 "고구미봇")**가 돌리고, 사람은 **승인만** 한다.

Hermes는 [Nous Research](https://nousresearch.com)의 AI 에이전트 런타임으로, 디스코드 봇 + cron(예약작업) + 스킬(SKILL.md) 구조를 가진다. 한끗에서는 **"지금 진짜 뜨는 트렌드를 찾아 거품을 걸러 사이트에 올리는 일"**을 담당한다.

---

## 한눈에

```
사람: "한끗 실행"  ──▶  고구미봇이 아래를 한 세션에서 수행
                         │
   수집 ─▶ 분석 ─▶ 정리 ─▶ .pipeline/curate.json(후보)
                              │
                              ▼ (09:10 자동 진행)
                    auto-build.mjs 자동검증
                   (중복·404/410·관련성 제거)
                              │
                    검증통과분만 ┌─────────────────────────┐
                              │                           │
                              ▼                           ▼
      ✅ backend/data/trends.json 반영    ✋ 보류(거짓/무관/못읽음만)
                              │
          refresh.mjs ─▶ frontend/data/trends.js
                              │
          Vercel 자동 배포 ◀── git push(자동)
```

- **수집·분석:** 고구미봇 온디맨드(디스코드 "한끗 실행" 명령).
- **자동검증·게시:** auto-build.mjs가 아침 08:10 자동 실행 → 통과분만 사이트에 올라감 (사람 승인 불필요).
- **보류:** 출처가 404·무관·못읽음만 있는 항목은 자동 보류, 디스코드에 보고.

---

## 어디서 도는가

| 항목 | 값 |
|---|---|
| 위치 | `E:\workspace\side_project\hermes` (한끗 레포와 **별도**) |
| 환경변수 | `HERMES_HOME=E:\workspace\side_project\hermes` (안 하면 `~/.hermes`로 잘못 붙음) |
| CLI | `…\hermes\hermes-agent\venv\Scripts\hermes.exe` |
| 게이트웨이 | `hermes gateway install` — 윈도우 로그인 시 자동 시작(상시 떠 있어야 cron·봇 작동) |
| 디스코드 | 고구미봇#0488, home 채널 `1512147787339534346` |
| 작업 폴더 | 한끗 레포(`aztomz`) — `backend/data/*`, `.pipeline/`(중간파일) |

---

## 두뇌(모델)와 한계

| 항목 | 내용 |
|---|---|
| 모델 | `gemini-3-flash-preview` (Google 계정 OAuth = Code Assist) |
| 재시도 | `agent.api_max_retries=6` — 무료 **분당 한도(429)**를 백오프로 기다렸다 넘어감 |
| 검색 | `ddgs.exe`(DuckDuckGo, 키 불필요) — 브라우저(Chrome)는 안 됨 |
| 화제성 | `scripts/youtube_search.py`(YouTube Data API) — 조회수·댓글·업로드일 |
| **한계** | 무료 쿼터(분당 소량) + **cron 3분 하드제한** → 복잡한 자동 크론은 불가. **온디맨드(인터랙티브)** 또는 **가벼운 no-agent 크론**이 현실적 |

> ⚠️ 인스타·틱톡·페북 **직접 접근 금지**(ToS·로그인벽). 공개 검색(ddgs) + 유튜브 API만 사용.

---

## 스킬 12개

`hermes/skills/hangeut/<slug>/SKILL.md`. 전부 enabled.

### 파이프라인 (메인 트렌드)
| 스킬 | 역할 |
|---|---|
| `hangeut-run` | **원샷 오케스트레이터** — 수집→분석→정리를 한 세션에서 (검증 제외). 진입점("한끗 실행"). 결과는 `.pipeline/curate.json` 저장 |
| `hangeut-collect` | SNS·웹에서 전 분야(디저트·식당·카페·신조어·노래·패션·AI프롬프트) 수집 |
| `hangeut-review` | PRD 룰셋으로 광고/신뢰/만족 분석 (인게이지먼트 팟=품앗이 댓글 = 광고 신호) |
| `hangeut-curate` | JSON 정리·중복제거·디스코드 초안 |
| `hangeut-build` | **auto-build.mjs 래퍼** — 검증통과분만 trends.json 반영 + git push |
| `hangeut-design` | 새 카테고리/카드 디자인 제안 |

### 검증 게이트 (적대적 검증)
| 스킬 | "무엇을 의심하나" |
|---|---|
| `hangeut-verify` | **최신성** — "진짜 지금 뜨나?" 독립 재검색. 한물간 건 제외/강등 (지브리·약과 잡아냄) |
| `hangeut-source` | **출처 정확도** — 링크가 ① 살아있고(200) ② 본문이 그 트렌드를 실제 다루나. 200이어도 무관하면 가짜 출처로 교체 |

### 콘텐츠·자기개선
| 스킬 | 역할 |
|---|---|
| `hangeut-write` | 짧은 한 줄(verdict) 너머 **블로그형 본문(`article`)** — 문단 짧게·소제목·줄바꿈 깔끔 |
| `hangeut-bgm` | 쇼츠·릴스·틱톡 **유행 배경음악** 큐레이터 (음악은 제일 빨리 식어 유튜브 급상승으로 최신성 검증) |
| `hangeut-pulse` | **창업 트렌드 펄스** — 요일별 분야 로테이션, 트렌드별 상세 창업 아이디어 3개 |
| `hangeut-learn` | 사용자 피드백·정정("이건 광고 아냐")을 `learnings.md`에 기록 → 다음부터 반영 |

---

## 점점 똑똑해지는 루프

- **`SOUL.md`**(hermes home) — 고구미봇 페르소나. 가치 = 최신성 집착·거품 간파·정직·**자기개선**. 매 응답에 적용.
- **`learnings.md`**(aztomz 루트) — 누적 교훈(한물간 항목·광고 신호·소스 규칙·형식). 분석 전 **먼저 읽고** 적용, 새로 배운 건 한 줄 기록.
- 검증 스킬이 잡은 사실(어떤 게 한물감이었다 등)도 자동 기록 → 시간이 갈수록 실수가 줄어든다.

---

## 예약작업(cron)

상시 떠 있는 게이트웨이가 KST 기준으로 돌린다.

| 작업 | 주기 | 내용 |
|---|---|---|
| **한끗 자동 수집·게시** (신규) | 매일 08:10 | `hangeut-run`(수집·분석) → `auto-build.mjs`(자동검증·게시). 검증통과분만 사이트 반영 · git push → Vercel 배포 |
| **한끗 주간 갱신** (`dc54cec90b5e`) | 매주 월 06:30 | `hangeut_daily.py`(no-agent) — trends.json 날짜 스탬프 + 신선도 리포트. 무료·안 죽음 |
| **한끗 펄스 — 오늘의 분야** (`f3a0b6724fa4`) | 매일 07:00 | `pulse_categories.py`(no-agent) — 오늘 분석할 펄스 분야를 디스코드로 안내 |

### 펄스 요일별 분야 로테이션
11개 분야를 요일로 쪼개 **매일 1~2분야씩 → 일주일에 1회전**(한 번에 11개 몰아치던 무료 쿼터 부담 해소).

| 요일 | 분야 | | 요일 | 분야 |
|---|---|---|---|---|
| 월 | 테크·금융 | | 금 | 교육·엔터 |
| 화 | K뷰티·패션 | | 토 | 라이프 |
| 수 | 헬스·등산 | | 일 | 종합 검수·정리 |
| 목 | 푸드·관광 | | | |

> cron은 **안내(무료·안정)**까지만 자동. **실제 AI 분석**은 쿼터·3분 제한 때문에 온디맨드("한끗 펄스")로 오늘 분야만 깊게 돈다. 완전 자동을 원하면 Gemini 결제 또는 GitHub Actions에 키 등록으로 풀 수 있다.

> 메인 트렌드 데이터 갱신(재생성)은 GitHub Actions `weekly-refresh`(매주 월)가 `backend/scripts/refresh.mjs`를 돌려 `frontend/data/trends.js`를 만든다.

---

## 디스코드에서 쓰는 법 (온디맨드)

| 명령 | 동작 |
|---|---|
| `한끗 실행` | hangeut-run — 수집·분석·정리 후 `.pipeline/curate.json` 저장. (다음날 08:10 자동검증·게시 또는 "한끗 개발 반영"으로 수동 실행) |
| `한끗 개발 반영` | hangeut-build(auto-build.mjs 호출) — curate.json 항목을 자동검증 후 통과분만 trends.json 반영 + git push |
| `한끗 펄스` | 오늘 요일의 창업 트렌드 분야를 깊게 분석 (상세 아이디어 3개) |
| `한끗 디자인` | 새 카드 디자인 제안 |
| `기억해둬: …` | hangeut-learn — 교훈을 learnings.md에 기록 |

---

## 사이트와의 접점 (데이터 흐름)

```
고구미봇 ─writes─▶ .pipeline/curate.json (후보)
                        │
                        ▼
            auto-build.mjs (자동검증: 중복·404·관련성)
                        │
        검증통과분 ──▶ backend/data/trends.json (canonical 원본)
                        │ node backend/scripts/refresh.mjs
                        ▼
                frontend/data/trends.js (window.HANGEUT_DATA, 생성물·편집금지)
                        │ git push (자동)
                        ▼
                    Vercel 배포
                        │
                        ▼
                사이트(index/trend/pulse.html)가 로드
```

- 고구미봇이 채우는 **상세페이지 필드**: `verdict`(한 줄) · `article`(블로그형 본문) · `video`(유튜브/틱톡 임베드) · `images`(대표 이미지) · `prompt`(AI 명령어, 길고 디테일하게) · `pureKorean`(신조어 우리말).
- auto-build.mjs가 **검증 게이트**: 중복(id/title 기존재) 제거 · 404/410 링크 제거 · 본문에 제목 핵심어 없으면 무관으로 제거.
- 펄스(창업 레이더)는 `backend/data/pulse.json`의 `daily[]`(주간 픽)만 소유. 빌트인 110개(`trends[]`)는 read-only.

---

## 핵심 원칙

1. **자동 게시(검증 통과분만)** — auto-build.mjs가 출처 자동검증 후 통과분만 사이트 반영. 거짓·무관·404 출처만 있으면 자동 보류.
   - 검증 게이트: 중복(id/title) · 404/410(죽음) · 본문 관련성(제목 핵심어 0개면 무관)
   - 잘못 올라간 건 **사후에 사람이** 수정/삭제. 최종 책임은 사람.
2. **거짓 신선도 금지** — 실제 재분석한 것만 오늘 날짜(`analyzedAt`). 안 한 항목은 그대로.
3. **추측 출처 금지** — 검색결과 실제 URL만. auto-build.mjs가 404/410 + 본문 관련성 검증.
4. **정직** — 끝물·거품·광고 의심은 또렷이. 점수는 추정치.
5. **절대경로 사용** — Hermes 봇의 CWD가 C:\Users\admin이라, 모든 node/python 명령은 절대경로로 실행(상대경로 금지).

자세한 분석 룰은 [docs/prd.md](prd.md), 누적 교훈은 [learnings.md](../learnings.md) 참고.
