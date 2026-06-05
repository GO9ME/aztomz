#!/usr/bin/env node
// 일회성: 신뢰분석 항목에 점수별 근거(reasons.{ad,trust,sat}) 주입. 이후 refresh.mjs.
import { readFileSync, writeFileSync } from 'node:fs';

const REASONS = {
  'dubai-choco': {
    ad: '출시 직후 협찬 해시태그·반복 홍보 문구가 몰렸고 인플루언서 노출도 편중 → 광고 신호 중상.',
    trust: '후기 수는 많고 기간도 분산됐지만, 구체적 맛 묘사보다 “원조와 다르다”는 실망 후기가 섞임 → 중간.',
    sat: '“한 번이면 충분”, 바삭함 부족·단맛 위주 평이 우세 → 부정.',
  },
  'nudake': {
    ad: '브랜드 협업·비주얼 중심 노출은 많지만 노골적 협찬 문구는 적음 → 중간.',
    trust: '방문 인증·구체 후기는 있으나 “맛보다 비주얼” 평이 많아 만족이 갈림 → 중간.',
    sat: '예술적 비주얼은 호평, 맛·가성비는 “한 번이면 족” → 혼재.',
  },
  'betong': {
    ad: '협찬보다 7년 누적 단골의 자발적 후기 위주, 단기 폭발 신호 적음 → 낮음.',
    trust: '방문자·블로그 후기 5천+가 꾸준, 구체적 맛·가격 언급과 재방문 多 → 높음.',
    sat: '소금빵·퀸아망 식감 구체 호평, 가격도 솔직하게 평가됨 → 긍정.',
  },
  'pickbake': {
    ad: '성수 빵지순례 맥락의 자연 노출 위주, 반복 협찬 문구·단기 집중은 약함 → 낮음~중간.',
    trust: '에그타르트 식감·버터 풍미를 구체적으로 묘사한 후기가 다양, 웨이팅·재방문 언급도 多 → 높음.',
    sat: '겉바속촉 페스트리·부드러운 커스터드에 구체적 호평이 많음 → 긍정.',
  },
  'im-donut-seongsu': {
    ad: '오픈런 화제로 인플루언서 노출이 일부 집중됨 → 중간.',
    trust: '실제 4시간 웨이팅·재방문 후기가 받쳐주고, 단점(줄·가격) 언급도 있어 균형 → 중상.',
    sat: '쫀득한 생도넛 식감 호평, 일본 현지와 미세한 차이 지적 → 대체로 긍정.',
  },
  'east-bagel-dasan': {
    ad: '대형 협찬 없이 동네 입소문 위주, 반복 문구·인플루언서 편중 거의 없음 → 낮음.',
    trust: '“커피 4잔 2만원대”처럼 가격·양을 구체적으로 적은 후기 다수, 새벽 웨이팅까지 → 높음.',
    sat: '오픈런에도 줄 서는 찐맛집, 가성비·서비스 만족 → 긍정.',
  },
};

const path = 'backend/data/trends.json';
const data = JSON.parse(readFileSync(path, 'utf-8'));
let n = 0;
for (const t of data.trends) {
  if (REASONS[t.id]) { t.reasons = REASONS[t.id]; n++; }
}
writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`✓ reasons ${n}개 주입`);
for (const id in REASONS) {
  const t = data.trends.find(x => x.id === id);
  console.log(`  [${id}] 광고${t.ad}/신뢰${t.trust}/만족 ${t.sat} → 근거 3종`);
}
