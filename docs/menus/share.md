# 공유

## 목적
개별 트렌드 분석을 SNS·메시지로 공유. 추천 링크 생성·OG 메타데이터 활용.

## 진입·화면
- **파일:** trend.html (상세 페이지)
- **UI:** "↗ 공유" 버튼 (trend.html L80, shareBtn 엘리먼트)
- **동작:** 버튼 클릭 시 Web Share API 호출 (또는 대체 모달)

## 표시 데이터
- `t.id` (트렌드 ID)
- `t.title` (공유 제목)
- `t.excerpt` (공유 본문 요약)
- `t.label` (한끗 판정)
- 현재 페이지 URL: `trend.html?id=<id>`

## 현재 상태
구현됨 / 부분. trend.html L80에 shareBtn 엘리먼트 존재하나, 클릭 핸들러 미구현 (js 없음). Web Share API 또는 링크 복사 기능 추가 필요.

## 관련 코드
- `trend.html` : "↗ 공유" 버튼 (L80, id=shareBtn)
- `assets/app.js` : 공유 핸들러 없음 (TODO)

## 비고
- **Web Share API:** 모바일 브라우저에서 네이티브 공유창 표시 (iOS Safari, Chrome for Android 지원)
- **대체 전략:** PC 환경 / 미지원 브라우저 → URL 복사 또는 모달 SNS 링크 제공
- **OG 메타데이터:** trend.html `<meta property="og:*">` 추가 시 카카오톡·페이스북 링크 프리뷰 개선
- **2차 구현 후보:**
  - "이 분석을 카카오톡으로 보내기"
  - "URL 복사하기"
  - "트위터 공유" 링크
