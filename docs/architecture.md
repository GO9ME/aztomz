# 한끗 — 구조 & 백엔드 전환 계획

## 현재 구조 (정적 멀티페이지 + 목 백엔드)
의존성 0, 빌드 0. 어디든(Vercel/GitHub Pages) 즉시 배포.

```
frontend/  ← Vercel outputDirectory(이것만 배포). backend/  ← 원본·스크립트(비공개)
frontend/index.html      홈 — 마스트헤드 · 피처드 · "광고일까 진짜일까" 랭킹 인덱스 · "요즘 트렌드" 스트립
frontend/trend.html?id=  상세 — 점수(광고/신뢰)·만족도·한끗 판단·추천·출처·방문자 후기(작성/목록)·함께 보기
frontend/login.html      로그인 (?next= 리다이렉트)
frontend/signup.html     회원가입 (?next=)
frontend/me.html         내 한끗 — 저장한 트렌드 · 내가 쓴 후기 · 로그아웃 (비로그인 시 login으로 가드)
frontend/pulse.html      트렌드 펄스 — 창업 트렌드 레이더(pulse.js·pulse-refresh.mjs)
frontend/assets/styles.css  에디토리얼 디자인 시스템 (DESIGN.md 참고)
frontend/assets/app.js      목 스토어(H.*) + 신선도 계산 + 마스트헤드/리뷰/저장 헬퍼
backend/data/trends.json   ★ 데이터 원본(canonical). 사람/스크립트가 수정.
frontend/data/trends.js     ← backend/scripts/refresh.mjs가 trends.json에서 생성(편집 금지). 사이트가 로드.
backend/scripts/refresh.mjs  일일 갱신: 재수집·재분석(hermes 플러그) + generatedAt=오늘 + frontend/data/trends.js 생성
.github/workflows/daily-refresh.yml  매일 06:00 KST 크론 → refresh 실행 → 변경분 커밋
```

데이터·인증·저장·리뷰는 모두 `assets/app.js`의 `H.*` 인터페이스를 통한다.
현재 구현은 `localStorage` 기반 **프로토타입**(비밀번호는 단순 해시 — 실보안 아님).

## 검증된 플로우 (2026-06-05)
회원가입 → (중복 이메일 차단) → 저장 → 후기 작성(별점/길이 검증) → 마이페이지에 저장·후기 표시
→ 로그아웃 → me.html 접근 시 login?next=me.html 으로 가드. 전부 동작 확인.

## 실서비스 전환: 목 → Supabase
**UI/페이지는 손대지 않는다.** `app.js`의 `H.*` 함수 내부 구현만 교체.

| 목(localStorage) | Supabase 대체 |
|---|---|
| `H.signup/login/logout/user` | `supabase.auth.signUp / signInWithPassword / signOut / getUser` |
| `H.saves/toggleSave/isSaved` | `saves` 테이블 (user_id, trend_id) + RLS(본인 행만) |
| `H.reviews/addReview/myReviews` | `reviews` 테이블 (user_id, trend_id, rating, text, created_at) + RLS |
| `TRENDS` 배열 | `trends` 테이블 (또는 hermes가 매일 upsert) — `H.TRENDS`만 fetch로 교체 |

전환 순서: ① Supabase 프로젝트 생성 → ② 테이블 + RLS 정책 → ③ `app.js`의 STORE 레이어를
async로 바꾸고 호출부에 `await` 추가 → ④ 인증을 비밀번호 또는 카카오 OAuth로.
`H.*`가 Promise를 반환하게 되면 호출하는 페이지의 핸들러만 async/await로 소폭 수정.

## 오늘 기준 신선도 & 매일 자동 갱신
- 사이트는 항상 **브라우저 `new Date()`(오늘)** 대비 각 항목 `analyzedAt`으로 신선도를 라이브 계산:
  0일=「오늘 분석」, 1~3일=「N일 전」(초록), 4~13일=「N일 전」(중립), **14일+=「갱신 필요」(빨강) + 상세 경고 배너**.
- 마스트헤드·홈 발행라인·인덱스 행·상세에 신선도 칩 노출 → 이용자가 분석이 언제 것인지 즉시 확인.
- **거짓 신선도 금지:** refresh.mjs는 재분석한 항목만 `analyzedAt`을 오늘로 갱신. 안 한 항목은 그대로 둬서
  오래된 분석이 "갱신 필요"로 정직하게 표시됨(신뢰가 제품의 본질).
- 흐름: `backend/data/trends.json`(원본) → `backend/scripts/refresh.mjs`(hermes 재수집·재분석 + 날짜 스탬프) → `frontend/data/trends.js`(생성) → 사이트.
  로컬 수동 실행: `node backend/scripts/refresh.mjs`(레포 루트에서). 운영: GitHub Action 크론(매일 06:00 KST).
- hermes 연결 지점: `backend/scripts/refresh.mjs`의 `collectAndAnalyze()` (현재 no-op TODO).

## 다음에 붙일 만한 리텐션 기능
- 저장 알림 / "이번 주 한끗" 구독(이메일·푸시)
- hermes가 매일 `trends` 자동 upsert → 콘텐츠 신선도(재방문 동력)
- 후기 좋아요·신고, 작성자 평판
- 개인화: 저장·후기 기반 추천

## 보안 메모 (실서비스 전 필수)
- 현재 목 인증은 **데모 전용**. 절대 실제 비밀번호 운영에 쓰지 말 것.
- 전환 시 RLS로 본인 데이터만 접근, 리뷰 입력 서버측 검증/욕설 필터, 레이트리밋.
