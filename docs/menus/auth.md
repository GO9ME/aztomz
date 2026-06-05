# 로그인 / 회원가입

## 목적
사용자 계정 생성·인증. 저장·후기 기능 잠금해제.

## 진입·화면

### 회원가입 (signup.html)
- **헤드:** "한끗 시작하기" + 설명
- **폼:** 이름·이메일·비밀번호 입력 (L19~24)
- **버튼:** "가입하고 시작하기" (accent 강조색)
- **대체 링크:** "이미 계정이 있으세요? 로그인" (L27)
- **리다이렉트:** ?next= 파라미터로 지정된 페이지로 이동 (또는 index.html)

### 로그인 (login.html)
- **헤드:** "다시 오셨네요"
- **폼:** 이메일·비밀번호 입력 (L19~22)
- **버튼:** "로그인" (primary)
- **대체 링크:** "처음이세요? 회원가입" (L25)
- **리다이렉트:** ?next= 리다이렉트

## 표시 데이터
- **입력값:** name / email / password
- **검증:**
  - 이름: 1자 이상 필수
  - 이메일: 유효한 이메일 형식 필수 (regex `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`)
  - 비밀번호: 6자 이상 필수
  - 회원가입: 중복 이메일 차단
  - 로그인: 이메일·비밀번호 매칭 확인
- **저장처:** localStorage 'hangeut.users' (목 인증, 프로토타입 전용)

## 현재 상태
구현됨. 회원가입 → 중복 차단 → 저장 → 로그인 → 세션 유지 → 마이페이지 접근 → 로그아웃 전체 흐름 동작 확인 (2026-06-05).

## 관련 코드
- `signup.html` : 회원가입 폼 (L1~46)
- `login.html` : 로그인 폼 (L1~46)
- `assets/app.js` :
  - `H.signup({name, email, password})` (L50~61)
  - `H.login({email, password})` (L62~69)
  - `H.logout()` (L70)
  - `H.user()` (L49, 현재 세션 조회)
- 저장소:
  - 'hangeut.users' (사용자 목록 JSON)
  - 'hangeut.session' (현재 로그인 상태 JSON)

## 비고
- **목 인증 (프로토타입):** localStorage 기반, 단순 해시(L19 hash 함수) — 실보안 아님. 데모 전용
- **리다이렉트 가드:**
  - signup.html / login.html 진입 시 이미 로그인 상태면 ?next= 페이지로 즉시 이동 (L33~35, login.html)
  - me.html 진입 시 미로그인 상태면 login.html?next=me.html 으로 리다이렉트 (me.html L40~41)
- **오류 처리:** 폼 제출 시 res.ok=false면 `#formErr` 엘리먼트에 오류 메시지 표시 (signup.html L38~42)
- **실서비스 전환:** H.signup/login/logout 내부 구현을 Supabase Auth로 교체 (docs/architecture.md 참고)
  - 비밀번호 OR 카카오 OAuth 선택 가능
  - RLS(행 보안) 정책으로 본인 데이터만 접근
