#!/usr/bin/env node
/* ============================================================
   한끗 · 광고/진짜(신뢰분석) 일일 재확인 — 결정적(LLM 없음)

   "광고일까 진짜일까"를 카테고리와 무관하게 **매일 1건씩** 재확인한다.
   - 대상: type==="신뢰분석" 중 analyzedAt이 가장 오래된 1건(라운드로빈 — 재확인하면 오늘이 되어 맨 뒤로).
   - 하는 일: 그 항목의 출처를 재검증 → 죽음(404)·무관 출처 제거. 살아있는 출처가 1개+면
     **analyzedAt=오늘로 갱신**(정직한 '재확인일'). 0개면 갱신 안 하고 '사람 확인 필요'로 보고.
   - 이렇게 갱신되면 홈의 '오늘의 한끗'(가장 최근 분석)이 이 항목으로 회전한다.
   - 끝에 refresh + git pull/commit/push(Vercel 자동배포).

   ▶ 거짓 신선도 금지(철칙) 준수: 실제로 출처를 재확인(재fetch+관련성)했을 때만 analyzedAt 갱신.
   ▶ 이미 검증된 항목이므로 보수적: ddgs가 이번에 본문을 못 읽으면(차단) 그 출처는 '유지'(삭제 X).

   사용: node backend/scripts/recheck-ad.mjs [--id=dubai-choco] [--no-git] [--dry]
   env: DDGS_EXE — Actions에선 pip ddgs + DDGS_EXE=ddgs
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const trendsPath = join(repoRoot, 'backend', 'data', 'trends.json');
const refreshPath = join(repoRoot, 'backend', 'scripts', 'refresh.mjs');

const args = process.argv.slice(2);
const NO_GIT = args.includes('--no-git');
const DRY = args.includes('--dry');
const idArg = (args.find(a => a.startsWith('--id=')) || '').slice(5) || null;

const DDGS = process.env.DDGS_EXE ||
  'E:/workspace/side_project/hermes/hermes-agent/venv/Scripts/ddgs.exe';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' };

function kstISO() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const TODAY = kstISO();

const STOP = new Set(['그리고','하지만','이게','정도','진짜','현','보라','첫주',
  '국내','이번','요즘','지금','오늘','관련','대한','위한','있는','없는','테스트','출처']);
function titleKeywords(t) {
  return [...new Set((t.title || '').replace(/[()'’"]/g, ' ').replace(/[·,/]/g, ' ')
    .split(/\s+/).map(s => s.trim()).filter(s => s.length >= 2 && !STOP.has(s)))];
}
function extract(url) {
  try {
    return execFileSync(DDGS, ['extract', '-u', url, '-f', 'text'], {
      encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, timeout: 40000, windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    }) || '';
  } catch (e) { return (e.stdout && e.stdout.toString()) || ''; }
}
const hasKw = (body, k) => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(body);
async function httpStatus(url) {
  try {
    const c = new AbortController(); const tm = setTimeout(() => c.abort(), 12000);
    const r = await fetch(url, { method: 'GET', headers: UA, redirect: 'follow', signal: c.signal });
    clearTimeout(tm); return r.status;
  } catch { return 'ERR'; }
}
function sh(a) { return execFileSync('git', a, { cwd: repoRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }); }

// ── 대상 선정
const data = JSON.parse(readFileSync(trendsPath, 'utf-8'));
const trends = Array.isArray(data) ? data : (data.trends || []);
const ads = trends.filter(t => t.type === '신뢰분석');
if (!ads.length) { console.log('· 신뢰분석 항목 없음 — 종료.'); process.exit(0); }

let target;
if (idArg) target = ads.find(t => t.id === idArg);
else target = ads.slice().sort((a, b) => (a.analyzedAt || '').localeCompare(b.analyzedAt || ''))[0]; // 가장 오래된
if (!target) { console.log(`· 대상 못 찾음(${idArg || '오래된 항목'}) — 종료.`); process.exit(0); }

console.log(`🔁 광고/진짜 일일 재확인 — ${TODAY}`);
console.log(`   대상: [${target.id}] ${target.title} (기존 analyzedAt=${target.analyzedAt})\n`);

const kws = titleKeywords(target);
const kept = [], dropped = [];
for (const [name, url] of (target.src || [])) {
  const st = await httpStatus(url);
  if (st === 404 || st === 410) { dropped.push([name, `죽음(${st})`]); console.log(`   ❌ ${st} 죽음 → 제거  ${name}`); continue; }
  const body = extract(url);
  if (body.length >= 80) {
    const tHits = kws.filter(k => hasKw(body, k)).length;
    if (tHits === 0) { dropped.push([name, '무관']); console.log(`   ❌ 무관(제목어 없음) → 제거  ${name}`); continue; }
    console.log(`   ✅ 유효(제목어 ${tHits})  ${name}`);
  } else {
    console.log(`   ⏸ 이번엔 본문 못읽음(차단) → 유지(기존 검증분)  ${name}`);
  }
  kept.push([name, url]);
}

const ok = kept.length >= 1;
console.log('');
if (ok) {
  target.src = kept;
  const before = target.analyzedAt;
  target.analyzedAt = TODAY;
  console.log(`✅ 재확인 완료: 유효 출처 ${kept.length}개 · analyzedAt ${before} → ${TODAY} (오늘의 한끗으로 회전)`);
  if (dropped.length) console.log(`   (제거된 출처 ${dropped.length}: ${dropped.map(d => `${d[0]}/${d[1]}`).join(', ')})`);
} else {
  console.log(`⚠️ ${target.title}: 살아있는 출처 0개(전부 죽음/무관) — analyzedAt 갱신 안 함. 사람 확인 필요.`);
}

if (DRY) { console.log('\n[DRY] 파일·git 변경 없이 종료.'); process.exit(0); }
if (!ok) { console.log('\n· 갱신할 것 없음 — 종료.'); process.exit(0); }

// 저장 + refresh + git
writeFileSync(trendsPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
execFileSync('node', [refreshPath], { cwd: repoRoot, stdio: 'inherit' });
if (NO_GIT) { console.log('\n--no-git: 파일만 갱신.'); process.exit(0); }
try {
  sh(['add', 'backend/data/trends.json', 'frontend/data/trends.js']);
  sh(['commit', '-m', `auto: 광고/진짜 일일 재확인 — ${target.title} (${TODAY})`]);
  try { sh(['pull', '--rebase', 'origin', 'main']); }
  catch (e) { console.error('⚠ pull --rebase 실패 — push 보류:', (e.stderr || e.message || '').toString().slice(0, 160)); process.exit(0); }
  sh(['push', 'origin', 'main']);
  console.log(`\n✓ 재확인 push 완료 → Vercel 재배포. '오늘의 한끗' = ${target.title}`);
} catch (e) {
  console.error('⚠ git 오류(파일은 반영됨):', (e.stderr || e.message || '').toString().slice(0, 200));
  process.exit(0);
}
