/* hermes-admin 프런트 — 의존성 0. /api/* 호출은 x-admin-token 헤더로 인증. */
'use strict';

// ---------- 토큰 ----------
const TOKEN = (() => {
  const u = new URL(location.href);
  const t = u.searchParams.get('t');
  if (t) { sessionStorage.setItem('hadm_t', t); history.replaceState(null, '', '/' + (location.hash || '')); }
  return sessionStorage.getItem('hadm_t') || '';
})();

const view = document.getElementById('view');
const drawer = document.getElementById('drawer');
const drawerPanel = document.getElementById('drawerPanel');
const tabs = document.getElementById('tabs');
const themeBtn = document.getElementById('themeBtn');
const toastEl = document.getElementById('toast');

let CRONS = [];   // 최근 jobs 캐시
let CUR = null;   // 드로어에 열린 현재 job

// ---------- 공통 ----------
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function loading() { return '<p class="section-note">불러오는 중…</p>'; }
function pad(n) { return String(n).padStart(2, '0'); }
function fmtLocal(d) { return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtNum(n) { return n == null ? '—' : Number(n).toLocaleString(); }
function fmtDur(sec) { sec = Math.round(sec); if (sec < 60) return sec + 's'; const m = Math.floor(sec / 60), s = sec % 60; if (m < 60) return `${m}m ${s}s`; const h = Math.floor(m / 60); return `${h}h ${m % 60}m`; }
function get(o, dotted) { return dotted.split('.').reduce((a, k) => (a && a[k] != null) ? a[k] : undefined, o); }
function curTab() { const b = document.querySelector('#tabs button.on'); return b ? b.dataset.tab : 'overview'; }
function nameFor(id) { const j = CRONS.find((x) => x.id === id); return j ? j.name : (id || '—'); }

let toastT;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600); }

async function api(path, opts = {}) {
  const headers = { 'x-admin-token': TOKEN };
  if (opts.body) headers['Content-Type'] = 'application/json';
  let r;
  try { r = await fetch('/api' + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } }); }
  catch (e) { toast('서버 연결 실패'); return { ok: false, status: 0, data: { error: String(e) } }; }
  let data = null; try { data = await r.json(); } catch { /* noop */ }
  if (r.status === 401) { view.innerHTML = authError(); }
  return { ok: r.ok, status: r.status, data: data || {} };
}
function authError() { return `<div class="adm-h"><h2>인증 필요</h2></div><p class="section-note">서버 콘솔에 출력된 링크(<code>?t=…</code>)로 다시 여세요. 토큰이 없거나 일치하지 않습니다.</p>`; }

function cliFailed(data) { return data && data.cli && data.cli.code !== 0; }
function cliMsg(data) { const c = data && data.cli; if (!c) return (data && data.error) || ''; return (c.stderr || c.stdout || c.error || '').trim(); }
function showCli(data) {
  const slot = document.getElementById('cliSlot'); if (!slot) return;
  let msg = '', err = false;
  if (data && data.cli) { msg = (data.cli.stdout || data.cli.stderr || data.cli.error || ('exit ' + data.cli.code)).trim(); err = data.cli.code !== 0; }
  else if (data && data.error) { msg = data.error; err = true; }
  slot.innerHTML = msg ? `<div class="cli-out ${err ? 'err' : ''}"><div class="adm-pre">${esc(msg)}</div></div>` : '';
}

// ---------- 테마 ----------
function applyTheme(t) {
  if (t === 'dark') document.documentElement.dataset.theme = 'dark';
  else document.documentElement.removeAttribute('data-theme');
  themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('hadm_theme', t);
}
themeBtn.onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
applyTheme(localStorage.getItem('hadm_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

// ---------- 라우팅 ----------
tabs.onclick = (e) => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab); };
function setTab(name) {
  [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
  render(name);
}
function render(name) {
  if (name === 'crons') return renderCrons();
  if (name === 'config') return renderConfig();
  if (name === 'runs') return renderRuns();
  if (name === 'auth') return renderAuth();
  return renderOverview();
}

// ---------- 드로어 ----------
function openDrawer(html) { drawerPanel.innerHTML = html; drawer.hidden = false; }
function closeDrawer() { drawer.hidden = true; CUR = null; }
drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDrawer(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) closeDrawer(); });

// ============================================================
// 개요
// ============================================================
async function renderOverview() {
  view.innerHTML = loading();
  const { data } = await api('/overview');
  if (!data || data.error) return;
  const gw = data.gateway || {};
  const t = data.today || { runs: 0, ok: 0, err: 0, cost: 0 };
  const on = data.automation !== 'off';
  view.innerHTML = `
    <div class="adm-h"><h2>개요</h2><span class="note">실시간 상태</span></div>
    <div class="adm-automation ${on ? 'on' : 'off'}">
      <div><div class="k">자동 실행 ${on ? 'ON' : 'OFF'}</div>
        <div class="s">${on ? '예약된 크론이 일정대로 자동 실행됩니다.' : '모든 크론을 일시정지함 — 자동 실행 안 함. 켜면 껐을 때 멈춘 작업만 복원.'}</div></div>
      <label class="sw" id="autoSw" title="자동 실행 켜기/끄기"><input type="checkbox" ${on ? 'checked' : ''}><span class="track"><span class="knob"></span></span></label>
    </div>
    <div class="adm-stats">
      <div class="adm-stat"><div class="k">게이트웨이</div>
        <div class="v sm"><span class="dot ${gw.running ? 'on' : 'off'}"></span>${gw.running ? '동작 중' : '중지됨'}</div>
        <div class="s">${gw.running ? `PID ${gw.pid} · 실행 에이전트 ${gw.activeAgents}` : 'cron이 자동 실행되지 않습니다'}</div></div>
      <div class="adm-stat"><div class="k">모델</div><div class="v sm">${esc(data.model || '—')}</div><div class="s">provider · ${esc(data.provider || '—')}</div></div>
      <div class="adm-stat"><div class="k">크론 작업</div><div class="v">${data.counts.total}</div><div class="s">활성 ${data.counts.enabled} · 일시정지 ${data.counts.paused}</div></div>
      <div class="adm-stat"><div class="k">다음 실행</div><div class="v sm">${data.next ? esc(data.next.rel) : '—'}</div><div class="s">${data.next ? esc(data.next.name) + ' · ' + esc(data.next.at) : '예정 없음'}</div></div>
      <div class="adm-stat"><div class="k">오늘 실행</div><div class="v">${t.runs}</div><div class="s">성공 ${t.ok} · 실패 ${t.err} · $${(t.cost || 0).toFixed(3)}</div></div>
    </div>
    <p class="section-note" style="margin-top:18px">플랫폼 — ${platformLine(gw.platforms)}</p>`;
  document.getElementById('autoSw').onchange = (e) => toggleAutomation(e.target.checked);
}
async function toggleAutomation(on) {
  const sw = document.getElementById('autoSw'); const input = sw.querySelector('input');
  input.disabled = true; toast(on ? '켜는 중…' : '끄는 중… (작업 일시정지)');
  const { data } = await api('/automation', { method: 'POST', body: JSON.stringify({ on }) });
  if (data.jobs) CRONS = data.jobs;
  if (data.log && data.log.length) toast('일부 실패: ' + data.log[0]);
  else toast(on ? '자동 실행 ON' : '자동 실행 OFF');
  renderOverview();
}
function platformLine(p) { if (!p || !Object.keys(p).length) return '—'; return Object.entries(p).map(([k, v]) => `${esc(k)}: <b>${esc(v)}</b>`).join(' · '); }

// ============================================================
// 크론 작업
// ============================================================
async function renderCrons() {
  view.innerHTML = loading();
  const { data } = await api('/crons');
  if (!data || !data.jobs) return;
  CRONS = data.jobs;
  view.innerHTML = `
    <div class="adm-h"><h2>크론 작업</h2><span class="note">jobs.json · ${CRONS.length}개</span></div>
    <div class="adm-actions"><button class="btn accent sm" id="newCron">+ 새 작업</button>
      <span class="spacer"></span><button class="btn ghost sm" id="refreshCrons">새로고침</button></div>
    <table class="adm-table"><thead><tr>
      <th>이름</th><th>스케줄</th><th>다음 실행</th><th>마지막 실행</th><th>상태</th><th>활성</th></tr></thead>
      <tbody id="cronBody">${CRONS.map(cronRow).join('')}</tbody></table>`;
  document.getElementById('newCron').onclick = openCreate;
  document.getElementById('refreshCrons').onclick = renderCrons;
  document.getElementById('cronBody').onclick = onCronBodyClick;
}
function statusPill(j) {
  if (j.last_status == null) return '<span class="pill idle">미실행</span>';
  if (j.last_status === 'ok') return '<span class="pill ok">정상</span>';
  return '<span class="pill err">오류</span>';
}
function cronRow(j) {
  return `<tr class="click" data-id="${j.id}">
    <td><div class="adm-name">${esc(j.name || j.id)}</div><div class="muted2 mono">${esc(j.id)}${j.no_agent ? ' · script' : ''}</div></td>
    <td>${esc(j.scheduleHuman || '')}<div class="muted2 mono">${esc((j.schedule && j.schedule.expr) || '')}</div></td>
    <td>${j.enabled ? esc(j.nextRel) : '<span class="muted2">—</span>'}<div class="muted2">${j.enabled ? esc(j.nextAt) : '일시정지'}</div></td>
    <td>${esc(j.lastAt)}<div class="muted2">${esc(j.lastRel)}</div></td>
    <td>${statusPill(j)}</td>
    <td><label class="sw" data-toggle="${j.id}" title="${j.enabled ? '일시정지' : '재개'}"><input type="checkbox" ${j.enabled ? 'checked' : ''}><span class="track"><span class="knob"></span></span></label></td>
  </tr>`;
}
function onCronBodyClick(e) {
  const sw = e.target.closest('label.sw');
  if (sw) { e.preventDefault(); toggleCron(sw.dataset.toggle); return; }
  const row = e.target.closest('tr[data-id]');
  if (row) openDetail(row.dataset.id);
}
function refreshCronTable(jobs) { CRONS = jobs; const body = document.getElementById('cronBody'); if (body) body.innerHTML = jobs.map(cronRow).join(''); }
async function toggleCron(id) {
  const j = CRONS.find((x) => x.id === id); if (!j) return;
  const act = j.enabled ? 'pause' : 'resume';
  const { data } = await api(`/crons/${id}/${act}`, { method: 'POST' });
  if (cliFailed(data)) { toast(cliMsg(data) || '실패'); return; }
  refreshCronTable(data.jobs);
  toast(act === 'pause' ? '일시정지했습니다' : '재개했습니다');
}

async function openDetail(id) {
  openDrawer(loading());
  const { ok, data } = await api(`/crons/${id}`);
  if (!ok) { drawerPanel.innerHTML = `<button class="adm-x" data-close>×</button><p class="section-note">${esc(data.error || '불러오기 실패')}</p>`; return; }
  CUR = data.job;
  renderDetail(data.job, data.runs || []);
}
function renderDetail(j, runs) {
  drawerPanel.innerHTML = `
    <button class="adm-x" data-close>×</button>
    <h3>${esc(j.name || j.id)}</h3>
    <div class="muted2 mono">${esc(j.id)}</div>
    <dl class="kv">
      <dt>스케줄</dt><dd>${esc(j.scheduleHuman)} <span class="muted2 mono">${esc((j.schedule && j.schedule.expr) || '')}</span></dd>
      <dt>다음 실행</dt><dd>${j.enabled ? esc(j.nextAt) + ' (' + esc(j.nextRel) + ')' : '<span class="pill paused">일시정지</span>'}</dd>
      <dt>마지막 실행</dt><dd>${esc(j.lastAt)} · ${statusPill(j)}${j.last_error ? '<div class="muted2">' + esc(j.last_error) + '</div>' : ''}</dd>
      <dt>실행 횟수</dt><dd>${j.runCount}</dd>
      <dt>전달</dt><dd>${esc(j.deliver || '—')}</dd>
      <dt>작업폴더</dt><dd class="mono">${esc(j.workdir || '—')}</dd>
      <dt>모델</dt><dd>${esc(j.model || '(기본)')}${j.provider ? ' · ' + esc(j.provider) : ''}</dd>
      <dt>스킬</dt><dd>${(j.skills && j.skills.length) ? j.skills.map((s) => '<code>' + esc(s) + '</code>').join(' ') : '—'}</dd>
      <dt>스크립트</dt><dd class="mono">${esc(j.script || '—')}${j.no_agent ? ' · <span class="pill idle">no-agent</span>' : ''}</dd>
    </dl>
    ${j.prompt ? `<div class="muted2" style="font-weight:800;font-size:12.5px;margin-top:8px">프롬프트</div><div class="adm-pre">${esc(j.prompt)}</div>` : ''}
    <div class="adm-actions">
      <button class="btn accent sm" data-act="run">지금 실행</button>
      <button class="btn primary sm" data-act="edit">수정</button>
      <button class="btn ghost sm" data-act="toggle">${j.enabled ? '일시정지' : '재개'}</button>
      <span class="spacer"></span>
      <button class="btn danger sm" data-act="delete">삭제</button>
    </div>
    <div id="cliSlot"></div>
    <div class="adm-h" style="margin:22px 0 8px"><h2 style="font-size:16px">실행 기록</h2><span class="note">${runs.length}건</span></div>
    <ul class="adm-runs">${runs.length ? runs.map((r) => runItem(r)).join('') : '<li class="muted2" style="cursor:default">기록 없음</li>'}</ul>
    <div id="runSlot"></div>`;
  drawerPanel.querySelector('.adm-actions').onclick = (e) => { const b = e.target.closest('[data-act]'); if (b) detailAction(b.dataset.act); };
  const ul = drawerPanel.querySelector('.adm-runs');
  ul.onclick = (e) => { const li = e.target.closest('li[data-file]'); if (li) loadRun(j.id, li.dataset.file); };
}
function runItem(r) {
  const d = new Date(r.mtime);
  return `<li data-file="${esc(r.file)}"><span>${esc(r.file.replace(/\.md$/, ''))}</span><span class="muted2">${fmtLocal(d)} · ${(r.size / 1024).toFixed(1)}KB</span></li>`;
}
async function loadRun(id, file) {
  const slot = document.getElementById('runSlot'); slot.innerHTML = loading();
  const { ok, data } = await api(`/crons/${id}/runs/${encodeURIComponent(file)}`);
  if (!ok) { slot.innerHTML = `<div class="cli-out err"><div class="adm-pre">${esc((data && data.error) || '읽기 실패')}</div></div>`; return; }
  slot.innerHTML = `<div class="adm-h" style="margin:14px 0 6px"><h2 style="font-size:15px">${esc(file)}</h2><span class="note"><a href="#" data-close-run>닫기</a></span></div><div class="adm-pre">${esc(data.content)}</div>`;
  slot.querySelector('[data-close-run]').onclick = (e) => { e.preventDefault(); slot.innerHTML = ''; };
}
async function detailAction(act) {
  if (!CUR) return; const id = CUR.id;
  if (act === 'run') {
    if (!confirm('지금 실행할까요?\n게이트웨이가 다음 tick에 실제로 실행합니다.\n에이전트 작업은 비용이 발생할 수 있습니다.')) return;
    const { data } = await api(`/crons/${id}/run`, { method: 'POST' });
    showCli(data); toast(cliFailed(data) ? '실행 요청 실패' : '실행을 요청했습니다');
    return;
  }
  if (act === 'toggle') {
    const a = CUR.enabled ? 'pause' : 'resume';
    const { data } = await api(`/crons/${id}/${a}`, { method: 'POST' });
    if (cliFailed(data)) { showCli(data); return; }
    CRONS = data.jobs; toast(a === 'pause' ? '일시정지' : '재개'); openDetail(id);
    return;
  }
  if (act === 'delete') {
    if (!confirm('이 작업을 삭제할까요? 되돌릴 수 없습니다.')) return;
    const { data } = await api(`/crons/${id}`, { method: 'DELETE' });
    if (cliFailed(data)) { showCli(data); return; }
    CRONS = data.jobs; closeDrawer(); toast('삭제했습니다'); if (curTab() === 'crons') renderCrons();
    return;
  }
  if (act === 'edit') renderEdit(CUR);
}

function field(label, name, type, val, hint) {
  const input = type === 'textarea'
    ? `<textarea name="${name}" rows="5">${esc(val)}</textarea>`
    : `<input name="${name}" type="${type === 'number' ? 'number' : 'text'}" value="${esc(val)}">`;
  return `<div class="field"><label>${esc(label)}</label>${input}${hint ? `<div class="muted2" style="font-size:12.5px;margin-top:4px">${esc(hint)}</div>` : ''}</div>`;
}
function renderEdit(j) {
  const isAgent = !j.no_agent;
  drawerPanel.innerHTML = `
    <button class="adm-x" data-close>×</button>
    <h3>작업 수정</h3><div class="muted2 mono">${esc(j.id)}</div>
    <div class="adm-form">
      ${field('이름', 'name', 'text', j.name || '')}
      ${field('스케줄', 'schedule', 'text', (j.schedule && j.schedule.expr) || '', '예: 30 21 * * *  ·  30m  ·  every 2h')}
      <div class="row2">${field('전달', 'deliver', 'text', j.deliver || '')}${field('반복(횟수)', 'repeat', 'number', (j.repeat && j.repeat.times != null) ? j.repeat.times : '')}</div>
      ${field('작업폴더', 'workdir', 'text', j.workdir || '')}
      ${isAgent ? field('프롬프트', 'prompt', 'textarea', j.prompt || '') : ''}
      ${isAgent ? field('스킬(쉼표구분)', 'skills', 'text', (j.skills || []).join(', ')) : ''}
      ${isAgent ? `<div class="row2">${field('모델', 'model', 'text', j.model || '')}${field('Provider', 'provider', 'text', j.provider || '')}</div>` : ''}
      ${!isAgent ? field('스크립트', 'script', 'text', j.script || '') : ''}
    </div>
    <div class="adm-actions"><button class="btn accent sm" id="saveEdit">저장</button><button class="btn ghost sm" id="cancelEdit">취소</button></div>
    <div id="cliSlot"></div>`;
  document.getElementById('cancelEdit').onclick = () => openDetail(j.id);
  document.getElementById('saveEdit').onclick = () => saveEdit(j);
}
async function saveEdit(j) {
  const v = (n) => { const el = drawerPanel.querySelector(`[name="${n}"]`); return el ? el.value : undefined; };
  const body = { name: v('name'), schedule: v('schedule'), deliver: v('deliver'), workdir: v('workdir') };
  const rep = v('repeat'); if (rep !== '' && rep != null) body.repeat = rep;
  if (!j.no_agent) {
    body.prompt = v('prompt');
    const sk = v('skills'); body.skills = sk ? sk.split(',').map((s) => s.trim()).filter(Boolean) : [];
    if (v('model')) body.model = v('model');
    if (v('provider')) body.provider = v('provider');
  } else if (v('script') != null) { body.script = v('script'); }
  const { data } = await api(`/crons/${j.id}`, { method: 'PATCH', body: JSON.stringify(body) });
  if (cliFailed(data)) { showCli(data); toast('수정 실패'); return; }
  CRONS = data.jobs; toast('수정했습니다'); openDetail(j.id); if (curTab() === 'crons') refreshCronTable(data.jobs);
}

function openCreate() {
  openDrawer(`
    <button class="adm-x" data-close>×</button>
    <h3>새 크론 작업</h3>
    <div class="adm-form">
      <div class="field"><label>유형</label>
        <select name="ctype" id="ctype"><option value="agent">에이전트 (프롬프트/스킬)</option><option value="script">스크립트 (no-agent)</option></select></div>
      ${field('스케줄', 'schedule', 'text', '', '예: 30 21 * * *  ·  30m  ·  every 2h')}
      ${field('이름', 'name', 'text', '')}
      <div class="row2">${field('전달', 'deliver', 'text', 'discord')}${field('작업폴더', 'workdir', 'text', 'E:\\workspace\\side_project\\aztomz')}</div>
      <div id="agentFields">
        ${field('프롬프트', 'prompt', 'textarea', '')}
        ${field('스킬(쉼표구분)', 'skills', 'text', '')}
        <div class="row2">${field('모델', 'model', 'text', '')}${field('Provider', 'provider', 'text', '')}</div>
      </div>
      <div id="scriptFields" hidden>${field('스크립트 파일', 'script', 'text', '', '~/.hermes/scripts/ 아래 상대경로')}</div>
    </div>
    <div class="adm-actions"><button class="btn accent sm" id="createBtn">만들기</button><button class="btn ghost sm" data-close>취소</button></div>
    <div id="cliSlot"></div>`);
  const sel = document.getElementById('ctype');
  sel.onchange = () => { const a = sel.value === 'agent'; document.getElementById('agentFields').hidden = !a; document.getElementById('scriptFields').hidden = a; };
  document.getElementById('createBtn').onclick = submitCreate;
}
async function submitCreate() {
  const v = (n) => { const el = drawerPanel.querySelector(`[name="${n}"]`); return el ? el.value.trim() : ''; };
  const type = document.getElementById('ctype').value;
  const body = { schedule: v('schedule'), name: v('name'), deliver: v('deliver'), workdir: v('workdir') };
  if (type === 'agent') {
    body.prompt = v('prompt');
    const sk = v('skills'); if (sk) body.skills = sk.split(',').map((s) => s.trim()).filter(Boolean);
    if (v('model')) body.model = v('model');
    if (v('provider')) body.provider = v('provider');
  } else { body.no_agent = true; body.script = v('script'); }
  const { data, status } = await api('/crons', { method: 'POST', body: JSON.stringify(body) });
  if (status === 400) { showCli(data); toast(data.error || '입력 오류'); return; }
  if (cliFailed(data)) { showCli(data); toast('생성 실패'); return; }
  CRONS = data.jobs; closeDrawer(); toast('작업을 만들었습니다'); renderCrons();
}

// ============================================================
// 설정
// ============================================================
async function renderConfig() {
  view.innerHTML = loading();
  const { data } = await api('/config');
  if (!data.config) {
    view.innerHTML = `<div class="adm-h"><h2>설정</h2></div><p class="section-note">파싱 실패 — 원문 표시:</p><div class="adm-pre">${esc(data.showText || '')}</div>`;
    return;
  }
  const c = data.config;
  view.innerHTML = `
    <div class="adm-h"><h2>설정</h2><span class="note">config.yaml</span></div>
    <p class="section-note">아래 주요 키만 수정할 수 있습니다. 시크릿(키·토큰)은 표시·수정되지 않습니다.</p>
    <table class="adm-table"><tbody>
      ${cfgRow('기본 모델', 'model.default', get(c, 'model.default'), 'text')}
      ${cfgRow('Provider', 'model.provider', get(c, 'model.provider'), 'select', ['gemini', 'anthropic', 'openrouter', 'copilot'])}
      ${cfgRow('추론 강도', 'agent.reasoning_effort', get(c, 'agent.reasoning_effort'), 'select', ['low', 'medium', 'high'])}
      ${cfgRow('최대 턴', 'agent.max_turns', get(c, 'agent.max_turns'), 'number')}
      ${cfgRow('승인 모드', 'approvals.mode', get(c, 'approvals.mode'), 'select', ['manual', 'auto'])}
      ${cfgRow('cron 승인', 'approvals.cron_mode', get(c, 'approvals.cron_mode'), 'select', ['deny', 'allow', 'auto'])}
    </tbody></table>
    <div class="adm-h" style="margin-top:24px"><h2 style="font-size:16px">전체 설정 (읽기전용)</h2></div>
    <div class="adm-pre">${esc(JSON.stringify(c, null, 2))}</div>`;
  view.querySelector('.adm-table').onclick = onCfgClick;
}
function cfgRow(label, key, val, type, opts) {
  let ctrl;
  if (type === 'select') ctrl = `<select data-key="${key}">${opts.map((o) => `<option ${String(val) === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  else ctrl = `<input data-key="${key}" type="${type === 'number' ? 'number' : 'text'}" value="${esc(val == null ? '' : val)}">`;
  return `<tr><td class="adm-name" style="width:170px">${esc(label)}<div class="muted2 mono">${key}</div></td>
    <td><div class="inline-edit">${ctrl}<button class="btn ghost sm" data-save="${key}">저장</button></div></td></tr>`;
}
async function onCfgClick(e) {
  const b = e.target.closest('[data-save]'); if (!b) return;
  const key = b.dataset.save;
  const ctrl = b.parentElement.querySelector('[data-key]');
  const value = ctrl.value;
  const { data, status } = await api('/config', { method: 'PATCH', body: JSON.stringify({ key, value }) });
  if (status === 403 || status === 400) { toast(data.error || '거부됨'); return; }
  if (cliFailed(data)) { toast(cliMsg(data) || '실패'); return; }
  toast(`저장: ${key} = ${value}`);
}

// ============================================================
// 실행 기록
// ============================================================
async function ensureCrons() { if (!CRONS.length) { try { const { data } = await api('/crons'); CRONS = data.jobs || []; } catch { /* noop */ } } }
async function renderRuns() {
  view.innerHTML = loading();
  await ensureCrons();
  const { data } = await api('/runs');
  const s = data.sessions;
  if (!Array.isArray(s)) {
    view.innerHTML = `<div class="adm-h"><h2>실행 기록 · 비용</h2></div><p class="section-note">state.db 읽기 실패: ${esc((s && s.error) || '')}</p>`;
    return;
  }
  const total = s.reduce((a, x) => a + (x.estimated_cost_usd || 0), 0);
  view.innerHTML = `
    <div class="adm-h"><h2>실행 기록 · 비용</h2><span class="note">최근 ${s.length}건 · 합계 $${total.toFixed(3)}</span></div>
    <p class="section-note">state.db의 cron 세션(토큰·예상비용). 작업별 상세 로그는 ‘크론 작업’ 상세에서 볼 수 있습니다.</p>
    <table class="adm-table"><thead><tr><th>시각</th><th>작업</th><th>모델</th><th class="num">토큰(in/out)</th><th class="num">예상비용</th><th>상태</th><th class="num">소요</th></tr></thead>
    <tbody>${s.map(sessRow).join('') || '<tr><td colspan="7" class="muted2">cron 세션 없음</td></tr>'}</tbody></table>`;
}
function sessRow(x) {
  const start = x.started_at ? new Date(x.started_at * 1000) : null;
  const dur = (x.started_at && x.ended_at) ? (x.ended_at - x.started_at) : null;
  return `<tr>
    <td>${start ? fmtLocal(start) : '—'}<div class="muted2">${esc(x.title || '')}</div></td>
    <td>${esc(nameFor(x.jobId))}</td>
    <td>${esc(x.model || '—')}</td>
    <td class="num">${fmtNum(x.input_tokens)}/${fmtNum(x.output_tokens)}</td>
    <td class="num">${x.estimated_cost_usd != null ? '$' + x.estimated_cost_usd.toFixed(4) : '—'}</td>
    <td>${endPill(x.end_reason)}</td>
    <td class="num">${dur != null ? fmtDur(dur) : '—'}</td>
  </tr>`;
}
function endPill(r) {
  if (!r) return '<span class="pill idle">—</span>';
  if (/complete|^ok$|done/i.test(r)) return '<span class="pill ok">완료</span>';
  if (/error|timeout|fail|interrupt/i.test(r)) return `<span class="pill err">${esc(r)}</span>`;
  return `<span class="pill idle">${esc(r)}</span>`;
}

// ============================================================
// 인증
// ============================================================
async function renderAuth() {
  view.innerHTML = loading();
  const { data } = await api('/auth');
  if (data.error) { view.innerHTML = `<div class="adm-h"><h2>인증 · Provider</h2></div><p class="section-note">읽기 실패: ${esc(data.error)}</p>`; return; }
  const rows = [];
  for (const [prov, list] of Object.entries(data.pool || {})) for (const c of list) rows.push(authRow(prov, c, data.active_provider));
  view.innerHTML = `
    <div class="adm-h"><h2>인증 · Provider</h2><span class="note">활성: ${esc(data.active_provider || '—')}</span></div>
    <p class="section-note">자격증명 메타만 표시합니다. 키·토큰은 서버에서 절대 전송하지 않습니다(읽기전용).</p>
    <table class="adm-table"><thead><tr><th>Provider</th><th>라벨</th><th>타입</th><th>상태</th><th>지문</th><th>소스</th></tr></thead>
    <tbody>${rows.join('') || '<tr><td colspan="6" class="muted2">자격증명 없음</td></tr>'}</tbody></table>`;
}
function shortFp(f) { if (!f) return '—'; return f.length > 20 ? f.slice(0, 18) + '…' : f; }
function authRow(prov, c, active) {
  return `<tr>
    <td class="adm-name">${esc(prov)}${prov === active ? ' <span class="pill ok">활성</span>' : ''}</td>
    <td>${esc(c.label || '—')}</td>
    <td>${esc(c.auth_type || '—')}</td>
    <td>${c.last_status ? esc(c.last_status) : '<span class="muted2">—</span>'}</td>
    <td class="mono">${esc(shortFp(c.fingerprint))}</td>
    <td class="mono">${esc(c.source || '—')}</td>
  </tr>`;
}

// ---------- 시작 ----------
const initial = (location.hash || '#overview').slice(1);
setTab(['overview', 'crons', 'config', 'runs', 'auth'].includes(initial) ? initial : 'overview');
