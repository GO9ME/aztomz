# 공유

## 목적
개별 트렌드 분석을 SNS·메시지로 공유. 네이티브 공유 시트 또는 링크 복사.

## 진입·화면
- **파일:** `frontend/trend.html` (상세 페이지 상단의 `↗ 공유` 버튼)
- **UI:** 공유 버튼 클릭 → 모바일 네이티브 공유 시트 (또는 링크 복사 폴백)

## 표시 데이터 (상세 페이지 공유)
- 제목: `한끗`
- 본문: 트렌드 제목 + 한 줄 요약(excerpt)
- URL: `trend.html?id=<id>`

## 현재 상태
구현됨. `trend.html`의 `#shareBtn` 핸들러가 `navigator.share()`(네이티브 공유 시트) → 실패 시 링크 복사로 동작.

## 관련 코드
- `frontend/trend.html` — `#shareBtn` onclick: `navigator.share({title:'한끗', text, url})`, 미지원 시 클립보드 복사.
- `frontend/assets/app.js` — `H.share()` 헬퍼(네이티브 공유→링크 복사 폴백)도 있음. 다른 페이지에서 재사용 가능(현재 직접 사용처는 trend.html 인라인 핸들러).

## 비고
- **네이티브 공유:** `navigator.share()` 지원 환경(iOS Safari 13+, Chrome for Android 61+)에서 OS 공유 시트 표시.
- **폴백:** 미지원 또는 사용자 취소(AbortError) → 링크 클립보드 복사 + 토스트.
- **OG 메타데이터:** `trend.html`의 `<meta property="og:*">`로 카카오톡·링크 프리뷰 개선 가능.
- **2차 구현 후보:** 카카오톡 공유 링크(카카오 API), 이미지 카드 공유.
