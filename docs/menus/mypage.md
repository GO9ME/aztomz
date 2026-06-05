# 내 한끗 (마이페이지)

## 목적
로그인 사용자의 저장한 트렌드·내가 쓴 후기를 모아서 보기. 개인화 기반.

## 진입·화면
- **파일:** me.html
- **가드:** 비로그인 시 login.html?next=me.html 으로 리다이렉트 (me.html L40~41)
- **섹션 1: 프로필** — 사용자명·이메일·로그아웃 버튼 (L46~51)
- **섹션 2: 저장한 트렌드** — 저장 목록 (L53~54, renderSaved)
- **섹션 3: 내가 쓴 후기** — 후기 목록 (L56~57, renderMyReviews)

## 표시 데이터
- `H.user()` → {name, email} (localStorage 'hangeut.session')
- **저장 목록:**
  - `H.saves()` → 사용자 저장 ID 배열
  - 각 아이템: 트렌드 id·title·label·coverCat·analyzedAt
  - 버튼: "저장 해제" (L75)
  
- **후기 목록:**
  - `H.myReviews()` → [{trendId, rating, text, ts, ...}]
  - 각 후기: 트렌드 제목·별점·작성일·텍스트 (L85~88)

## 현재 상태
구현됨. 로그인 흐름·저장 토글·후기 작성·마이페이지 표시·로그아웃 전부 동작 확인 (2026-06-05).

## 관련 코드
- `me.html` : 전체 마크업 + 렌더링 스크립트 (L1~91)
- `assets/app.js` : 
  - `H.user()` (L49)
  - `H.saves()` / `H.toggleSave()` / `H.isSaved()` (L72~83)
  - `H.myReviews()` / `H.addReview()` (L86~98)
  - `H.logout()` (L70)
- `data/trends.js` : H.TRENDS (후기에서 트렌드 정보 조회)

## 비고
- **인증 가드:** me.html 로드 시 H.user() 체크 → null이면 login?next=me.html 리다이렉트 (L40~41)
- **저장 해제:** 버튼 클릭 → H.toggleSave() 호출 → renderSaved() 재실행 (L77)
- **로그아웃:** 버튼 클릭 → H.logout() + toast 알림 → index.html 이동 (L61)
- **빈 상태:** 저장/후기 없으면 빈 화면 메시지 + 홈 이동 버튼 (L70, L84)
- **실서비스 전환:** H.user()/H.saves()/H.myReviews() 내부 구현만 Supabase로 교체 (docs/architecture.md 참고)
