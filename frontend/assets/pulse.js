/* ============================================================
   한끗 · 트렌드 펄스 — 페이지 로직 (정적, 백엔드 0)
   데이터: window.PULSE_DATA (data/pulse.js). 헬퍼: 기존 H.* 재사용.
   라이브 AI(창업아이템·경쟁사·기획서매칭)는 범위 외 → 비활성 data-future 자리표시.
   ============================================================ */
(function (global) {
  'use strict';
  const H = global.H || (global.H = {});
  const D = global.PULSE_DATA || { generatedAt: null, trends: [], daily: [] };

  const CATS = ['전체', '테크', 'K뷰티', '헬스', '푸드', '금융', '교육', '패션', '엔터', '라이프', '등산', '관광'];
  // 플랫폼 글리프(기능 표식 — 타이포 커버의 '이모지 금지' 규칙과 무관)
  const PI = { Google: '🔍', YouTube: '▶️', Instagram: '📷', TikTok: '🎵', X: '𝕏' };
  const LS_KEY = 'hangeut.pulseIdeas';
  const IDEA_CAP = 80;

  /* ---------- 점수 → tier/라벨 (한끗 토큰 기반) ---------- */
  function tierOf(total) {
    const t = (typeof total === 'number') ? total : 8;
    if (t >= 10) return { tier: 'peak', label: '즉시 실행', mark: '▲ ' };
    if (t >= 8) return { tier: 'good', label: '유망', mark: '' };
    if (t >= 6) return { tier: 'mid', label: '관찰', mark: '' };
    return { tier: 'warn', label: '보류', mark: '' };
  }

  /* ---------- 스파크라인: SVG 문자열, stroke=currentColor (다크 대응) ---------- */
  function spark(data, w, h) {
    w = w || 90; h = h || 30;
    if (!Array.isArray(data) || data.length < 2) return '';
    const mx = Math.max.apply(null, data), mn = Math.min.apply(null, data), r = (mx - mn) || 1;
    const pts = data.map((v, i) => ((i / (data.length - 1)) * w).toFixed(1) + ',' + (h - ((v - mn) / r) * (h - 4) - 2).toFixed(1)).join(' ');
    return `<svg class="tp-spark-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">` +
      `<polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function platformsHTML(pl) {
    return (pl || []).map((p) => `<span class="tp-pi" title="${H.esc(p)}">${PI[p] || H.esc(p)}</span>`).join('');
  }

  /* ---------- 트렌드 카드 ---------- */
  H.pulse = H.pulse || {};
  H.pulse.card = function (t, opts) {
    opts = opts || {};
    const tt = tierOf(t.total);
    const badge = opts.today
      ? `<span class="tp-badge today">오늘</span>`
      : `<span class="tp-badge ${tt.tier}">${tt.mark}${tt.label}</span>`;
    return `<article class="tp-card" data-id="${H.esc(t.id)}">
      <div class="tp-card-head">
        <div class="tp-card-main">
          <div class="tp-row1"><h3 class="tp-kw">${H.esc(t.kw)}</h3>${badge}</div>
          <div class="tp-meta">
            <span class="tp-cat">${H.esc(t.cat)}</span>
            <span class="tp-pl">${platformsHTML(t.pl)}</span>
            <span class="tp-gr">+${H.esc(t.gr)}%</span>
            ${opts.today && t.date ? H.freshChip(t.date) : ''}
          </div>
          <p class="tp-why">${H.esc(t.why)}</p>
        </div>
        <div class="tp-spark ${tt.tier}">${spark(t.sp)}</div>
      </div>
      ${t.angle ? `<div class="tp-angle">💡 ${H.esc(t.angle)}</div>` : ''}
      <div class="tp-actions" hidden>
        <button class="tp-quick" data-quick="${H.esc(t.id)}">빠른 아이디어 3개</button>
        <button class="tp-future" data-future disabled title="라이브 AI는 추후 제공됩니다">AI 상세 창업 아이템 (준비 중)</button>
      </div>
    </article>`;
  };

  /* ---------- 상태 ---------- */
  const S = { cat: '전체', q: '', view: 'radar' };

  /* ---------- 필터/검색/정렬 ---------- */
  function filtered() {
    const q = S.q.trim().toLowerCase();
    return D.trends
      .filter((t) => (S.cat === '전체' || t.cat === S.cat) &&
        (!q || t.kw.toLowerCase().includes(q) || (t.why || '').toLowerCase().includes(q) || (t.angle || '').toLowerCase().includes(q)))
      .sort((a, b) => b.gr - a.gr);
  }

  function renderList() {
    const list = filtered();
    H.q('#tpList').innerHTML = list.map((t) => H.pulse.card(t)).join('');
    H.q('#tpEmpty').hidden = list.length > 0;
    const c = H.q('#tpCount'); if (c) c.textContent = `${list.length}개`;
  }

  function renderFilter() {
    H.q('#tpCatFilter').innerHTML = CATS.map((c) => {
      const n = c === '전체' ? D.trends.length : D.trends.filter((t) => t.cat === c).length;
      return `<button class="cat-chip${c === S.cat ? ' on' : ''}" role="tab" aria-selected="${c === S.cat}" data-cat="${H.esc(c)}">${H.esc(c)} <span class="cc-n">${n}</span></button>`;
    }).join('');
  }

  function renderDaily() {
    const box = H.q('#tpDaily'); if (!box) return;
    const daily = (D.daily || []);
    if (!daily.length) {
      box.innerHTML = `<div class="tp-daily-empty">아직 오늘의 트렌드가 없어요. 매일 자동으로 채워집니다.${D.generatedAt ? ' · ' + H.freshChip(D.generatedAt) : ''}</div>`;
      return;
    }
    box.innerHTML = daily.map((t) => H.pulse.card(t, { today: true })).join('');
  }

  /* ---------- 아이디어 저장(localStorage) ---------- */
  function loadIdeas() { try { return JSON.parse(global.localStorage.getItem(LS_KEY)) || []; } catch (e) { return []; } }
  function saveIdeas(arr) { try { global.localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, IDEA_CAP))); } catch (e) { /* quota/private */ } }

  function makeQuickIdeas(t) {
    const now = new Date().toISOString();
    const base = (t.angle || '').split('또는')[0].trim() || t.angle || t.kw;
    return [
      { id: 'i-' + Date.now(), fromTrend: t.kw, gr: t.gr, text: `💡 ${base}\n\n트렌드: ${t.kw} (+${t.gr}%)\n배경: ${t.why}`, createdAt: now },
      { id: 'i-' + (Date.now() + 1), fromTrend: t.kw, gr: t.gr, text: `💡 ${t.kw} 전문 커뮤니티/미디어 (콘텐츠 비즈니스)\n\n트렌드: ${t.kw} (+${t.gr}%)\n배경: ${t.why}`, createdAt: now },
      { id: 'i-' + (Date.now() + 2), fromTrend: t.kw, gr: t.gr, text: `💡 ${t.kw} 데이터 분석·큐레이션 도구 (SaaS)\n\n트렌드: ${t.kw} (+${t.gr}%)\n배경: ${t.why}`, createdAt: now },
    ];
  }

  function ideaCount() { return loadIdeas().length; }

  /* ---------- 다운로드 (data: URI — 샌드박스 안전) ---------- */
  function download(content, filename, md) {
    const mime = md ? 'text/markdown' : 'text/plain';
    const a = document.createElement('a');
    a.href = `data:${mime};charset=utf-8,` + encodeURIComponent(content);
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  function ideaFile(idea, fmt) {
    const fn = (idea.fromTrend || 'idea').replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const dt = idea.createdAt ? H.fmtDate(idea.createdAt) : '';
    const body = fmt === 'md'
      ? `# 창업 아이디어: ${idea.fromTrend}\n\n> ${dt}\n\n---\n\n${idea.text}\n\n---\n*한끗 · 트렌드 펄스*\n`
      : `[ 창업 아이디어 ] ${idea.fromTrend}\n${dt}\n================================\n\n${idea.text}\n\n================================\n한끗 · 트렌드 펄스\n`;
    download(body, fn + (fmt === 'md' ? '.md' : '.txt'), fmt === 'md');
  }

  /* ---------- 아이디어 뷰 ---------- */
  function renderIdeas() {
    const box = H.q('#tpIdeas'); if (!box) return;
    const ideas = loadIdeas();
    if (!ideas.length) {
      box.innerHTML = `<div class="empty"><div class="e-mark">💡</div><h3>저장한 아이디어가 없어요</h3><p>트렌드 카드를 펼쳐 '빠른 아이디어 3개'를 눌러보세요.</p></div>`;
      return;
    }
    box.innerHTML = ideas.map((idea) => {
      const fl = (idea.text.split('\n')[0] || '').slice(0, 60);
      return `<div class="tp-idea" data-idea="${H.esc(idea.id)}">
        <div class="tp-idea-top"><span class="tp-idea-from">${H.esc(idea.fromTrend)}</span><span class="tp-idea-date">${idea.createdAt ? H.fmtDate(idea.createdAt) : ''}</span></div>
        <div class="tp-idea-line">${H.esc(fl)}</div>
        <div class="tp-idea-actions">
          <button class="tp-idea-dl" data-dl="md" data-id="${H.esc(idea.id)}">.md</button>
          <button class="tp-idea-dl" data-dl="txt" data-id="${H.esc(idea.id)}">.txt</button>
          <button class="tp-idea-del" data-del="${H.esc(idea.id)}">삭제</button>
        </div>
      </div>`;
    }).join('');
  }

  /* ---------- 탭(레이더 / 저장 아이디어) ---------- */
  function renderTabs() {
    const tabs = [{ k: 'radar', l: '트렌드 레이더' }, { k: 'ideas', l: `저장한 아이디어 (${ideaCount()})` }];
    H.q('#tpTabs').innerHTML = tabs.map((t) =>
      `<button class="tp-tab${S.view === t.k ? ' on' : ''}" data-view="${t.k}">${t.l}</button>`).join('');
    H.q('#tpRadar').hidden = S.view !== 'radar';
    H.q('#tpIdeas').hidden = S.view !== 'ideas';
  }

  function setView(v) { S.view = v; renderTabs(); if (v === 'ideas') renderIdeas(); }

  /* ---------- 이벤트 ---------- */
  function wire() {
    // 탭
    H.q('#tpTabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-view]'); if (!b) return; setView(b.dataset.view);
    });
    // 카테고리 칩
    H.q('#tpCatFilter').addEventListener('click', (e) => {
      const b = e.target.closest('.cat-chip'); if (!b || b.dataset.cat === S.cat) return;
      S.cat = b.dataset.cat; renderFilter(); renderList();
    });
    // 검색(디바운스)
    let tmr; H.q('#tpSearch').addEventListener('input', (e) => {
      clearTimeout(tmr); const v = e.target.value;
      tmr = setTimeout(() => { S.q = v; renderList(); }, 120);
    });
    // 레이더 영역 위임: 카드 펼침 + 빠른 아이디어
    H.q('#tpRadar').addEventListener('click', (e) => {
      const quick = e.target.closest('[data-quick]');
      if (quick) {
        e.stopPropagation();
        const id = quick.dataset.quick;
        const t = D.trends.find((x) => String(x.id) === id) || (D.daily || []).find((x) => String(x.id) === id);
        if (!t) return;
        const ideas = makeQuickIdeas(t).concat(loadIdeas());
        saveIdeas(ideas);
        renderTabs();
        H.toast('빠른 아이디어 3개를 저장했어요');
        return;
      }
      if (e.target.closest('[data-future]')) { H.toast('라이브 AI 분석은 곧 제공됩니다'); return; }
      const card = e.target.closest('.tp-card'); if (!card) return;
      const act = H.q('.tp-actions', card); if (act) act.hidden = !act.hidden;
      card.classList.toggle('open');
    });
    // 아이디어 뷰: 다운로드 / 삭제
    H.q('#tpIdeas').addEventListener('click', (e) => {
      const dl = e.target.closest('[data-dl]');
      if (dl) { const idea = loadIdeas().find((i) => i.id === dl.dataset.id); if (idea) ideaFile(idea, dl.dataset.dl); return; }
      const del = e.target.closest('[data-del]');
      if (del) {
        saveIdeas(loadIdeas().filter((i) => i.id !== del.dataset.del));
        renderIdeas(); renderTabs(); H.toast('삭제했어요');
      }
    });
  }

  /* ---------- 발행 라인(데이터 신선도) ---------- */
  H.pulse.feedFreshness = () => H.freshness(global.PULSE_DATA && global.PULSE_DATA.generatedAt);

  /* ---------- init ---------- */
  H.pulse.init = function () {
    const fresh = H.q('#tpFresh');
    if (fresh) {
      const f = H.pulse.feedFreshness();
      fresh.innerHTML = `트렌드 ${D.trends.length}건` +
        (D.generatedAt ? ` · 마지막 갱신 ${H.fmtISO(D.generatedAt)} <span class="fresh-chip ${f.cls}">${f.text}</span>` : '');
    }
    S.view = (H.param('tab') === 'ideas') ? 'ideas' : 'radar';
    renderTabs(); renderFilter(); renderList(); renderDaily();
    if (S.view === 'ideas') renderIdeas();
    wire();
  };

})(window);
