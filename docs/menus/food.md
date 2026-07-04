# 요즘 음식
- 목적: 요즘 음식·맛집 트렌드를 광고 분석 또는 트렌드 카드로 보여주고 상세 판단으로 연결한다.
- 진입/화면: `frontend/list.html?type=trend&cat=맛집` 또는 별칭 `frontend/list.html?type=trend&cat=음식`, 홈의 요즘 트렌드 섹션, `frontend/trend.html?id=<id>` 상세.
- 표시 데이터: 정규 카테고리 `cat === '맛집'`. 현재 데이터 기준(2026-07-04) 7건(신뢰분석 5건, 트렌드 2건). 목록 카드는 `title`, `cat`, `stage`, `label`, `images`, `analyzedAt`, `H.summary()`를 쓰고, 신뢰분석 상세는 `ad`, `trust`, `sat`, `recs`, `shops`, `src`를 함께 표시한다.
- 현재 상태: 구현됨. `list.html`에서 `cat=음식`을 `맛집`으로 정규화하고, 카드/랭킹에는 짧은 설명이 표시된다.
- 관련 코드: `frontend/list.html`의 `CAT_ALIAS`/`normalizeCat()`/`filtered()`, `frontend/assets/app.js`의 `H.trendCardHTML()`/`H.adRowHTML()`/`H.summary()`, `frontend/trend.html`의 `shopsBlock()`, `backend/data/trends.json`.
- 비고: 새 데이터의 `cat`은 `맛집`으로 넣는다. `음식`은 URL 호환용 별칭일 뿐 canonical 카테고리가 아니다.
