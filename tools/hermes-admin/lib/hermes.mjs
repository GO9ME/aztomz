// hermes 연동 레이어 — 표시는 파일/DB 직접 읽기, 수정은 hermes CLI 경유.
// 게이트웨이가 jobs.json을 소유(매 tick 재기록)하므로 jobs.json/config.yaml에 직접 쓰지 않는다.
// 의존성 0: node:* 만 사용.

import { execFile } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// ---------- 경로 탐지 ----------
export const HOME = process.env.HERMES_HOME || 'E:\\workspace\\side_project\\hermes';
const AGENT_DIR = path.join(HOME, 'hermes-agent');
const SCRIPTS_DIR = path.join(AGENT_DIR, 'venv', 'Scripts');

function firstExisting(cands, fallback) {
  for (const c of cands) { try { if (fs.existsSync(c)) return c; } catch { /* noop */ } }
  return fallback;
}
export const HERMES_EXE = firstExisting(
  [path.join(SCRIPTS_DIR, 'hermes.exe'), path.join(SCRIPTS_DIR, 'hermes')],
  'hermes', // PATH 폴백
);
const PYTHON_EXE = firstExisting(
  [path.join(SCRIPTS_DIR, 'python.exe'), path.join(SCRIPTS_DIR, 'python')],
  'python',
);

const JOBS_PATH = path.join(HOME, 'cron', 'jobs.json');
const CONFIG_PATH = path.join(HOME, 'config.yaml');
const AUTH_PATH = path.join(HOME, 'auth.json');
const STATE_DB = path.join(HOME, 'state.db');
const OUTPUT_DIR = path.join(HOME, 'cron', 'output');
const GATEWAY_STATE = path.join(HOME, 'gateway_state.json');

const HEX12 = /^[0-9a-f]{12}$/;
export function isValidJobId(id) { return typeof id === 'string' && HEX12.test(id); }

// ---------- 프로세스 실행 ----------
function runFile(file, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(file, args, {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, HERMES_HOME: HOME, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      ...opts,
    }, (err, stdout, stderr) => {
      let code = 0;
      if (err) code = typeof err.code === 'number' ? err.code : 1;
      resolve({
        code,
        stdout: stdout || '',
        stderr: stderr || '',
        error: err ? (err.code === 'ENOENT' ? 'hermes 실행파일을 찾지 못했습니다.' : String(err.message)) : null,
      });
    });
  });
}

// hermes CLI 호출. args는 반드시 배열(셸 미경유) → 한글·공백·줄바꿈 안전.
export function runHermes(args) { return runFile(HERMES_EXE, args); }

// ---------- 읽기 ----------
export function readJobs() {
  const raw = fs.readFileSync(JOBS_PATH, 'utf8');
  const data = JSON.parse(raw);
  return { jobs: Array.isArray(data.jobs) ? data.jobs : [], updatedAt: data.updated_at || null };
}

// config.yaml → 객체. venv 파이썬으로 YAML→JSON(의존성 0). 시크릿 키는 마스킹.
export async function readConfig() {
  const code = "import yaml,json,sys;print(json.dumps(yaml.safe_load(open(sys.argv[1],encoding='utf-8'))))";
  const r = await runFile(PYTHON_EXE, ['-c', code, CONFIG_PATH]);
  if (r.code === 0 && r.stdout.trim()) {
    try { return { config: sanitize(JSON.parse(r.stdout)), raw: false }; } catch { /* fallthrough */ }
  }
  // 폴백: hermes config show 원문
  const show = await runHermes(['config', 'show']);
  return { config: null, showText: show.stdout || show.stderr || r.error || '읽기 실패', raw: true };
}

const SECRET_RE = /(token|secret|password|passwd|api_key|apikey|client_secret|access_token|refresh_token|webhook|cookie)/i;
function sanitize(obj) {
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SECRET_RE.test(k) && v != null && v !== '' && typeof v !== 'object') out[k] = '••• (가려짐)';
      else out[k] = sanitize(v);
    }
    return out;
  }
  return obj;
}

// state.db cron 세션 — 토큰·비용·상태. id에서 jobId 추출(cron_<id>_<날짜>_<시간>).
export function readSessions(limit = 50) {
  let db;
  try {
    db = new DatabaseSync(STATE_DB, { readOnly: true });
    const rows = db.prepare(
      `SELECT id, source, model, started_at, ended_at, end_reason, message_count,
              tool_call_count, input_tokens, output_tokens, cache_read_tokens, reasoning_tokens,
              estimated_cost_usd, actual_cost_usd, cost_status, title, api_call_count
       FROM sessions WHERE source='cron' ORDER BY started_at DESC LIMIT ?`,
    ).all(limit);
    return rows.map((r) => ({ ...r, jobId: parseJobId(r.id) }));
  } catch (e) {
    return { error: String(e.message || e) };
  } finally {
    try { if (db) db.close(); } catch { /* noop */ }
  }
}
function parseJobId(id) { const m = /^cron_([0-9a-f]{12})_/.exec(id || ''); return m ? m[1] : null; }

// 작업별 실행 로그 목록
export function listRuns(jobId) {
  if (!isValidJobId(jobId)) return [];
  const dir = path.join(OUTPUT_DIR, jobId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const st = fs.statSync(path.join(dir, f));
      return { file: f, size: st.size, mtime: st.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

// 실행 로그 1건 원문. traversal 방지: basename + 12-hex jobId.
export function readRun(jobId, file) {
  if (!isValidJobId(jobId)) throw new Error('bad job id');
  const safe = path.basename(file);
  if (safe !== file || !safe.endsWith('.md')) throw new Error('bad file');
  const dir = path.join(OUTPUT_DIR, jobId);
  const p = path.join(dir, safe);
  if (!p.startsWith(dir + path.sep)) throw new Error('bad path');
  return fs.readFileSync(p, 'utf8');
}

// auth.json — 비밀은 절대 노출 안 함. 메타만.
export function maskedAuth() {
  let j;
  try { j = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8')); } catch (e) { return { error: String(e.message || e) }; }
  const pool = j.credential_pool || {};
  const out = {};
  for (const [prov, list] of Object.entries(pool)) {
    out[prov] = (Array.isArray(list) ? list : []).map((c) => ({
      id: c.id || null,
      label: c.label || null,
      auth_type: c.auth_type || null,
      priority: c.priority ?? null,
      source: c.source || null,
      base_url: c.base_url || null,
      last_status: c.last_status ?? null,
      last_status_at: c.last_status_at ?? null,
      request_count: c.request_count ?? null,
      fingerprint: c.secret_fingerprint || null,
      has_secret: !!(c.access_token || c.api_key || c.refresh_token || c.secret_fingerprint),
    }));
  }
  return { active_provider: j.active_provider || null, updated_at: j.updated_at || null, pool: out };
}

// 게이트웨이 상태 — gateway_state.json 우선 + pid 생존 확인.
export function gatewayStatus() {
  let state = null;
  try { state = JSON.parse(fs.readFileSync(GATEWAY_STATE, 'utf8')); } catch { /* noop */ }
  const pid = state && typeof state.pid === 'number' ? state.pid : null;
  let alive = false;
  if (pid) {
    try { process.kill(pid, 0); alive = true; } catch (e) { alive = e.code === 'EPERM'; }
  }
  const declaredRunning = state && state.gateway_state === 'running';
  const platforms = {};
  if (state && state.platforms) {
    for (const [p, v] of Object.entries(state.platforms)) platforms[p] = v && v.state ? v.state : 'unknown';
  }
  return {
    pid,
    running: !!(alive && declaredRunning),
    alive,
    declared: state ? state.gateway_state : null,
    activeAgents: state ? (state.active_agents ?? 0) : 0,
    platforms,
    updatedAt: state ? state.updated_at : null,
  };
}

// ---------- config set 화이트리스트(시크릿 키 차단) ----------
export const CONFIG_SET_WHITELIST = new Set([
  'model.default', 'model.provider', 'model.base_url',
  'agent.reasoning_effort', 'agent.max_turns', 'agent.verbose',
  'approvals.mode', 'approvals.cron_mode',
  'terminal.backend', 'display.interface', 'display.streaming',
  'max_concurrent_sessions',
]);
export function configKeyAllowed(key) {
  if (typeof key !== 'string') return false;
  if (SECRET_RE.test(key)) return false; // 이중 안전망
  if (/_API_KEY$|_TOKEN$/i.test(key)) return false; // .env로 새는 키 차단
  return CONFIG_SET_WHITELIST.has(key);
}
