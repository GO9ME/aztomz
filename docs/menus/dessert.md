# 요즘 디저트
- 목적: 바이럴 디저트와 디저트샵 정보를 트렌드 맥락, 광고 의심도, 후기 신뢰도와 함께 보여준다.
- 진입/화면: `frontend/list.html?type=trend&cat=디저트`, 홈의 요즘 트렌드 섹션, `frontend/trend.html?id=<디저트id>` 상세.
- 표시 데이터: 정규 카테고리 `cat === '디저트'`. 현재 데이터 기준(2026-07-04) 9건(신뢰분석 2건, 트렌드 7건). 목록은 `title`, `stage`, `label`, `images`, `analyzedAt`, `H.summary()`를 쓰고, 상세는 항목 유형에 따라 `ad`, `trust`, `sat`, `verdict`, `recs`, `shops`, `src`를 표시한다.
- 현재 상태: 구현됨. 전체 트렌드 목록에서 디저트 카테고리 필터와 페이지네이션이 동작하고 상세의 점수/출처/가게 섹션도 렌더링된다.
- 관련 코드: `frontend/list.html`의 트렌드 목록 분기, `frontend/assets/app.js`의 `H.trendCardHTML()`/`H.summary()`, `frontend/trend.html`의 `scoresBlock()`, `articleBlock()`, `shopsBlock()`, `backend/data/trends.json`.
- 비고: 디저트·음료 같은 세분 카테고리를 새로 만들지 않는다. 음료/지역/재료 정보는 `title`, `tags`, `shops.area`, 본문에 둔다.
