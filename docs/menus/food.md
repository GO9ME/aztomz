# 요즘 음식 (음식점·카페)

## 목적
SNS에서 자주 보이는 음식점·카페를 광고 의심도·신뢰도로 분석. 가서 안 후회할지 판단 제공.

## 진입·화면
- **파일:** frontend/trend.html?id=<음식id>
- **타입:** type=='신뢰분석' 또는 type=='트렌드', cat==[음식 관련 카테고리]
- **표시:** 카버(카테고리별 컬러) + 제목·카테고리·화제성·점수(광고의심도/신뢰도)·만족도 뱃지

## 표시 데이터
**신뢰분석 (광고의심도·신뢰도 분석 있음):**
- `t.type` = "신뢰분석"
- `t.ad` (0~100, 광고 의심도)
- `t.trust` (0~100, 실제 후기 신뢰도)
- `t.sat` (pos|neg|mix, 만족도)
- `t.satTxt` (만족도 설명)
- `t.label` (판정, 예: "SNS 기대치 조절 필요")
- `t.verdict` (상세 분석)
- `t.recs` (추천 목록, 예: ["사진·힙스팟", "◎", 1])

**트렌드 (단순 소개):**
- `t.type` = "트렌드"
- `t.stage` (유행 단계)
- `t.label` / `t.verdict` (설명)

## 현재 상태
구현됨. 신뢰분석 3건(두바이 초콜릿·누데이크·멜로워) 이상 존재. 점수·만족도·추천 렌더링 동작 확인.

## 관련 코드
- `frontend/trend.html` : 상세 페이지 (L1~80+, scoresBlock() 함수로 신뢰분석/트렌드 분기)
- `frontend/assets/app.js` : H.bandTxt() (점수 설명 텍스트), H.coverHTML() (카버 렌더링) (L29, L102~109)
- `backend/data/trends.json` : type=='신뢰분석' || type=='트렌드' 중 cat 포함 음식점·카페 항목

## 비고
- **카테고리 예:** 디저트, 성수 카페, 베이커리 등 — coverCat으로 스타일링 (cat-dessert, cat-cafe, cat-bakery)
- 신뢰분석: 광고/신뢰도 점수 + 바차트 렌더링 (frontend/assets/app.js L56~62)
- 트렌드: 단계(stage) + 단계 설명(stageMsg) 표시
- 출처 검증 필수: `node backend/scripts/check-links.mjs` + `check-source.mjs` (learnings.md 참고)
