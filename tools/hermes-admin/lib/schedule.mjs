// 스케줄/시간 표시 헬퍼 — cron 식을 한국어 사람말로, ISO 시각을 상대시간으로.
// 의존성 0. 표시 전용(스케줄 계산은 hermes가 한 next_run_at를 신뢰).

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n) { return String(n).padStart(2, '0'); }

// "0 21 * * 1" 같은 표준 5필드 cron → "매주 월 21:00".
// 흔한 케이스 위주로 또렷하게. 못 풀면 원문 식을 그대로 돌려준다.
export function describeCron(expr) {
  if (!expr || typeof expr !== 'string') return '';
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [min, hour, dom, mon, dow] = parts;

  // 분·시가 단일 숫자일 때만 "HH:MM"으로. 아니면 원문.
  const timeKnown = /^\d+$/.test(min) && /^\d+$/.test(hour);
  const time = timeKnown ? `${pad2(+hour)}:${pad2(+min)}` : null;

  const everyDay = dom === '*' && mon === '*' && dow === '*';
  const weekly = dom === '*' && mon === '*' && /^[0-7](,[0-7])*$/.test(dow);

  if (time && everyDay) return `매일 ${time}`;
  if (time && weekly) {
    const days = dow.split(',').map((d) => DOW[(+d) % 7]).join('·');
    return `매주 ${days} ${time}`;
  }
  if (time && /^\d+$/.test(dom) && mon === '*' && dow === '*') {
    return `매월 ${dom}일 ${time}`;
  }
  return expr; // 복잡식은 원문 노출
}

// schedule 객체({kind, expr, display}) → 사람말. cron이면 describeCron, 그 외엔 display.
export function describeSchedule(schedule, fallbackDisplay) {
  if (!schedule) return fallbackDisplay || '';
  if (schedule.kind === 'cron' && schedule.expr) {
    return describeCron(schedule.expr);
  }
  return schedule.display || fallbackDisplay || '';
}

// ISO/epoch → "3시간 전", "내일 21:30", "2분 후". now 기준.
export function relativeTime(iso, now = Date.now()) {
  if (!iso) return '—';
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const diff = t - now; // 양수=미래
  const abs = Math.abs(diff);
  const min = 60 * 1000, hr = 60 * min, day = 24 * hr;
  const fut = diff >= 0;
  let txt;
  if (abs < min) txt = '방금';
  else if (abs < hr) txt = `${Math.round(abs / min)}분`;
  else if (abs < day) txt = `${Math.round(abs / hr)}시간`;
  else if (abs < 7 * day) txt = `${Math.round(abs / day)}일`;
  else {
    const d = new Date(t);
    return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
  }
  if (txt === '방금') return '방금';
  return fut ? `${txt} 후` : `${txt} 전`;
}

// ISO/epoch → "2026.06.26 21:33". 비면 '—'.
export function fmtDateTime(iso) {
  if (!iso) return '—';
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const d = new Date(t);
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// 실행 로그 파일명 "2026-06-26_21-33-24.md" → epoch(ms). 로컬 시간 가정.
export function parseRunTs(file) {
  const m = /(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/.exec(file || '');
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi, s).getTime();
}

// epoch(초) → "오늘"인지. state.db started_at(초) 판단용.
export function isToday(epochSec, now = Date.now()) {
  if (!epochSec) return false;
  const t = new Date(epochSec * 1000);
  const n = new Date(now);
  return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate();
}
