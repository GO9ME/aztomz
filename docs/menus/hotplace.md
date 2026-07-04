# 요즘 핫플
- 목적: 카페·핫플 계열 트렌드와 장소성 있는 항목을 광고 의심도, 후기 신뢰도, 경험 가치와 함께 보여준다.
- 진입/화면: `frontend/list.html?type=trend&cat=카페·핫플` 또는 별칭 `frontend/list.html?type=trend&cat=핫플`, 홈의 요즘 트렌드 섹션, `frontend/trend.html?id=<id>` 상세.
- 표시 데이터: 정규 카테고리 `cat === '카페·핫플'`. 현재 데이터 기준(2026-07-04) 6건(신뢰분석 5건, 트렌드 1건). 목록은 `title`, `cat`, `label`, `stage`, `images`, `analyzedAt`, `H.summary()`를 쓰고, 상세는 `ad`, `trust`, `sat`, `satTxt`, `verdict`, `recs`, `shops`, `src`를 표시한다.
- 현재 상태: 구현됨. `list.html`에서 `cat=핫플`을 `카페·핫플`로 정규화하고, 같은 카테고리 관련 콘텐츠를 상세 하단에 우선 표시한다.
- 관련 코드: `frontend/list.html`의 `CAT_ALIAS`, `frontend/assets/app.js`의 `H.trendCardHTML()`/`H.adRowHTML()`, `frontend/trend.html`의 `sameCat` 관련 콘텐츠 로직과 `shopsBlock()`, `backend/data/trends.json`.
- 비고: `성수 카페`, `강남 핫플` 같은 지역·세부명은 canonical 카테고리로 쓰지 않는다. 지역은 `title`, `tags`, `shops.area`에 둔다.
