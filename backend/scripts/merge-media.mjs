#!/usr/bin/env node
// 일회성: 영상(video)·대표이미지(images)를 trends.json에 병합.
import { readFileSync, writeFileSync } from 'node:fs';

const VIDEO = {
  'illit-itsme':          { youtube: 'LM875jeR-PM', cap: "아일릿 'It's Me' 댄스 프랙티스 (공식)" },
  'dubai-choco':          { youtube: '5xrFV4-MgP0', cap: 'CU 두바이 초콜릿 리뷰 — 지뻔뻔' },
  'shanghai-buttertteok': { youtube: 'iEIOFHDlEQE', cap: '진짜 상하이 버터떡 만들기 — 지현쿡' },
  'nanrijabeth':          { youtube: 'oMttZAG3E3Y', cap: '요즘 유행어(난리자베스 포함) 설명' },
  'im-donut-seongsu':     { youtube: 'YATFyvAIz5s', cap: '성수 아임도넛 웨이팅 후기' },
};

// 로드 안 되거나 부적합한 og:image 제외 패턴
const DROP = [
  /dategom\.com\/wp-content\/uploads\/2023\/07\/.*\.jpg$/, // betong: text/html(404)
  /media\.nudge-community\.com/,                            // illit: 000
  /i\.namu\.wiki\/.*\.svg/,                                 // ghibli: svg 로고
  /_T1\.(png|jpg)/i,                                        // 중복 썸네일(작은 버전)
];

const imagesMap = JSON.parse(readFileSync('.pipeline/images.json', 'utf-8'));
const data = JSON.parse(readFileSync('data/trends.json', 'utf-8'));

let vCount = 0, iCount = 0;
for (const t of data.trends) {
  if (VIDEO[t.id]) { t.video = VIDEO[t.id]; vCount++; }
  const imgs = (imagesMap[t.id] || []).filter(u => !DROP.some(re => re.test(u))).slice(0, 3);
  if (imgs.length) { t.images = imgs; iCount += imgs.length; }
}
writeFileSync('data/trends.json', JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`✓ video ${vCount}개, images ${iCount}장 병합`);
for (const t of data.trends) {
  console.log(`  [${t.id}] video:${t.video ? '▶' : '-'} images:${(t.images || []).length}`);
}
