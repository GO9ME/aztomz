# 내 보관함
- 목적: 이 브라우저에 저장한 트렌드, 내가 쓴 후기, 저장한 펄스 아이디어를 모아 보게 한다.
- 진입/화면: `frontend/me.html`. 마스트헤드의 "내 보관함" 링크로 진입하며 로그인 가드는 없다.
- 표시 데이터: `H.saves()`의 저장 ID 목록, `H.myReviews()`의 후기 목록, `H.pulseIdeas.list()`의 저장 아이디어 목록. 저장 목록은 `H.TRENDS`에서 `title`, `label`, `coverHTML()` 데이터를 찾아 표시하고 저장 해제를 제공한다.
- 현재 상태: 구현됨. localStorage 기반 단일 로컬 보관함으로 저장한 트렌드, 내가 쓴 후기, 펄스 아이디어가 동작한다.
- 관련 코드: `frontend/me.html`의 `renderSaved()`/`renderMyReviews()`/`renderPulseIdeas()`, `frontend/assets/app.js`의 `H.saves()`, `H.toggleSave()`, `H.myReviews()`, `H.pulseIdeas`.
- 비고: 내 보관함 데이터는 공개 서버에 저장되지 않고 다른 기기와 동기화되지 않는다. `H.*`는 로컬 스토어 추상화 계층으로 유지한다.
