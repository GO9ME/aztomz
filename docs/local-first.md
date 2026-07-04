# 한끗 로컬 퍼스트 운영 전략

## 방향
한끗은 당분간 **정적 멀티페이지 + 정적 데이터 갱신 + localStorage 기반 로컬 보관함**으로 운영한다. 서버 계정, 실시간 DB, 백엔드 API 없이 `frontend/`만 배포한다.

## 배포와 데이터
- Vercel 배포 대상은 `frontend/`뿐이다.
- canonical 트렌드 원본은 `backend/data/trends.json`이다.
- 브라우저가 읽는 `frontend/data/trends.js`는 `backend/scripts/refresh.mjs`가 생성한다.
- `frontend/data/trends.js`는 직접 편집하지 않는다.
- 데이터 수정 후 배포에 반영하려면 검증 후 `node backend/scripts/refresh.mjs`로 생성물을 갱신한다.

## 개인화
저장/후기/펄스 아이디어는 서버 기능이 아니라 로컬 개인화다. 로그인과 회원가입은 일반 플로우에서 제거했다.
`frontend/me.html`은 계정 페이지가 아니라 이 브라우저의 내 보관함이며, `frontend/login.html`과 `frontend/signup.html`은 직접 접근용 noindex 안내 페이지로만 유지한다.

| 기능 | 저장 위치 | 동기화 |
|---|---|---|
| 저장한 트렌드 | `localStorage` | 없음 |
| 방문자 후기 | `localStorage` | 없음 |
| 펄스 아이디어 | `localStorage` | 없음 |

따라서 같은 사용자가 다른 브라우저나 다른 기기에서 접속하면 기록이 보이지 않는다. 브라우저 데이터를 지우면 기록도 사라진다.

## H.* 계약
페이지는 직접 localStorage를 만지지 않고 `frontend/assets/app.js`의 `H.*`만 사용한다. 현재는 로컬 스토어 구현이지만, 향후 백엔드가 필요해지면 UI를 크게 바꾸기보다 `H.*` 내부 구현을 우선 교체한다.
`H.signup/login/logout/user`는 오래된 링크나 스크립트가 깨지지 않게 남긴 호환 API이며 실제 서버 계정을 만들지 않는다.

## 신선도
- `analyzedAt`은 실제 재분석한 항목만 바꾼다.
- `generatedAt`은 정적 데이터 파일을 생성한 날짜다.
- 오래된 분석은 "갱신 필요"로 보여준다.
- 날짜만 오늘로 바꿔 최신처럼 보이게 하지 않는다.

## 현재 보류한 것
Supabase 같은 외부 백엔드 전환은 확정 계획에서 제외한다. 서버 저장, 기기 동기화, 공개 후기, 소셜 로그인, RLS 같은 요구가 다시 중요해지면 별도 기획으로 검토한다.
