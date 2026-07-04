# 로그인 / 회원가입 안내
- 목적: 과거 정적 링크 안정성을 위해 `login.html`, `signup.html`을 유지하되, 현재 한끗은 로그인 없이 사용할 수 있음을 안내한다.
- 진입/화면: 일반 서비스 플로우에서는 노출하지 않는다. 사용자가 직접 `frontend/login.html` 또는 `frontend/signup.html`에 접근하면 noindex 안내 페이지와 "홈으로 이동", "내 보관함 보기" 버튼을 보여준다.
- 표시 데이터: 별도 입력 폼 없음. 저장과 후기가 이 브라우저에만 보관된다는 안내 문구를 표시한다.
- 현재 상태: 로그인/회원가입 UI 제거됨. 저장, 후기, 펄스 아이디어는 `H.*`를 통해 단일 localStorage 보관함으로 동작한다.
- 관련 코드: `frontend/login.html`, `frontend/signup.html`, `frontend/assets/app.js`의 deprecated `H.signup()`, `H.login()`, `H.logout()`, `H.user()`.
- 비고: `login.html`과 `signup.html`은 직접 접근 안정성용 파일이며 검색 노출을 막기 위해 `noindex,nofollow`를 둔다.
