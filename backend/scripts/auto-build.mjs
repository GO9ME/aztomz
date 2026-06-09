#!/usr/bin/env node
/* ============================================================
   한끗 · 자동 빌드·게시 (사람 승인 없이 — 출처 자동검증 게이트)

   .pipeline/curate.json 의 항목을 받아 결정적으로 처리한다:
   1) 중복(id/title) 제거 (멱등 — 이미 사이트에 있으면 건너뜀)
   2) 각 src 자동검증:
        · 상태   = fetch(리디렉션 추적). 404/410 = 죽음 → 제거
        · 관련성 = ddgs extract 본문에 트렌드 핵심어 등장? 무관/차단(못 읽음) → 제거
      → '정확/약함'(핵심어 1종+)인 출처만 통과로 남긴다.
   3) 통과 출처가 1개 이상인 항목만 trends.json 에 추가. 0개면 '보류'(게시 안 함).
      · images 가 비어 있으면 검증 통과 출처의 og:image 를 썸네일로 자동 주입(추가 fetch 없이 본문 재사용).
      · shops(파는 가게 목록)가 있으면 각 가게 URL 상태점검 → 죽은 링크만 제거(이름·지역은 유지).
   4) refresh.mjs 로 trends.js 재생성.
   5) git pull --rebase → add → commit → push (Vercel 자동 배포). (--no-git 면 생략)

   ▶ 신뢰 철칙 준수: 사람 대신 '자동 검증'이 게이트. 가짜·죽은 출처는 사이트에 안 올라간다.
   ▶ 게시는 검증 통과분만 — LLM이 지어낸 URL은 ddgs 본문검증에서 걸러진다.

   사용:
     node backend/scripts/auto-build.mjs [.pipeline/curate.json] [--no-git] [--dry] [--strict]
       --no-git : 파일은 갱신하되 git commit/push 생략 (로컬 테스트)
       --dry    : 아무것도 쓰지 않고 검증 결과만 보고
       --strict : '정확(핵심어 2종+)'만 통과 (기본은 '약함'(1종)도 통과)
   종료코드: 게시 0건이어도 0(정상). 치명 오류만 1.
   env: DDGS_EXE(ddgs 실행경로, 기본 로컬 venv) — Actions에선 pip ddgs + DDGS_EXE=ddgs
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateTrends } from './validate-trends.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const trendsPath = join(repoRoot, 'backend', 'data', 'trends.json');
const refreshPath = join(repoRoot, 'backend', 'scripts', 'refresh.mjs');
const trendsJsPath = join(repoRoot, 'frontend', 'data', 'trends.js');

const args = process.argv.slice(2);
const NO_GIT = args.includes('--no-git');
const DRY = args.includes('--dry');
const STRICT = args.includes('--strict');
const curatePath = args.find(a => !a.startsWith('--')) || join(repoRoot, '.pipeline', 'curate.json');

const DDGS = process.env.DDGS_EXE ||
  'E:/workspace/side_project/hermes/hermes-agent/venv/Scripts/ddgs.exe';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' };

// ── KST 오늘 날짜
function kstISO() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const TODAY = kstISO();
const normTitle = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '');

// ── 핵심어 추출 (제목의 '구체어'와 카테고리 '일반어'를 분리)
const STOP = new Set(['그리고','하지만','이게','정도','진짜','현','보라','첫주',
  '국내','이번','요즘','지금','오늘','관련','대한','위한','있는','없는','테스트','출처']);
function titleKeywords(t) {
  return [...new Set((t.title || '').replace(/[()'’"]/g, ' ').replace(/[·,/]/g, ' ')
    .split(/\s+/).map(s => s.trim()).filter(s => s.length >= 2 && !STOP.has(s)))];
}
function extraKeywords(t) {
  const cat = (t.coverCat || '').replace('cat-', '');
  return { ai: ['프롬프트','이미지','챗GPT','GPT'], slang: ['신조어','유행어','MZ'],
    music: ['챌린지','밈'], fashion: ['패션','트렌드'] }[cat] || [];
}
function extract(url) {
  try {
    return execFileSync(DDGS, ['extract', '-u', url, '-f', 'text'], {
      encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, timeout: 40000, windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    }) || '';
  } catch (e) { return (e.stdout && e.stdout.toString()) || ''; }
}
// ── og:image 추출 (검증 통과 출처의 대표 이미지 → 썸네일 자동 주입용)
//    extract() 본문엔 <meta property="og:image"> 가 들어 있어 추가 fetch 없이 재사용한다.
function ogImages(body) {
  const out = [];
  const re = /<meta[^>]+(?:property|name)=["'](?:og:image(?::url)?|twitter:image(?::src)?)["'][^>]+content=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(body))) {
    let u = m[1].trim();
    if (u.startsWith('//')) u = 'https:' + u;
    if (!/^https?:\/\//.test(u)) continue;
    if (/logo|favicon|sprite|icon|placeholder|default\.(png|jpg)/i.test(u)) continue;
    if (!out.includes(u)) out.push(u);
  }
  return out;
}
const hasKw = (body, k) => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(body);
function relevance(body, titleKws, extraKws) {
  if (body.length < 80) return { pass: false, v: '차단', note: `본문 ${body.length}자(못 읽음)` };
  const tHits = titleKws.filter(k => hasKw(body, k)).length;   // 제목 구체어 일치 수
  const eHits = extraKws.filter(k => hasKw(body, k)).length;   // 카테고리 일반어 일치 수
  // ⛔ 게이트 핵심: 제목 구체어가 0이면 '이 트렌드'를 다룬 게 아님 → 일반어만으론 통과 불가
  if (tHits === 0) return { pass: false, v: '무관', note: '제목 핵심어 없음(일반어뿐)' };
  const distinct = tHits + eHits;
  if (tHits >= 2 || distinct >= 2) return { pass: true, v: '정확', note: `제목어 ${tHits}+일반어 ${eHits}` };
  return { pass: !STRICT, v: '약함', note: `제목어 ${tHits}종만` };  // 제목어 1 + 일반어 0
}
async function httpStatus(url) {
  try {
    const c = new AbortController(); const tm = setTimeout(() => c.abort(), 12000);
    const r = await fetch(url, { method: 'GET', headers: UA, redirect: 'follow', signal: c.signal });
    clearTimeout(tm); return r.status;
  } catch { return 'ERR'; }
}

// 🏪 가게(shops) 검증: 모양 교정 + 죽은 URL 제거(이름·지역·메모는 유지).
//    LLM이 지어낸 가게 링크가 사이트에 남지 않게 — src와 같은 신뢰 철칙(추측 URL 금지) 적용.
//    같은 URL은 한 번만 점검(캐시). 최대 6곳.
async function verifyShops(cand) {
  if (!Array.isArray(cand.shops) || !cand.shops.length) { delete cand.shops; return; }
  const clean = [], cache = new Map();
  for (const sh of cand.shops) {
    if (!sh || !sh.name) continue;
    const out = { name: String(sh.name).trim() };
    if (sh.area) out.area = String(sh.area).trim();
    if (sh.note) out.note = String(sh.note).trim();
    const url = sh.url && String(sh.url).trim();
    if (url && /^https?:\/\//.test(url)) {
      let st = cache.get(url);
      if (st === undefined) { st = await httpStatus(url); cache.set(url, st); }
      if (st === 404 || st === 410 || st === 'ERR') console.log(`   🏪✋ 죽은 가게링크 제거(${st}) ${out.name}`);
      else out.url = url;
    }
    clean.push(out);
    if (clean.length >= 6) break;
  }
  if (clean.length) { cand.shops = clean; console.log(`   🏪 가게 ${clean.length}곳`); }
  else delete cand.shops;
}

function sh(cmd, a) {
  return execFileSync(cmd, a, { cwd: repoRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// src 정규화: 표준 [["이름","url"]] 외에 봇이 자주 쓰는 [{name,url}] 객체도 허용
function srcPairs(t) {
  return (t.src || []).map(s =>
    Array.isArray(s) ? [s[0], s[1]] : [s && (s.name || s.title || s.src || ''), s && (s.url || s.href || s.link || '')]
  ).filter(([, url]) => url);
}
// 스키마 자동 교정: recs/필수필드가 잘못 오면 사이트가 안 깨지게 기본값으로 정정
function sanitizeItem(t) {
  if (!Array.isArray(t.recs) || !t.recs.every(r => Array.isArray(r) && r.length >= 2)) {
    t.recs = [['뜻·맥락 알고 쓰기', '◎', 1], ['상황 맞게', '○', 1], ['격식 자리', '✕', 0]];
  }
  t.type = t.type || '트렌드';
  t.label = t.label || '지금 써도 됨';
  t.labelCls = ['good', 'warn', 'mid'].includes(t.labelCls) ? t.labelCls : 'good';
  t.excerpt = t.excerpt || t.def || t.title || '';
  t.verdict = t.verdict || t.excerpt || '';
  t.buzz = t.buzz || '화제성 상승';
  if (!Array.isArray(t.tags)) t.tags = t.tags ? [String(t.tags)] : [];
  if (typeof t.pull !== 'string') t.pull = '';
  return t;
}

// ── curate 로드
if (!existsSync(curatePath)) { console.log(`· curate 없음(${curatePath}) — 게시할 것 없음.`); process.exit(0); }
let curate;
try { curate = JSON.parse(readFileSync(curatePath, 'utf-8')); }
catch (e) { console.error('✗ curate.json 파싱 실패:', e.message); process.exit(1); }
const candidates = Array.isArray(curate) ? curate : (curate.trends || curate.candidates || curate.items || []);
if (!candidates.length) { console.log('· curate 비어있음 — 게시할 것 없음.'); process.exit(0); }

const data = JSON.parse(readFileSync(trendsPath, 'utf-8'));
const trends = Array.isArray(data) ? data : (data.trends || []);
const haveIds = new Set(trends.map(t => t.id));
const haveTitles = new Set(trends.map(t => normTitle(t.title)));

console.log(`🤖 자동 빌드 — ${TODAY} · 후보 ${candidates.length}개${STRICT ? ' (strict)' : ''}${DRY ? ' [DRY]' : ''}\n`);

const published = [], held = [], skipped = [];
for (const cand of candidates) {
  const title = cand.title || cand.id || '(무제)';
  if (!cand.id) { held.push({ title, reason: 'id 없음' }); continue; }
  if (haveIds.has(cand.id) || haveTitles.has(normTitle(cand.title))) { skipped.push({ title, reason: '이미 사이트에 있음' }); continue; }

  const titleKws = titleKeywords(cand), extraKws = extraKeywords(cand);
  const good = [];
  const ogImgs = [];   // 검증 통과 출처의 og:image (썸네일 자동 주입용)
  for (const [name, url] of srcPairs(cand)) {
    const st = await httpStatus(url);
    if (st === 404 || st === 410) { console.log(`   ❌ ${st} 죽음  ${name}`); continue; }
    const body = extract(url);
    const rel = relevance(body, titleKws, extraKws);
    console.log(`   ${rel.pass ? '✅' : '✋'} ${rel.v}(${rel.note})  ${name}`);
    if (rel.pass) { good.push([name, url]); for (const u of ogImages(body)) if (!ogImgs.includes(u)) ogImgs.push(u); }
  }

  if (good.length >= 1) {
    cand.src = good;
    // 🖼 썸네일 자동 주입: images가 비면 검증 통과 출처의 og:image로 채운다(추가 fetch 없음).
    //    봇이 images를 빠뜨려도 모든 자동 게시물이 커버 썸네일을 갖도록 보장(깨진 URL은 프론트 onerror가 폴백).
    if (!Array.isArray(cand.images) || !cand.images.length) {
      if (ogImgs.length) { cand.images = ogImgs.slice(0, 2); console.log(`   🖼 썸네일 자동 주입 ${cand.images.length}장 (출처 og:image)`); }
      else console.log('   ⚠ og:image 없음 — 썸네일 색커버 폴백');
    }
    cand.collectedAt = cand.collectedAt || TODAY;   // 첫 수집일 불변
    cand.analyzedAt = TODAY;
    if (!cand.coverCat) cand.coverCat = { 디저트:'cat-dessert', 카페:'cat-cafe', 베이커리:'cat-bakery',
      '카페·베이커리':'cat-cafe', 식당:'cat-food', 음료:'cat-drink', 패션:'cat-fashion', 신조어:'cat-slang' }[cand.cat] || 'cat-trend';
    await verifyShops(cand);   // 🏪 가게 목록 검증(죽은 링크 제거, 이름·지역 유지)
    sanitizeItem(cand);   // recs/필수필드 스키마 자동 교정(봇 실수 방지)
    published.push(cand);
    haveIds.add(cand.id); haveTitles.add(normTitle(cand.title));
    console.log(`  → 게시: ${title} (검증 출처 ${good.length}개)\n`);
  } else {
    held.push({ title, reason: '검증 통과 출처 0개(죽음/무관/못읽음)' });
    console.log(`  → 보류: ${title} (검증 통과 출처 없음)\n`);
  }
}

// ── 보고
const report = [
  `자동 빌드 결과 (${TODAY}):`,
  `  ✅ 게시 ${published.length}: ${published.map(t => t.title).join(', ') || '(없음)'}`,
  `  ✋ 보류 ${held.length}: ${held.map(h => `${h.title}(${h.reason})`).join(', ') || '(없음)'}`,
  `  ⏭  중복 ${skipped.length}: ${skipped.map(s => s.title).join(', ') || '(없음)'}`,
].join('\n');
console.log('\n' + report);

if (!published.length) { console.log('\n· 게시할 검증통과 항목 없음 — 변경 없이 종료.'); process.exit(0); }
if (DRY) { console.log('\n[DRY] 파일·git 변경 없이 종료.'); process.exit(0); }

// ── trends.json 갱신 + refresh
trends.push(...published);
const out = Array.isArray(data) ? trends : (data.trends = trends, data);
// ── 스키마 게이트: cat 7분류 이탈·id 중복·analyzedAt 형식오류 등 깨진 데이터는 빌드/배포 전 중단
const _v = validateTrends(Array.isArray(out) ? out : out.trends);
if (!_v.ok) { console.error('\n⛔ 스키마 검증 실패 — 빌드·배포 중단:\n' + _v.errors.map((e) => '  · ' + e).join('\n')); process.exit(1); }
if (_v.warnings.length) console.warn(`⚠ 스키마 경고 ${_v.warnings.length}건(배포는 계속)`);
console.log('✓ 스키마 검증 통과');
writeFileSync(trendsPath, JSON.stringify(out, null, 2) + '\n', 'utf-8');
execFileSync('node', [refreshPath], { cwd: repoRoot, stdio: 'inherit' });

// ── git: 충돌 방지 위해 commit 후 pull --rebase → push
if (NO_GIT) { console.log('\n--no-git: git 단계 생략. 게시', published.length, '건 파일 반영 완료.'); process.exit(0); }
try {
  sh('git', ['add', 'backend/data/trends.json', 'frontend/data/trends.js']);
  sh('git', ['commit', '-m', `auto: 트렌드 자동 게시(검증통과 ${published.length}) ${TODAY}`,
    '-m', published.map(t => `- ${t.title}`).join('\n')]);
  try { sh('git', ['pull', '--rebase', 'origin', 'main']); }
  catch (e) { console.error('⚠ pull --rebase 실패(충돌 가능) — push 보류:', (e.stderr || e.message || '').toString().slice(0, 200)); process.exit(0); }
  sh('git', ['push', 'origin', 'main']);
  console.log(`\n✓ 자동 게시·배포: ${published.length}건 push 완료 → Vercel 재배포.`);
} catch (e) {
  console.error('⚠ git 단계 오류(파일은 반영됨):', (e.stderr || e.message || '').toString().slice(0, 300));
  process.exit(0);
}
