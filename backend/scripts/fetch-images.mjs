#!/usr/bin/env node
// 일회성: 각 트렌드 출처에서 og:image를 ddgs extract로 뽑아 후보 이미지 맵 출력.
// 결과를 보고 사람이 trends.json의 images에 골라 넣는다(품질 관리).
// 사용: node scripts/fetch-images.mjs > .pipeline/images.json
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const DDGS = process.env.DDGS_EXE ||
  'E:/workspace/side_project/hermes/hermes-agent/venv/Scripts/ddgs.exe';
const data = JSON.parse(readFileSync('data/trends.json', 'utf-8'));

function extract(url) {
  try {
    return execFileSync(DDGS, ['extract', '-u', url, '-f', 'text'], {
      encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, timeout: 40000, windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    }) || '';
  } catch (e) { return (e.stdout && e.stdout.toString()) || ''; }
}
function ogImages(html) {
  const out = [];
  const re = /<meta[^>]+(?:property|name)=["'](?:og:image(?::url)?|twitter:image(?::src)?)["'][^>]+content=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    let u = m[1].trim();
    if (u.startsWith('//')) u = 'https:' + u;
    if (!/^https?:\/\//.test(u)) continue;
    if (/logo|favicon|sprite|icon|placeholder|default\.(png|jpg)/i.test(u)) continue;
    if (!out.includes(u)) out.push(u);
  }
  return out;
}
const result = {};
for (const t of data.trends) {
  const imgs = [];
  for (const [, url] of (t.src || [])) {
    for (const u of ogImages(extract(url))) { if (!imgs.includes(u)) imgs.push(u); }
  }
  result[t.id] = imgs.slice(0, 4);
  process.stderr.write(`${t.id}: ${imgs.length} imgs\n`);
}
console.log(JSON.stringify(result, null, 2));
