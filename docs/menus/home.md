# 홈 (오늘의 한끗)

## 목적
오늘 분석 된 트렌드를 1화면에 미리보기 형으로 제공. 광고·트렌드 전체 목록으로의 진입 버튼으로 유도.

## 진입·화면
- **파일:** `frontend/index.html`
- **섹션 1: Lead** — 서비스 소개 헤드라인 + 신선도 ("분석 N건 · 마지막 갱신 YYYY.MM.DD")
- **섹션 2: Featured** — **가장 최근 재확인된 신뢰분석** (매일 1건씩 재확인 → 그 항목이 회전) → 큰 카드 + 점수 배지. 같은 날짜가 여럿이면 날짜 기준 해시로 회전
- **섹션 3: "광고일까 진짜일까"** — 신뢰분석 **최근 재확인순** 상위 6개 랭킹 인덱스 + "광고 분석 전체보기 +N" 버튼 (→ `list.html?type=ad`)
- **섹션 4: "요즘 트렌드"** — 카테고리 필터 + 스트립 상위 8개만 표시 + "트렌드 전체보기 +N" 버튼 (→ `list.html?type=trend`)

## 표시 데이터
- `H.TRENDS` 전체 (trends.json에서 로드)
- 필드: id·title·cat·buzz·ad·trust·sat·label·analyzedAt·stage(트렌드만)·coverCat·**images**(썸네일)
- 썸네일 `images`: 자동 게시 항목은 auto-build.mjs가 출처의 og:image 자동 추출·주입. 빈 경우 프론트의 onerror가 색 커버로 폴백
- 신선도 칩: `H.freshness(analyzedAt)` (오늘/N일 전/갱신 필요)
- **상세 페이지(`trend.html?id=`):** 미리보기에서 카드 클릭 → 점수(광고의심도/신뢰도)·만족도·한끗 판정·추천·영상·이미지 갤러리·**"어디서 사 먹지?" 섹션(t.shops 있을 때만)**·후기·출처

## 현재 상태
구현됨. 마스트헤드 + 리드 + 피처드(회전형, 매일 재확인된 항목 표시) + 광고 미리보기(최근 재확인순 상위 6개) + 트렌드 미리보기(상위 8개) + 카테고리 필터 + 더보기 버튼 전부 동작 확인 (2026-06-06).

## 관련 코드
- `frontend/index.html` : 마크업 + 스타일 + 더보기 로직 (L1~183)
  - L116~122: 오늘의 한끗 회전 로직 (최근 재확인 항목 필터 → 같은 날짜 여럿이면 시간 해시로 일일 회전)
  - L143~150: 광고 미리보기 (최근 재확인순 정렬, HOME_AD_MAX=6, adMore 버튼 렌더링)
  - L153~182: 트렌드 미리보기 (HOME_TREND_MAX=8, stripMore 버튼 + 카테고리 필터)
- `frontend/index.html` : 홈 마크업 + 더보기 로직
- `frontend/trend.html` : 상세 페이지 마크업 + shopsBlock() 함수 (L167~179, shops 배열 렌더링 — "어디서 사 먹지?" 섹션)
- `frontend/assets/app.js` : H.TRENDS, H.detailHref(), H.adRowHTML(), H.trendCardHTML(), H.coverHTML(), H.freshChip(), H.feedFreshness()
- `backend/data/trends.json` : 데이터 원본
- `backend/scripts/recheck-ad.mjs` : 매일 1건 광고/진짜 재확인 (출처 검증 후 analyzedAt 갱신)
- `backend/scripts/auto-build.mjs` : 자동 게시 시 shops 배열의 각 url 생존성 검증 (L112~135)

## 비고
- **오늘의 한끗 회전:** `recheck-ad.mjs`가 매일 07:30 구동 → 가장 오래된 신뢰분석 1건의 출처를 재검증 → 살아있는 출처 1개+ 있으면 `analyzedAt=오늘`로 갱신(→ 홈 featured가 그 항목으로 회전). 같은 날짜가 여럿이면 시간 해시로 일일 매번 다른 항목 표시(고정 아님)
- 광고 미리보기: 신뢰분석을 **최근 재확인순**(analyzedAt 내림차순)으로 정렬 후 상위 6개 (전체는 list.html?type=ad로 이동)
- 트렌드 미리보기: 타입=='트렌드' 상위 8개만 표시, 활성 카테고리 기준 (전체는 list.html?type=trend로 이동)
- 카테고리 필터: "전체" + 고유 카테고리 동적 생성
- 요청 버튼('분석 요청하기'): 현재 # 링크, 추후 카카오 오픈채팅·구글폼으로 교체 필요 (미구현/2차)
