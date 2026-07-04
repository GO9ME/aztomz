# hermes-admin — 로컬 관리 콘솔

한끗(az2mz)의 일일 파이프라인을 돌리는 **로컬 hermes 에이전트**(`E:\workspace\side_project\hermes`)의
설정·크론·실행 이력을 **한 화면에서 보고 수정/추가/삭제**하는 의존성 0 로컬 웹앱.

> 이 도구는 **내 PC에서만** 도는 관리 콘솔이다. 로컬 파일·hermes CLI·비밀에 접근하므로
> **배포(Vercel)에는 절대 포함되지 않는다**(`tools/` 위치라 `frontend/` 출력 밖).

## 실행

```bat
tools\hermes-admin\start.bat
```

또는 직접:

```bash
node tools/hermes-admin/server.mjs
```

기동하면 콘솔에 인증 토큰이 박힌 링크가 출력된다. 그 링크(`http://127.0.0.1:7766/?t=…`)로 연다.
`start.bat`은 토큰을 만들어 브라우저를 자동으로 띄운다.

- 포트 변경: 환경변수 `HERMES_ADMIN_PORT`
- hermes 경로 변경: 환경변수 `HERMES_HOME` (기본 `E:\workspace\side_project\hermes`)
- 요구사항: Node 20+(권장 24, `node:sqlite` 내장 사용), hermes venv(`hermes-agent/venv/Scripts`)

## 화면

| 탭 | 내용 |
|---|---|
| 개요 | 게이트웨이 동작 여부·모델·활성/일시정지 수·다음 실행·오늘 실행 요약 |
| 크론 작업 | 9개 작업 보기 + 추가/수정/삭제/일시정지·재개/지금실행 + 작업별 실행 로그 |
| 설정 | model·provider·agent·approvals 보기/수정(주요 키만) + 전체 config 읽기전용 |
| 실행 기록 | state.db cron 세션의 토큰·예상비용·상태·소요시간 |
| 인증 | 자격증명 메타(키·토큰은 마스킹, 읽기전용) |

## 설계 원칙(안전)

- **수정은 전부 hermes CLI 경유.** 게이트웨이가 `cron/jobs.json`을 소유(매 tick 재기록)하므로
  `jobs.json`/`config.yaml`에 **직접 쓰지 않는다.** 표시는 파일/DB 직접 읽기만.
- `127.0.0.1` 전용 바인드 + 기동 토큰으로 모든 `/api/*` 보호(다른 로컬 앱·CSRF 차단).
- **비밀 무노출**: `auth.json`은 메타만, config의 시크릿 키는 가려짐, `.env`는 미표시.
- config 수정은 **화이트리스트 키만**(시크릿/`_API_KEY`/`_TOKEN` 차단).
- 삭제·지금실행은 확인 다이얼로그. `cron run`은 비동기 트리거(게이트웨이가 다음 tick에 실행).

## 구조

```
server.mjs        node:http 서버. UI 서빙 + JSON API. 토큰 게이트.
lib/hermes.mjs    hermes 탐지·CLI 실행·jobs/config/sessions/output/auth 읽기
lib/schedule.mjs  cron식→사람말, 상대시간
public/           index.html · app.js · admin.css (styles.css는 서버가 재사용 서빙)
```
