# 한끗 — 정적 멀티페이지 구조

## 현재 구조
의존성 0, 빌드 0. `frontend/`만 Vercel이 서빙하고, `backend/`는 데이터 원본과 운영 스크립트를 담는 비배포 영역이다.

```
frontend/  ← Vercel outputDirectory(이것만 배포)
backend/   ← canonical 데이터·검증·생성 스크립트(비공개)

frontend/index.html      홈 — 오늘의 한끗 · 광고일까 진짜일까 · 요즘 트렌드
frontend/list.html       전체 목록 — 광고분석/트렌드 목록 + 페이지네이션
frontend/trend.html?id=  상세 — 점수 · 만족도 · 판단 · 출처 · 후기 · 함께 보기
frontend/dictionary.html MZ 사전 — 신조어 검색/열람
frontend/login.html      로그인 없이 사용 안내(noindex)
frontend/signup.html     가입 없이 사용 안내(noindex)
frontend/me.html         내 보관함 — 저장한 트렌드 · 내가 쓴 후기 · 펄스 아이디어
frontend/pulse.html      트렌드 펄스 — 창업 트렌드 레이더
frontend/assets/styles.css  warm paper 기반 Neo Editorial Trend Radar 디자인 시스템
frontend/assets/app.js      H.* 로컬 스토어 추상화 + 공통 UI 헬퍼
backend/data/trends.json ★ 트렌드 canonical 원본
frontend/data/trends.js  ← backend/scripts/refresh.mjs 생성물(직접 편집 금지)
```

## 운영 원칙
- 한끗은 현재 **정적 멀티페이지 + 정적 데이터 갱신 + localStorage 기반 로컬 개인화**로 운영한다.
- 저장/후기/펄스 아이디어는 서버 계정 없이 브라우저 localStorage에 저장되는 개인화 기능이다.
- 로컬 개인화 데이터는 공개 서버에 저장되지 않고, 다른 브라우저나 다른 기기와 동기화되지 않는다.
- `H.*`는 로컬 스토어 추상화 계층으로 유지한다. 향후 백엔드를 붙이더라도 우선 교체 대상은 `H.*` 내부이며, 페이지 UI 계약은 유지한다.
- UI 톤은 `frontend/assets/styles.css`의 warm paper, bento editorial grid, compact radar cards 원칙을 따른다.
- Supabase 전환은 현재 확정 계획이 아니다. 필요가 생기면 별도 RFC/마이그레이션 계획으로 다시 검토한다.

## 로컬 스토어 계약
`frontend/assets/app.js`의 `H.*`가 브라우저 저장소를 감싼다.

| 인터페이스 | 현재 저장소 | 역할 |
|---|---|---|
| `H.signup/login/logout/user` | deprecated | 오래된 링크/스크립트 안정성을 위해 남긴 호환 API |
| `H.saves/toggleSave/isSaved` | `hangeut.saves` | 단일 로컬 보관함의 저장한 트렌드 ID |
| `H.reviews/addReview/myReviews` | `hangeut.reviews` | 이 브라우저에 남긴 방문자 후기 |
| `H.pulseIdeas` | `hangeut.pulseIdeas` | 펄스에서 저장한 창업 아이디어 |
| `H.TRENDS`, `H.trend(id)` | `frontend/data/trends.js` | 생성된 정적 트렌드 데이터 |

## 데이터 흐름
```
.pipeline/curate.json (선택: Hermes 후보)
    ↓
backend/scripts/auto-build.mjs (선택: 출처 검증 + canonical 병합)
    ↓
backend/data/trends.json (canonical 원본)
    ↓
backend/scripts/validate-trends.mjs (스키마 게이트; auto-build 내부/수동 점검)
    ↓
backend/scripts/refresh.mjs (generatedAt 갱신 + trends.js 생성)
    ↓
frontend/data/trends.js (브라우저 로드)
    ↓
frontend/*.html
```

`frontend/data/trends.js`는 생성물이므로 직접 편집하지 않는다. `backend/data/trends.json`을 수정한 뒤 사이트 데이터에 반영하려면 `node backend/scripts/refresh.mjs`를 실행한다.

## 신선도 원칙
- `analyzedAt`은 실제로 재분석한 항목만 갱신한다.
- `refresh.mjs`는 정적 데이터 파일을 다시 생성하고 `generatedAt`을 실행일로 찍지만, 개별 항목의 `analyzedAt`을 임의로 오늘로 바꾸지 않는다.
- 사이트는 브라우저의 `new Date()` 대비 각 항목 `analyzedAt`으로 신선도 칩을 계산한다.
- 오래된 분석은 숨기지 않고 "갱신 필요"로 노출한다. 거짓 신선도는 금지한다.

## 자동/수동 갱신
- 트렌드 정적 데이터 생성: GitHub Actions `weekly-refresh`가 매주 월요일 06:00 KST에 `backend/scripts/refresh.mjs`를 실행한다. 수동 `workflow_dispatch`도 가능하다.
- 펄스 데이터: GitHub Actions `pulse-daily`가 매일 07:00 KST에 펄스 데이터를 갱신한다.
- 로컬 Hermes 운영과 검증 게이트의 자세한 흐름은 [docs/hermes.md](hermes.md)를 따른다.

## 보안 메모
- 로그인/가입은 현재 일반 플로우에서 사용하지 않는다. `login.html`, `signup.html`은 안내 페이지로만 유지한다.
- 사용자가 브라우저 데이터를 지우거나 다른 기기를 쓰면 저장, 후기, 펄스 아이디어가 이어지지 않는다.
- 공개 후기처럼 보이지만 현재는 해당 브라우저 안에서만 보이는 로컬 후기다.
