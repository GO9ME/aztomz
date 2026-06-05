#!/usr/bin/env node
/* ============================================================
   한끗 · 트렌드 펄스 — 일일 '오늘의 트렌드' 갱신
   data/pulse.json(원본)을 읽어 ① (hermes 플러그) AI로 '오늘의 트렌드' 수집
   ② 정규화·중복제거·롤링윈도우(최근 N일) ③ generatedAt=오늘 스탬프
   ④ 브라우저용 data/pulse.js(window.PULSE_DATA) 생성.

   ▶ 빌트인 110개(trends)는 read-only — 절대 덮어쓰지 않는다(소유권 분리).
     이 스크립트는 daily[]만 소유·변경한다.
   ▶ 키가 없으면 daily 생성을 '스킵'하고 빌드를 깨지 않는다(generatedAt만 갱신).
     refresh.mjs 철학과 동일: 거짓 신선도 금지 + 빌드 안전.
   ▶ cron: 로컬 hermes(고구미봇)에서 실행. 키는 로컬 env에만(HERMES_ANTHROPIC_KEY).

   실행: node scripts/pulse-refresh.mjs
   ============================================================ */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = join(root, 'data', 'pulse.json');
const jsPath = join(root, 'data', 'pulse.js');

const MODEL = 'claude-sonnet-4-20250514'; // jsx와 동일. 필요시 한 곳만 교체.
const CATS = ['테크', 'K뷰티', '헬스', '푸드', '금융', '교육', '패션', '엔터', '라이프', '등산', '관광'];
const PLATFORMS = ['Google', 'YouTube', 'Instagram', 'TikTok', 'X'];
const WINDOW_DAYS = 7; // daily 롤링 윈도우
const DAILY_TARGET = 5; // 하루 목표 개수

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const normKw = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '');

/* ───────── AI 호출 (서버사이드 전용, 키는 env에서만) ─────────
   키 부재 → { skipped:true } 반환 → 호출부에서 daily 미변경.
   refresh.mjs가 키 없이도 안전히 도는 것과 동일한 안전 분기. */
async function callAI(prompt) {
  const key = process.env.HERMES_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, skipped: true, error: 'NO_KEY' };
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) return { ok: false, error: 'API ' + r.status };
    const d = await r.json();
    if (d.error) return { ok: false, error: d.error.message || '오류' };
    const txt = (d.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    return txt.trim() ? { ok: true, text: txt } : { ok: false, error: '빈 응답' };
  } catch (e) {
    return { ok: false, error: '네트워크 오류: ' + (e && e.message) };
  }
}

function buildPrompt(excludeKws, today) {
  const ex = excludeKws.slice(0, 60).join(', ');
  return (
    `오늘 ${today} 기준, 한국에서 지금 가장 뜨거운 '최신' 트렌드 ${DAILY_TARGET}개를 발굴해주세요.\n\n` +
    `아래 기존 키워드와는 절대 중복되면 안 됩니다(완전히 새로운 것):\n${ex}\n\n` +
    `반드시 아래 JSON 배열 '하나만' 출력하세요. 코드펜스/설명/머리말/꼬리말 금지.\n` +
    `[\n` +
    `  { "kw": "트렌드명", "cat": "${CATS.join('|')} 중 1개",\n` +
    `    "pl": ["${PLATFORMS.join('|')} 중 2~3개"],\n` +
    `    "gr": 150~450 사이 정수, "why": "왜 뜨는지 1문장", "angle": "사업 방향 1문장" }\n` +
    `]\n` +
    `정확히 ${DAILY_TARGET}개. 한국어. 실제로 화제가 되는 현실적인 트렌드만.`
  );
}

/* ───────── 파싱: 엄격 JSON 우선 + 마크다운 ### 폴백 ───────── */
function parseStrictJSON(text) {
  if (!text) return null;
  let t = String(text).replace(/```(?:json)?/gi, '').trim();
  const a = t.indexOf('[');
  const b = t.lastIndexOf(']');
  if (a >= 0 && b > a) {
    try {
      const arr = JSON.parse(t.slice(a, b + 1));
      if (Array.isArray(arr) && arr.length) return arr;
    } catch { /* fall through */ }
  }
  // 폴백: 마크다운 ### 블록(jsx 로직 이식)
  const blocks = t.split(/###\s+/).filter((x) => x.trim().length > 10);
  const out = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim());
    const kw = lines[0] ? lines[0].replace(/[[\]#*]/g, '').trim() : '';
    if (!kw) continue;
    const field = (label) => {
      const m = block.match(new RegExp(label + '[:\\s]*([^\\n]+)'));
      return m ? m[1].trim() : '';
    };
    const catM = block.match(/카테고리[:\s]*([^\n,]+)/);
    const grM = block.match(/성장률[:\s]*\+?(\d+)/);
    out.push({
      kw,
      cat: catM ? catM[1].trim() : '테크',
      pl: PLATFORMS.filter((p) => new RegExp(p, 'i').test(block)).slice(0, 3),
      gr: grM ? parseInt(grM[1], 10) : 0,
      why: field('왜 뜨') || field('왜'),
      angle: field('사업 방향') || field('방향'),
    });
  }
  return out.length ? out : null;
}

/* ───────── 정규화/검증: 모델 출력 → 안전한 트렌드 객체 ───────── */
function normalize(raw, i, today) {
  const kw = String(raw && raw.kw || '').trim();
  if (!kw) return null;
  const cat = CATS.includes(raw.cat) ? raw.cat : '테크';
  let pl = Array.isArray(raw.pl) ? PLATFORMS.filter((p) => raw.pl.includes(p)).slice(0, 3) : [];
  if (!pl.length) pl = ['Google', 'YouTube'];
  let gr = parseInt(raw.gr, 10);
  if (!Number.isFinite(gr)) gr = 150 + i * 30;
  gr = clamp(gr, 100, 500);
  const dur = clamp(Math.floor(gr / 35), 4, 10);
  const vol = 200 + Math.floor(gr * 1.2);
  const sp = [];
  for (let j = 0; j < dur; j++) sp.push(Math.round(20 + (80 * j) / dur + (i * 5) % 8));
  return {
    id: `d-${today}-${i + 1}`, // 결정적 id → 멱등(Date.now 금지)
    kw,
    cat,
    pl,
    gr,
    vol,
    dur,
    sc: { g: 2, m: 2, c: 2, f: 2 },
    why: (raw.why && String(raw.why).trim()) || `${kw} 관련 급상승`,
    angle: (raw.angle && String(raw.angle).trim()) || `${kw} 기반 서비스`,
    sp,
    total: 8,
    isDaily: true,
    date: today,
  };
}

/* ───────── hermes 플러그포인트: 오늘의 트렌드 수집 ───────── */
async function collectDailyTrends(excludeKws, today) {
  const r = await callAI(buildPrompt(excludeKws, today));
  if (r.skipped) { console.log('⚠ ANTHROPIC 키 없음 — daily 생성 스킵(빌드 정상 종료)'); return null; }
  if (!r.ok) { console.log('⚠ AI 실패: ' + r.error + ' — 기존 daily 유지'); return null; }
  const parsed = parseStrictJSON(r.text);
  if (!parsed) { console.log('⚠ 파싱 실패 — 기존 daily 유지'); return null; }
  return parsed;
}

/* ───────── main ───────── */
let data;
try {
  data = JSON.parse(await readFile(jsonPath, 'utf8'));
} catch (e) {
  console.error('✗ data/pulse.json 을 읽을 수 없습니다(빌트인 trends 선행 필요). 종료.');
  process.exit(0); // 빌드 안전: 데이터 없으면 조용히 종료
}
const builtin = Array.isArray(data.trends) ? data.trends : [];
const prevDaily = Array.isArray(data.daily) ? data.daily : [];
const today = todayISO();

// 최근 N일 윈도우 경계
const cutoff = new Date(today + 'T00:00:00');
cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
const recentDaily = prevDaily.filter((d) => d && d.date && new Date(d.date + 'T00:00:00') >= cutoff);

// dedup 기준: 빌트인 kw ∪ 최근 daily kw
const excludeSet = new Set([...builtin, ...recentDaily].map((t) => normKw(t.kw)));
const excludeKws = [...builtin, ...recentDaily].map((t) => t.kw);

// AI 수집(키 없으면 null)
const collected = await collectDailyTrends(excludeKws, today);

let todaysDaily;
if (collected) {
  const seen = new Set();
  todaysDaily = collected
    .map((raw, i) => normalize(raw, i, today))
    .filter(Boolean)
    .filter((t) => {
      const k = normKw(t.kw);
      if (excludeSet.has(k) || seen.has(k)) return false; // 빌트인/최근/배치내 중복 제거
      seen.add(k);
      return true;
    });
} else {
  // 생성 스킵/실패 → 오늘분은 기존 것을 유지(있으면)
  todaysDaily = recentDaily.filter((d) => d.date === today);
}

// 롤링 윈도우: 오늘분 교체(누적 방지) + 최근 N일(오늘 제외) 유지
const olderDaily = recentDaily.filter((d) => d.date !== today);
data.daily = [...todaysDaily, ...olderDaily];
data.generatedAt = today; // 신선도는 클라이언트가 date 대비 '오늘'로 라이브 계산

await writeFile(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

const banner = '/* AUTO-GENERATED by scripts/pulse-refresh.mjs — 편집 금지. 원본: data/pulse.json */\n';
await writeFile(jsPath, banner + 'window.PULSE_DATA = ' + JSON.stringify(data, null, 2) + ';\n', 'utf8');

console.log(
  `✓ pulse refreshed: generatedAt=${data.generatedAt}, ` +
  `built-in=${builtin.length}, daily=${data.daily.length}` +
  (collected ? ` (오늘 ${todaysDaily.length}개 신규)` : ' (오늘 신규 없음)')
);
