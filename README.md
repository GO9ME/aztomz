# 한끗 — 트렌드 번역소

> **AZ와 MZ는 한 끗 차이** | 요즘 유행(밈·신조어·음식·디저트·핫플)을 1분에 번역하고, SNS 맛집이 광고인지 실후기인지 분석해주는 모바일 웹.

## 구조 한눈에

| 파일·경로 | 역할 |
|---|---|
| `frontend/` | ★ 배포 대상(Vercel `outputDirectory`). 브라우저가 받는 정적 파일 전부 |
| `frontend/index.html` | 홈 — 오늘의 한끗·광고일까 진짜일까 랭킹·요즘 트렌드 스트립 |
| `frontend/trend.html?id=` | 상세 — 점수(광고의심도/신뢰도)·만족도·판단·추천·출처·후기 |
| `frontend/{login,signup,me,pulse}.html` | 인증·마이페이지·트렌드 펄스 |
| `frontend/assets/styles.css`·`app.js`·`pulse.js` | 디자인 시스템 / 모의 스토어(H.*) / 펄스 |
| `frontend/data/trends.js`·`pulse.js` | 브라우저가 로드하는 **생성물** — **직접 편집 금지** |
| `backend/` | 비공개(배포 안 됨) — 데이터 원본 + 빌드 스크립트 |
| `backend/data/trends.json`·`pulse.json` | ★ **canonical 데이터 원본** (사람·스크립트가 수정) |
| `backend/scripts/refresh.mjs` 등 | 일일 갱신·출처검증·이미지 스크립트 |
| `docs/` | 기획·아키텍처·메뉴별 문서 |

---

## 로컬 실행

### 정적 서버 띄우기
의존성 0, 빌드 0. 사이트 루트는 `frontend/`:
```bash
# 방법 1: 동봉 미니 서버 — 레포 루트에서 실행 → frontend/를 서빙 (포트 8123)
node .claude/static-server.cjs
# 방법 2: Python — frontend/ 안에서 실행
cd frontend && python -m http.server 8000
```

### 데이터 갱신 (선택사항)
```bash
node backend/scripts/refresh.mjs   # backend/data/trends.json → frontend/data/trends.js 재생성 (레포 루트에서)
```

> trends.json을 직접 편집한 후, 이 스크립트를 실행하면 trends.js가 자동 생성됩니다.  
> **trends.js는 직접 편집하지 마세요** — refresh.mjs의 생성물입니다.

---

## 데이터 흐름

```
backend/data/trends.json (원본, 사람/스크립트가 수정)
    ↓
backend/scripts/refresh.mjs (validation + 생성)
    ↓
frontend/data/trends.js (브라우저가 로드 → H.TRENDS)
    ↓
사이트 frontend/*.html (마스트헤드·피처·리스트 렌더링)
```

**핵심:** trends.json만 수정. trends.js는 건드리지 말 것.

---

## 배포

GitHub `GO9ME/aztomz`(public) → Vercel 정적 배포. `vercel.json`의 `outputDirectory: "frontend"`로 **frontend/만 서빙**(backend/ 비공개).  
**자동:** 각 push마다 Vercel이 재배포 (약 1~2분).

```bash
git add backend/data/trends.json frontend/data/trends.js
git commit -m "..."
git push origin main              # → Vercel 자동 재배포
```

---

## 문서 인덱스

- **[docs/prd.md](docs/prd.md)** — 프로젝트 기획·비전
- **[docs/architecture.md](docs/architecture.md)** — 시스템 구조·백엔드 전환 계획
- **[docs/menus/](docs/menus/)** — 메뉴별 상세 문서
  - [홈](docs/menus/home.md) / [사전](docs/menus/dictionary.md) / [음식](docs/menus/food.md) / [디저트](docs/menus/dessert.md) / [핫플](docs/menus/hotplace.md)
  - [광고분석](docs/menus/ad-or-real.md) / [검색](docs/menus/search.md) / [공유](docs/menus/share.md)
  - [마이페이지](docs/menus/mypage.md) / [인증](docs/menus/auth.md)
- **[learnings.md](learnings.md)** — 고구미봇이 쌓는 분석 교훈
- **[CLAUDE.md](CLAUDE.md)** — 개발 철칙·메모

---

## 철칙 (신뢰가 제품의 본질)

| 항목 | 규칙 |
|---|---|
| **신선도** | `analyzedAt`은 **실제로 재분석한 항목만** 오늘 날짜로 갱신. 안 한 항목은 그대로 둠 → "갱신 필요" 노출 |
| **출처** | 검색 결과에 **실제로 나온 URL만** 사용. 추측·단축·조립 금지. `node backend/scripts/check-links.mjs`로 검증 |
| **점수** | 모든 점수는 **추정치**이며 확정 판정이 아님. 단정 표현 금지 |
| **신뢰도 ≠ 만족도** | 신뢰도(믿을 만한가) ≠ 만족도(좋은가) — 별개 축으로 표기. 신뢰도 높아도 내용이 '별로'면 neg |
| **신조어** | 출처에 "2024 신조어" 류 표시면 2026.6 기준으로 한물 의심. 재검증 필수 |

---

## 데이터 스키마

각 trend 항목:
- `id` (string) — 고유 키
- `type` (string) — "신뢰분석" | "트렌드"
- `cat` (string) — 카테고리 (디저트·성수 카페·AI 프롬프트 등)
- `title` (string) — 트렌드명
- `analyzedAt` (YYYY-MM-DD) — 분석 날짜
- `ad` (0~100) — 광고 의심도
- `trust` (0~100) — 실제 후기 신뢰도
- `sat` (pos|neg|mix) — 만족도 (긍정·부정·혼재)
- `label` (string) — 한끗 판정 (예: "SNS 기대치 조절 필요")
- `verdict` (string) — 장문 분석
- `src` (array) — 출처 [제목, URL] 쌍
- `recs` (array) — 추천 목록 [항목, 평가, 점수]
- **선택:** `pureKorean` (신조어만) / `prompt` (AI만) / `stage` (트렌드만)

---

## 개발 환경

- **OS:** Windows 11 / **셸:** PowerShell (Bash 도구도 사용 가능)
- **배포:** GitHub `GO9ME/aztomz` → Vercel 정적 배포, push 자동 재배포
- **Hermes(고구미봇):** 별도 레포 `E:\workspace\side_project\hermes`, cron 2개 (07:00 갱신·07:30 리서치 초안)
