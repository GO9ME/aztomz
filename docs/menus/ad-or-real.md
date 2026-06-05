# 광고일까 진짜일까

## 목적
SNS 맛집·제품의 광고의심도·신뢰도·만족도를 3개 축으로 분석. 광고 가능성 vs 실후기 신뢰성 분리 노출.

## 진입·화면
- **파일:** frontend/index.html#ad (홈 섹션) + frontend/trend.html?id=<신뢰분석id>
- **홈 섹션:** "광고일까 진짜일까" 랭킹 인덱스 (신뢰분석 순서대로 리스트)
- **상세 페이지:** frontend/trend.html — 점수·만족도·분석·출처·추천·후기

## 표시 데이터

### 홈 인덱스 (frontend/index.html L90~104)
- `t.type` = "신뢰분석"만 필터
- `t.id` / `t.title` / `t.cat` / `t.buzz` / `t.label`
- `t.analyzedAt` (신선도 칩)
- `t.ad` / `t.trust` (바차트)

### 상세 페이지 (frontend/trend.html)
- **점수 블록:** `t.ad` (광고 의심도 0~100 + 설명) + `t.trust` (신뢰도 0~100 + 설명)
- **만족도:** `t.sat` (pos|neg|mix) + `t.satTxt` (상세, 예: "후기는 풍부·신뢰도 높은데 내용은 부정적")
- **판정:** `t.label` (한 줄 요약) + `t.labelCls` (스타일: good|mid|warn)
- **분석:** `t.pull` (한 줄 핵심) + `t.verdict` (장문)
- **추천:** `t.recs` (항목별 평가: ◎/△/✕)
- **출처:** `t.src` (제목, URL)
- **후기:** 방문자 리뷰 (별점·텍스트, localStorage 저장)

## 현재 상태
구현됨. 두바이 초콜릿·누데이크·멜로워 등 신뢰분석 3건 이상 존재. 점수 이원화(광고도 vs 신뢰도)·만족도 축 분리 렌더링 동작 확인.

## 관련 코드
- `frontend/index.html` : 광고 인덱스 (L36~104, analyses 필터 + 리스트 렌더링)
- `frontend/trend.html` : 상세 (L49~64, scoresBlock() 함수에서 광고도/신뢰도 바 표시)
- `frontend/assets/app.js` : H.bandTxt() (점수→설명, L29), H.freshness()/H.freshChip() (신선도, L37~44)
- `backend/data/trends.json` : type=='신뢰분석' 항목들

## 비고
- **3축 분리 (PRD §9.7 개선):** 
  - 광고의심도(ad) = 바이럴·협찬 강도
  - 신뢰도(trust) = 후기 신뢰성
  - 만족도(sat) = 후기 내용 긍부정
  - 이전: 후기 신뢰도를 만족도로 혼동 → 이제 별개 축
  
- **점수 설명:** L58~61 bandTxt() 로직
  - 0~20: 낮음 / 21~40: 약간 / 41~60: 보통 / 61~80: 높음 / 81~100: 매우 높음
  
- **만족도 레이블:** `sat-${sat}` (css class) → pos=긍정(초록), neg=부정(빨강), mix=혼재(노랑)
  
- **출처 신뢰도:** 본문이 실제로 읽히는 링크만 사용. 다이닝코드·인스타는 JS앱이라 본문 못 읽음 → tistory·기사로 교체 (learnings.md)

- **신선도:** 14일 이상 경과 시 "갱신 필요" 빨강 + 경고 배너 (frontend/trend.html L77)
