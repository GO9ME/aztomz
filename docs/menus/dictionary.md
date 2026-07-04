# MZ 사전
- 목적: 신조어·밈을 뜻, 예문, 예쁜 우리말, 출처와 함께 빠르게 찾게 한다.
- 진입/화면: `frontend/dictionary.html` 사전 홈과 `frontend/trend.html?id=<신조어id>` 상세. 화면은 검색창, 최신 신조어 섹션, 지난 유행어 섹션으로 나뉜다.
- 표시 데이터: `H.TRENDS.filter(t => t.coverCat === 'cat-slang' || t.cat === '신조어')`. 카드에는 `title`, `def`, `example`, `pureKorean`, `tags`, `analyzedAt`, `src`를 사용하고, 최신/지난 분리는 `H.isFreshSlang()`의 `fresh`, `stage`, `analyzedAt/collectedAt` 기준을 따른다.
- 현재 상태: 구현됨. 현재 데이터 기준(2026-07-04) 신조어 카테고리는 26개이며 화면 로직상 최신 1개, 지난 유행어 25개로 분리된다.
- 관련 코드: `frontend/dictionary.html`의 `SLANG` 필터와 `render(q)`, `frontend/assets/app.js`의 `H.isFreshSlang()`, `H.freshChip()`, `frontend/trend.html`의 신조어 상세 렌더링, `backend/data/trends.json`.
- 비고: 최신/지난 수량은 오늘 날짜와 `analyzedAt`에 따라 바뀐다. `fresh:false` 또는 `stage`에 끝물/한물/지남 계열 표현이 있으면 최신에서 제외된다.
