# 광고일까 진짜일까

## 목적
SNS 맛집·제품의 광고의심도·신뢰도·만족도를 3개 축으로 분석. 광고 가능성 vs 실후기 신뢰성 분리 노출.

## 진입·화면
- **파일:** 
  - `frontend/index.html#ad` (홈: 광고 미리보기, 최근 재확인순 상위 6개)
  - `frontend/list.html?type=ad` (전체 목록: 페이지당 10개 + 페이지네이션)
  - `frontend/trend.html?id=<신뢰분석id>` (상세 페이지)
- **홈 섹션:** 신뢰분석을 **최근 재확인순**(analyzedAt 내림차순)으로 정렬 후 상위 6개 랭킹 인덱스 표시 + "광고 분석 전체보기" 버튼
- **전체 목록 페이지:** list.html?type=ad — 랭킹 행 (순위·제목·카테고리·신선도·광고도·신뢰도 바차트), 페이지당 10개, 페이지네이션(1 … n … last)
- **상세 페이지:** frontend/trend.html — 점수·만족도·분석·출처·추천·후기

## 표시 데이터

### 홈 인덱스 (frontend/index.html L95~105)
- 신뢰분석(type=='신뢰분석') 상위 6개만 필터링
- 각 행: `t.id` / `t.title` / `t.cat` / `t.buzz` / `t.label`
- `t.analyzedAt` (신선도 칩), `t.ad` / `t.trust` (바차트)
- rank: 1~6 순번 (00~06 형식)

### 전체 목록 페이지 (frontend/list.html?type=ad)
- `H.adRowHTML(t, rank)` 헬퍼로 각 행 렌더링
- 페이지당 10개, 누적 순위 번호 (05, 06, 07, ... 15, 16, ...)
- URL 쿼리: ?type=ad&page=N (페이지네이션)
- 페이저: 이전/다음 + 번호 윈도우(1 … cur-1, cur, cur+1 … last)

### 상세 페이지 (frontend/trend.html)
- **점수 블록:** `t.ad` (광고 의심도 0~100 + 설명) + `t.trust` (신뢰도 0~100 + 설명)
- **만족도:** `t.sat` (pos|neg|mix) + `t.satTxt` (상세, 예: "후기는 풍부·신뢰도 높은데 내용은 부정적")
- **판정:** `t.label` (한 줄 요약) + `t.labelCls` (스타일: good|mid|warn)
- **분석:** `t.pull` (한 줄 핵심) + `t.verdict` (장문)
- **추천:** `t.recs` (항목별 평가: ◎/△/✕)
- **출처:** `t.src` (제목, URL)
- **후기:** 방문자 리뷰 (별점·텍스트, localStorage 저장)

## 현재 상태
구현됨. 
- 홈: 광고 미리보기(최근 재확인순 상위 6개) + 더보기 버튼 완성
- 전체 목록: list.html?type=ad (10/페이지, 페이지네이션 완성)
- 상세: 점수 이원화(광고도 vs 신뢰도)·만족도 축 분리 렌더링 완성
- **일일 재확인:** recheck-ad.mjs (매일 07:30, 가장 오래된 신뢰분석 1건의 출처 재검증 → 살아있으면 analyzedAt 갱신)
- 데이터: 신뢰분석 3건 이상 (2026-06-06 확인)

## 관련 코드
- `frontend/index.html` : 광고 미리보기 (L38~183)
  - L143~150: 최근 재확인순 정렬 (analyzedAt 내림차순), HOME_AD_MAX=6, analyses 필터 + H.adRowHTML() 렌더링 + adMore 버튼
- `frontend/list.html` : 전체 목록 + 페이지네이션 (L45~152)
  - L49: type='ad' 선택
  - L50: PAGE_SIZE = 10
  - L54~56: ALL = type=='신뢰분석' 필터
  - L100~102: H.adRowHTML(t, start + i + 1) — 누적 순위
  - L122~140: renderPager() — 윈도우식 페이지네이션
  - L141~147: syncURL() — URL 쿼리 동기화
- `frontend/assets/app.js` : H.adRowHTML(t, rank) (L124~136), H.detailHref() (L122), H.bandTxt() (L29)
- `frontend/trend.html` : 상세 (L49~64)
- `backend/data/trends.json` : type=='신뢰분석' 항목들
- `backend/scripts/recheck-ad.mjs` : 일일 재확인 (카테고리 무관 가장 오래된 항목 1건, 출처 재검증, 살아있으면 analyzedAt 갱신)

## 비고
- **매일 1건 일일 재확인 (신규):** 
  - 스크립트: `backend/scripts/recheck-ad.mjs` (LLM 없음, 결정적)
  - 대상: type=='신뢰분석' 중 analyzedAt이 **가장 오래된 1건**(라운드로빈 스케줄)
  - 동작: 그 항목의 출처를 재검증(ddgs fetch + 관련성) → 살아있는 출처 1개+ 있으면 `analyzedAt=오늘`로 갱신 (정직한 '실제 재확인일')
  - 결과: 갱신되면 홈 featured가 그 항목으로 회전 / 0개면 '사람 확인 필요'로 보고 (거짓 신선도 금지 준수)
  - 크론: 매일 07:30 `hermes`의 `recheck_ad.py`(no-agent)가 호출
  
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
