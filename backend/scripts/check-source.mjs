#!/usr/bin/env node
// 한끗 — 출처 본문 관련성 검사 (check-links.mjs의 짝: 상태→내용)
// 각 트렌드의 src URL 본문을 ddgs extract로 읽어, 그 트렌드 키워드가
// 실제로 등장하는지 확인한다. 200이어도 본문이 무관하면 가짜 출처.
//
// 사용: node backend/scripts/check-source.mjs [backend/data/trends.json] [--only=id1,id2]   (레포 루트에서)
// 종료코드: 무관(❌) 출처가 하나라도 있으면 1, 아니면 0.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const DDGS = process.env.DDGS_EXE ||
  'E:/workspace/side_project/hermes/hermes-agent/venv/Scripts/ddgs.exe';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--')) || 'backend/data/trends.json';
const onlyArg = args.find(a => a.startsWith('--only='));
const onlyIds = onlyArg ? onlyArg.slice(7).split(',').map(s => s.trim()) : null;

const data = JSON.parse(readFileSync(file, 'utf-8'));
let trends = data.trends || data;
if (onlyIds) trends = trends.filter(t => onlyIds.includes(t.id));

// 한국어 불용어(키워드에서 제외)
const STOP = new Set(['그리고','하지만','이게','정도','진짜','현','보라','첫주',
  '국내','이번','요즘','지금','오늘','관련','대한','위한','있는','없는']);

// src 정규화: [["이름","url"]] 표준 외에 [{name,url}] 객체 형태도 허용(봇이 종종 객체로 씀)
function srcPairs(t) {
  return (t.src || []).map(s =>
    Array.isArray(s) ? [s[0], s[1]] : [s && (s.name || s.title || s.src || ''), s && (s.url || s.href || s.link || '')]
  ).filter(([, url]) => url);
}

// 트렌드 제목 → 키워드 집합
function keywordsOf(t) {
  const raw = (t.title || '')
    .replace(/[()'’"]/g, ' ')
    .replace(/[·,/]/g, ' ')
    .split(/\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 2 && !STOP.has(s));
  // 카테고리별 보강어
  const cat = (t.coverCat || '').replace('cat-', '');
  const extra = {
    ai: ['프롬프트', '이미지', '챗GPT', 'GPT'],
    slang: ['신조어', '유행어', 'MZ'],
    music: ['챌린지', '밈', '챌린지'],
    fashion: ['패션', '트렌드'],
  }[cat] || [];
  return [...new Set([...raw, ...extra])];
}

function extract(url) {
  try {
    const out = execFileSync(DDGS, ['extract', '-u', url, '-f', 'text'], {
      encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, timeout: 40000,
      windowsHide: true,
      // ⚠️ ddgs(=python+click)는 Windows 콘솔 cp949로 출력하다 본문에 한자·키릴·악센트가
      // 나오면 UnicodeEncodeError로 크래시→본문이 잘린다. UTF-8을 강제해 전체 본문을 받는다.
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    });
    return out || '';
  } catch (e) {
    return (e.stdout && e.stdout.toString()) || '';
  }
}

function verdict(body, kws) {
  if (body.length < 80) return { v: '차단', icon: '🚫', hits: [], note: `본문 ${body.length}자(추출 실패/차단)` };
  const hits = kws.map(k => [k, (body.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length])
    .filter(([, c]) => c > 0);
  const distinct = hits.length;
  if (distinct >= 2) return { v: '정확', icon: '✅', hits, note: `핵심어 ${distinct}종 일치` };
  if (distinct === 1) return { v: '약함', icon: '⚠️', hits, note: `핵심어 1종만` };
  return { v: '무관', icon: '❌', hits, note: '본문에 핵심어 없음' };
}

console.log(`🔗 출처 본문 관련성 검사 — ${file}\n`);
let bad = 0, blocked = 0, ok = 0;
for (const t of trends) {
  const kws = keywordsOf(t);
  console.log(`[${(t.coverCat || '').replace('cat-', '')}] ${t.title}`);
  console.log(`   키워드: ${kws.join(', ')}`);
  for (const [name, url] of srcPairs(t)) {
    const body = extract(url);
    const r = verdict(body, kws);
    const hitStr = r.hits.length ? '  (' + r.hits.map(([k, c]) => `${k}×${c}`).join(', ') + ')' : '';
    console.log(`   ${r.icon} ${r.v}  ${name}${hitStr}`);
    console.log(`        ${url}`);
    if (r.v === '무관') bad++;
    else if (r.v === '차단') blocked++;
    else ok++;
  }
  console.log('');
}
console.log(`\n결과: 정확/약함 ${ok}개, ❌무관 ${bad}개, 🚫차단·보류 ${blocked}개`);
if (bad > 0) { console.log('→ 무관 출처를 진짜 출처로 교체하세요.'); process.exit(1); }
