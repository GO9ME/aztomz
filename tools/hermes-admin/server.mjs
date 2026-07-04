// hermes-admin — 로컬 전용 관리 서버(의존성 0).
// 127.0.0.1 에만 바인드. 모든 /api/* 는 기동 시 발급한 토큰 필요.
// 표시는 파일/DB 직접 읽기, 수정은 hermes CLI 경유.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  HOME, HERMES_EXE, runHermes, readJobs, readConfig, readSessions,
  listRuns, readRun, maskedAuth, gatewayStatus, isValidJobId, configKeyAllowed,
} from './lib/hermes.mjs';
import { describeSchedule, relativeTime, fmtDateTime, isToday } from './lib/schedule.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const STYLES_CSS = path.join(__dirname, '..', '..', 'frontend', 'assets', 'styles.css');
const FAVICON = path.join(__dirname, '..', '..', 'frontend', 'favicon.svg');

const argv = process.argv.slice(2);
const argVal = (name) => { const p = argv.find((a) => a.startsWith(name + '=')); return p ? p.slice(name.length + 1) : null; };
const PORT = Number(argVal('--port') || process.env.HERMES_ADMIN_PORT || process.env.PORT || 7766);
const HOST = '127.0.0.1';
const TOKEN = argVal('--token') || process.env.HERMES_ADMIN_TOKEN || crypto.randomBytes(16).toString('hex');

// 자동 실행 마스터 스위치. 마커 파일 존재 = OFF(전체 일시정지). 마커 안에 OFF가 멈춘 작업 id를 기억 → ON 때 그것만 재개.
const MARKER = path.join(__dirname, '.automation-off.json');
const automationOff = () => fs.existsSync(MARKER);

// ---------- 응답 헬퍼 ----------
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function sendFile(res, file, type) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 4 * 1024 * 1024) { req.destroy(); return; } chunks.push(c); });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8'); // 멀티청크 경계 안전한 UTF-8 디코딩
      try { resolve(text ? JSON.parse(text) : {}); } catch { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

// jobs.json 을 표시용으로 가공
function enrichJobs() {
  const { jobs, updatedAt } = readJobs();
  const now = Date.now();
  const list = jobs.map((j) => ({
    ...j,
    scheduleHuman: describeSchedule(j.schedule, j.schedule_display),
    nextRel: j.enabled ? relativeTime(j.next_run_at, now) : '—',
    nextAt: fmtDateTime(j.next_run_at),
    lastRel: relativeTime(j.last_run_at, now),
    lastAt: fmtDateTime(j.last_run_at),
    runCount: j.repeat && typeof j.repeat.completed === 'number' ? j.repeat.completed : 0,
  }));
  return { jobs: list, updatedAt };
}

// ---------- 라우팅 ----------
async function handleApi(req, res, url) {
  const seg = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = req.method;

  // GET /api/overview
  if (seg[0] === 'overview' && method === 'GET') {
    const { jobs } = enrichJobs();
    const gw = gatewayStatus();
    const cfg = await readConfig();
    const sessions = readSessions(60);
    const todayRuns = Array.isArray(sessions) ? sessions.filter((s) => isToday(s.started_at)) : [];
    const enabled = jobs.filter((j) => j.enabled);
    const next = enabled
      .filter((j) => j.next_run_at)
      .sort((a, b) => Date.parse(a.next_run_at) - Date.parse(b.next_run_at))[0] || null;
    const model = cfg.config && cfg.config.model ? cfg.config.model : null;
    return sendJson(res, 200, {
      gateway: gw,
      automation: automationOff() ? 'off' : 'on',
      model: model ? (model.default || null) : null,
      provider: model ? (model.provider || null) : null,
      counts: { total: jobs.length, enabled: enabled.length, paused: jobs.length - enabled.length },
      next: next ? { id: next.id, name: next.name, at: next.nextAt, rel: next.nextRel, schedule: next.scheduleHuman } : null,
      today: {
        runs: todayRuns.length,
        ok: todayRuns.filter((s) => s.end_reason && /complete|done|^ok$/i.test(s.end_reason)).length,
        err: todayRuns.filter((s) => s.end_reason && /error|timeout|fail|interrupt/i.test(s.end_reason)).length,
        cost: todayRuns.reduce((a, s) => a + (s.estimated_cost_usd || 0), 0),
      },
    });
  }

  // GET /api/crons
  if (seg[0] === 'crons' && seg.length === 1 && method === 'GET') {
    return sendJson(res, 200, enrichJobs());
  }

  // POST /api/crons  (생성)
  if (seg[0] === 'crons' && seg.length === 1 && method === 'POST') {
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { error: '잘못된 요청 본문' });
    const args = buildCreateArgs(body);
    if (args.error) return sendJson(res, 400, { error: args.error });
    const r = await runHermes(args.argv);
    return sendJson(res, r.code === 0 ? 200 : 422, { cli: r, jobs: enrichJobs().jobs });
  }

  // /api/crons/:id ...
  if (seg[0] === 'crons' && seg[1]) {
    const id = seg[1];
    if (!isValidJobId(id)) return sendJson(res, 400, { error: '잘못된 작업 ID' });

    // GET /api/crons/:id  (상세 + 실행로그 목록)
    if (seg.length === 2 && method === 'GET') {
      const { jobs } = enrichJobs();
      const job = jobs.find((j) => j.id === id);
      if (!job) return sendJson(res, 404, { error: '작업 없음' });
      return sendJson(res, 200, { job, runs: listRuns(id) });
    }
    // GET /api/crons/:id/runs/:file  (실행로그 1건)
    if (seg.length === 4 && seg[2] === 'runs' && method === 'GET') {
      try { return sendJson(res, 200, { file: seg[3], content: readRun(id, decodeURIComponent(seg[3])) }); }
      catch (e) { return sendJson(res, 400, { error: String(e.message || e) }); }
    }
    // PATCH /api/crons/:id  (수정)
    if (seg.length === 2 && method === 'PATCH') {
      const body = await readBody(req);
      if (!body) return sendJson(res, 400, { error: '잘못된 요청 본문' });
      const args = buildEditArgs(id, body);
      if (args.error) return sendJson(res, 400, { error: args.error });
      if (args.argv.length <= 3) return sendJson(res, 400, { error: '변경할 항목이 없습니다.' });
      const r = await runHermes(args.argv);
      return sendJson(res, r.code === 0 ? 200 : 422, { cli: r, jobs: enrichJobs().jobs });
    }
    // DELETE /api/crons/:id
    if (seg.length === 2 && method === 'DELETE') {
      const r = await runHermes(['cron', 'remove', id]);
      return sendJson(res, r.code === 0 ? 200 : 422, { cli: r, jobs: enrichJobs().jobs });
    }
    // POST /api/crons/:id/(pause|resume|run)
    if (seg.length === 3 && method === 'POST' && ['pause', 'resume', 'run'].includes(seg[2])) {
      const r = await runHermes(['cron', seg[2], id]);
      return sendJson(res, r.code === 0 ? 200 : 422, { cli: r, jobs: enrichJobs().jobs });
    }
  }

  // GET /api/config
  if (seg[0] === 'config' && seg.length === 1 && method === 'GET') {
    return sendJson(res, 200, await readConfig());
  }
  // PATCH /api/config  (화이트리스트 키만)
  if (seg[0] === 'config' && seg.length === 1 && method === 'PATCH') {
    const body = await readBody(req);
    if (!body || typeof body.key !== 'string') return sendJson(res, 400, { error: 'key 필요' });
    if (!configKeyAllowed(body.key)) return sendJson(res, 403, { error: `허용되지 않은 설정 키: ${body.key}` });
    const value = String(body.value ?? '');
    const r = await runHermes(['config', 'set', body.key, value]);
    return sendJson(res, r.code === 0 ? 200 : 422, { cli: r, config: (await readConfig()) });
  }

  // GET /api/runs
  if (seg[0] === 'runs' && method === 'GET') {
    const sessions = readSessions(60);
    return sendJson(res, 200, { sessions });
  }
  // GET /api/auth
  if (seg[0] === 'auth' && method === 'GET') {
    return sendJson(res, 200, maskedAuth());
  }

  // POST /api/automation { on: true|false } — 마스터 on/off(전체 일시정지/재개)
  if (seg[0] === 'automation' && method === 'POST') {
    const body = await readBody(req);
    if (!body || typeof body.on !== 'boolean') return sendJson(res, 400, { error: 'on(boolean) 필요' });
    const log = [];
    if (body.on === false) {
      const ids = readJobs().jobs.filter((j) => j.enabled).map((j) => j.id);
      for (const id of ids) { const r = await runHermes(['cron', 'pause', id]); if (r.code !== 0) log.push(`pause ${id}: ${(r.stderr || r.error || '').trim()}`); }
      fs.writeFileSync(MARKER, JSON.stringify({ paused: ids, at: new Date().toISOString() }));
    } else {
      let ids = [];
      try { ids = JSON.parse(fs.readFileSync(MARKER, 'utf8')).paused || []; } catch { /* 마커 없으면 빈 목록 */ }
      for (const id of ids) { const r = await runHermes(['cron', 'resume', id]); if (r.code !== 0) log.push(`resume ${id}: ${(r.stderr || r.error || '').trim()}`); }
      try { fs.unlinkSync(MARKER); } catch { /* noop */ }
    }
    return sendJson(res, 200, { automation: automationOff() ? 'off' : 'on', log, jobs: enrichJobs().jobs });
  }

  return sendJson(res, 404, { error: 'unknown endpoint' });
}

// ---------- CLI 인자 빌더 ----------
function buildCreateArgs(b) {
  const schedule = (b.schedule || '').trim();
  if (!schedule) return { error: '스케줄을 입력하세요. (예: "30 21 * * *", "30m", "every 2h")' };
  const noAgent = !!b.no_agent;
  const prompt = (b.prompt || '').trim();
  const script = (b.script || '').trim();
  if (noAgent && !script) return { error: 'no-agent 작업은 script가 필요합니다.' };
  if (!noAgent && !prompt && !(Array.isArray(b.skills) && b.skills.length)) {
    return { error: '에이전트 작업은 prompt 또는 skill이 필요합니다.' };
  }
  const argv = ['cron', 'create', schedule];
  if (!noAgent && prompt) argv.push(prompt);
  if (b.name) argv.push('--name', String(b.name));
  if (b.deliver) argv.push('--deliver', String(b.deliver));
  if (b.workdir) argv.push('--workdir', String(b.workdir));
  if (Array.isArray(b.skills)) for (const s of b.skills) if (s) argv.push('--skill', String(s));
  if (script) argv.push('--script', script);
  if (noAgent) argv.push('--no-agent');
  if (b.model) argv.push('--model', String(b.model));
  if (b.provider) argv.push('--provider', String(b.provider));
  if (b.repeat != null && b.repeat !== '') argv.push('--repeat', String(b.repeat));
  return { argv };
}

function buildEditArgs(id, b) {
  const argv = ['cron', 'edit', id];
  if (typeof b.schedule === 'string' && b.schedule.trim()) argv.push('--schedule', b.schedule.trim());
  if (typeof b.name === 'string') argv.push('--name', b.name);
  if (typeof b.prompt === 'string') argv.push('--prompt', b.prompt);
  if (typeof b.deliver === 'string' && b.deliver) argv.push('--deliver', b.deliver);
  if (typeof b.workdir === 'string') argv.push('--workdir', b.workdir); // 빈문자열=clear
  if (typeof b.script === 'string') argv.push('--script', b.script);
  if (typeof b.model === 'string' && b.model) argv.push('--model', b.model);
  if (typeof b.provider === 'string' && b.provider) argv.push('--provider', b.provider);
  if (b.no_agent === true) argv.push('--no-agent');
  if (b.no_agent === false) argv.push('--agent');
  // skills: 배열이 오면 전체 치환(--clear-skills 후 --add-skill), 빈배열이면 clear만.
  if (Array.isArray(b.skills)) {
    argv.push('--clear-skills');
    for (const s of b.skills) if (s) argv.push('--add-skill', String(s));
  }
  if (b.repeat != null && b.repeat !== '') argv.push('--repeat', String(b.repeat));
  return { argv };
}

// ---------- 서버 ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  // 정적 — 토큰 불필요(인덱스/자원). 단 API 토큰은 별도.
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return sendFile(res, path.join(PUBLIC_DIR, 'index.html'), MIME['.html']);
  }
  if (req.method === 'GET' && url.pathname === '/styles.css') return sendFile(res, STYLES_CSS, MIME['.css']);
  if (req.method === 'GET' && url.pathname === '/favicon.svg') return sendFile(res, FAVICON, MIME['.svg']);
  if (req.method === 'GET' && (url.pathname === '/app.js' || url.pathname === '/admin.css')) {
    const f = path.join(PUBLIC_DIR, path.basename(url.pathname));
    return sendFile(res, f, MIME[path.extname(f)] || 'application/octet-stream');
  }

  // API — 토큰 게이트
  if (url.pathname.startsWith('/api/')) {
    const tok = req.headers['x-admin-token'] || url.searchParams.get('t');
    if (tok !== TOKEN) return sendJson(res, 401, { error: '인증 토큰 불일치' });
    try { return await handleApi(req, res, url); }
    catch (e) { return sendJson(res, 500, { error: String(e.message || e) }); }
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, HOST, () => {
  const link = `http://${HOST}:${PORT}/?t=${TOKEN}`;
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  hermes-admin — 로컬 관리 콘솔');
  console.log(`  HERMES_HOME : ${HOME}`);
  console.log(`  hermes exe  : ${HERMES_EXE}`);
  console.log('');
  console.log(`  열기 → ${link}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});
