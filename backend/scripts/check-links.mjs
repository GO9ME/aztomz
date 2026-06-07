#!/usr/bin/env node
/* 한끗 — 출처 링크 점검기
   data/trends.json(또는 인자로 준 파일)의 모든 src URL을 확인.
   ❌ 404/410 = 죽은 링크(교체/제거 필요). ⚠️ ERR = 봇 차단 가능(브라우저선 열릴 수 있음).
   사용: node backend/scripts/check-links.mjs [파일경로]   (레포 루트에서)
   404가 하나라도 있으면 exit code 1. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = process.argv[2] || join(repoRoot, 'backend', 'data', 'trends.json');
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' };

const data = JSON.parse(await readFile(file, 'utf8'));
const items = Array.isArray(data) ? data : (data.trends || data.items || data.reviewed || []);
const urls = [];
// src 정규화: [["이름","url"]] 외에 [{name,url}] 객체 형태도 허용
const pair = (s) => Array.isArray(s) ? [s[0], s[1]] : [s && (s.name || s.title || ''), s && (s.url || s.href || s.link || '')];
for (const t of items) for (const s of (t.src || [])) { const [name, url] = pair(s); if (url) urls.push({ id: t.id || t.title, name, url }); }

let dead = 0, warn = 0;
for (const u of urls) {
  let status = 'ERR';
  try {
    const c = new AbortController(); const tm = setTimeout(() => c.abort(), 12000);
    const r = await fetch(u.url, { method: 'GET', headers: UA, redirect: 'follow', signal: c.signal });
    clearTimeout(tm); status = r.status;
  } catch (e) { status = 'ERR:' + (e.name || 'fetch').slice(0, 16); }
  const isDead = status === 404 || status === 410;
  const isWarn = String(status).startsWith('ERR') || status === 403;
  if (isDead) dead++; else if (isWarn) warn++;
  console.log((isDead ? '❌ ' : isWarn ? '⚠️  ' : '✅ ') + status + '  [' + u.id + '] ' + u.name + '  ' + u.url);
}
console.log(`\n결과: 죽은 링크(404/410) ${dead}개, 의심(차단 가능) ${warn}개, 전체 ${urls.length}개`);
if (dead > 0) { console.log('→ ❌ 항목은 진짜 URL로 교체하거나 출처에서 제거하세요.'); process.exit(1); }
