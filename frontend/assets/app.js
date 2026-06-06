/* ============================================================
   한끗 — 공유 스토어 + 헬퍼 (데이터는 data/trends.js 에서 로드)
   회원/세션/저장/리뷰는 localStorage 기반 프로토타입.
   ▶ 실서비스: 이 STORE 레이어만 Supabase로 교체. UI는 H.* 인터페이스만 사용.
   ▶ 신선도: 항상 '오늘'(브라우저 new Date) 대비 analyzedAt 으로 계산해 라이브 표시.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 트렌드 데이터 (data/trends.js) ---------- */
  const _DATA = global.HANGEUT_DATA || { generatedAt:null, trends:[] };
  const TRENDS = _DATA.trends || [];

  /* ---------- 저수준 storage ---------- */
  const LS = global.localStorage;
  const K = { users:'hangeut.users', session:'hangeut.session', saves:'hangeut.saves', reviews:'hangeut.reviews' };
  function read(k, def){ try{ return JSON.parse(LS.getItem(k)) ?? def; }catch(e){ return def; } }
  function write(k, v){ try{ LS.setItem(k, JSON.stringify(v)); }catch(e){} }
  function hash(s){ let h=5381; for(let i=0;i<s.length;i++){ h=((h<<5)+h)+s.charCodeAt(i); h|=0; } return 'h'+(h>>>0).toString(36); }

  /* ---------- 헬퍼 ---------- */
  const H = {};
  H.TRENDS = TRENDS;
  H.generatedAt = _DATA.generatedAt;
  H.trend = (id)=> TRENDS.find(t=>t.id===id) || null;
  H.q  = (s,r)=> (r||document).querySelector(s);
  H.qa = (s,r)=> [...(r||document).querySelectorAll(s)];
  H.esc = (s)=> String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  H.bandTxt = (v)=> v<=20?'낮음':v<=40?'약간':v<=60?'보통':v<=80?'높음':'매우 높음';
  H.fmtDate = (ts)=>{ const d=new Date(ts); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())}`; };
  H.param = (k)=> new URLSearchParams(global.location.search).get(k);

  /* ---------- 오늘 / 신선도 (라이브) ---------- */
  H.todayStr = ()=>{ const d=new Date(); const p=x=>String(x).padStart(2,'0'); return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())}`; };
  H.fmtISO = (iso)=> iso ? String(iso).replace(/-/g,'.') : '';
  H.daysSince = (iso)=>{ if(!iso) return null; const a=new Date(iso+'T00:00:00'); const b=new Date(); if(isNaN(a)) return null; a.setHours(0,0,0,0); b.setHours(0,0,0,0); return Math.round((b-a)/86400000); };
  H.freshness = (iso)=>{ const n=H.daysSince(iso);
    if(n==null) return {n:null,text:'',cls:'ok'};
    if(n<=0)   return {n,text:'오늘 분석',cls:'fresh'};
    if(n<=3)   return {n,text:`${n}일 전`,cls:'fresh'};
    if(n<14)   return {n,text:`${n}일 전`,cls:'ok'};
    return {n,text:`${n}일 전 · 갱신 필요`,cls:'stale'};
  };
  H.freshChip = (iso)=>{ const f=H.freshness(iso); return f.text ? `<span class="fresh-chip ${f.cls}">${f.text}</span>` : ''; };
  // 데이터 묶음 신선도(홈 발행라인용)
  H.feedFreshness = ()=> H.freshness(H.generatedAt);

  /* ---------- auth (mock) ---------- */
  H.user = ()=> read(K.session, null);
  H.signup = ({name,email,password})=>{
    name=(name||'').trim(); email=(email||'').trim().toLowerCase();
    if(name.length<1) return {ok:false,error:'이름을 입력해주세요.'};
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return {ok:false,error:'올바른 이메일 형식이 아니에요.'};
    if((password||'').length<6) return {ok:false,error:'비밀번호는 6자 이상이어야 해요.'};
    const users = read(K.users, []);
    if(users.some(u=>u.email===email)) return {ok:false,error:'이미 가입된 이메일이에요. 로그인해주세요.'};
    const u = { name, email, pw:hash(password) };
    users.push(u); write(K.users, users);
    write(K.session, { name, email });
    return {ok:true};
  };
  H.login = ({email,password})=>{
    email=(email||'').trim().toLowerCase();
    const users = read(K.users, []);
    const u = users.find(x=>x.email===email);
    if(!u || u.pw!==hash(password||'')) return {ok:false,error:'이메일 또는 비밀번호가 일치하지 않아요.'};
    write(K.session, { name:u.name, email:u.email });
    return {ok:true};
  };
  H.logout = ()=>{ LS.removeItem(K.session); };

  /* ---------- saves (bookmarks) ---------- */
  function savesMap(){ return read(K.saves, {}); }
  H.saves = ()=>{ const u=H.user(); if(!u) return []; return savesMap()[u.email] || []; };
  H.isSaved = (id)=> H.saves().includes(id);
  H.toggleSave = (id)=>{
    const u=H.user(); if(!u) return {needAuth:true};
    const m=savesMap(); const arr=m[u.email]||[];
    const i=arr.indexOf(id);
    if(i>=0) arr.splice(i,1); else arr.unshift(id);
    m[u.email]=arr; write(K.saves,m);
    return {saved: i<0};
  };

  /* ---------- reviews ---------- */
  H.reviews = (trendId)=> read(K.reviews, []).filter(r=>r.trendId===trendId).sort((a,b)=>b.ts-a.ts);
  H.myReviews = ()=>{ const u=H.user(); if(!u) return []; return read(K.reviews,[]).filter(r=>r.email===u.email).sort((a,b)=>b.ts-a.ts); };
  H.addReview = (trendId,{rating,text})=>{
    const u=H.user(); if(!u) return {needAuth:true};
    rating=Number(rating)||0; text=(text||'').trim();
    if(rating<1||rating>5) return {ok:false,error:'별점을 선택해주세요.'};
    if(text.length<5) return {ok:false,error:'후기를 5자 이상 적어주세요.'};
    const all=read(K.reviews,[]);
    all.push({ trendId, email:u.email, name:u.name, rating, text, ts: Date.now() });
    write(K.reviews, all);
    return {ok:true};
  };
  H.avgRating = (trendId)=>{ const rs=H.reviews(trendId); if(!rs.length) return null; return rs.reduce((s,r)=>s+r.rating,0)/rs.length; };

  /* ---------- UI helpers ---------- */
  H.starHTML = (n)=>{ let s=''; for(let i=1;i<=5;i++) s+=`<span class="${i<=Math.round(n)?'':'off'}">★</span>`; return s; };
  // 커버 썸네일용 대표 이미지: 영상 트렌드는 유튜브 썸네일, 아니면 첫 대표 이미지
  H.coverImg = (t)=>{
    if(t && t.video && t.video.youtube) return `https://i.ytimg.com/vi/${t.video.youtube}/hqdefault.jpg`;
    const im = t && t.images && t.images[0];
    return im ? (typeof im==='string'?im:im.u) : '';
  };
  H.coverHTML = (t, opts={})=>{
    const stamp = t.label ? `<span class="c-stamp">${H.esc(t.label)}</span>` : '';
    const img = H.coverImg(t);
    // 이미지가 깨지면 has-img를 떼서 기존 색 커버로 자연스럽게 폴백
    const bg = img ? `<img class="c-bg" src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('has-img');this.remove()">` : '';
    return `<div class="cover ${t.coverCat} ${opts.tall?'tall':''} ${img?'has-img':''}">
      ${bg}
      <span class="c-kicker">${H.esc(t.cat)}</span>
      <span class="c-buzz">${H.esc(t.buzz||'')}</span>
      <span class="c-title">${H.esc(t.title)}</span>
      ${stamp}
    </div>`;
  };
  // 상세 페이지 링크 (모든 페이지가 frontend/ 루트에 있어 상대경로로 동작)
  H.detailHref = (id)=> `trend.html?id=${encodeURIComponent(id)}`;
  // 광고 분석 랭킹 행 (홈 #ad · list.html?type=ad 공용) — rank: 1-based 표시 순번
  H.adRowHTML = (t, rank)=>`
    <a class="idx-row" href="${H.detailHref(t.id)}">
      <span class="rank">${String(rank).padStart(2,'0')}</span>
      <span class="t">
        <span class="it-title">${H.freshChip(t.analyzedAt)}${H.esc(t.title)}</span>
        <span class="it-cat">${H.esc(t.cat)} · ${H.esc(t.buzz)}</span>
        <span class="it-label">${H.esc(t.label)}</span>
      </span>
      <span class="mini">
        <span class="mrow">광고 ${t.ad} <span class="mbar"><i style="width:${t.ad}%;background:var(--accent)"></i></span></span>
        <span class="mrow">신뢰 ${t.trust} <span class="mbar"><i style="width:${t.trust}%;background:var(--green)"></i></span></span>
      </span>
    </a>`;
  // 요즘 트렌드 카드 (홈 #trend · list.html?type=trend 공용)
  H.trendCardHTML = (t)=>`
    <a class="chip-card" href="${H.detailHref(t.id)}">
      ${H.coverHTML(t)}
      <div class="cc-meta">
        <div class="cc-stage">${H.esc(t.stage)}</div>
        <div class="cc-title">${H.esc(t.title)}</div>
        ${t.pureKorean?`<div class="cc-pure">🌸 ${H.esc(t.pureKorean.split('(')[0].trim())}</div>`:''}
        ${t.prompt?`<div class="cc-prompt">📋 프롬프트 포함</div>`:''}
        <div class="cc-foot">${H.freshChip(t.analyzedAt)}</div>
      </div>
    </a>`;
  H.toast = (msg)=>{
    let el=H.q('.toast'); if(!el){ el=document.createElement('div'); el.className='toast'; document.body.appendChild(el); }
    el.textContent=msg; el.classList.add('show');
    clearTimeout(H._tt); H._tt=setTimeout(()=>el.classList.remove('show'),1900);
  };

  /* ---------- 신조어 신선도: 한물간 단어는 '오늘의 퀴즈/사전 최신'에서 제외 ---------- */
  // 제외 조건: stage에 끝물/한물/지남 표시 OR analyzedAt이 14일+ 미갱신(재확인 안 된 옛 단어).
  H.SLANG_STALE_DAYS = 14;
  H.isFreshSlang = (t)=>{
    if(t.fresh===false) return false;                       // 사람이 '지남'으로 마킹
    if(/끝물|한물|지남|옛유행|outdated/.test(t.stage||'')) return false;
    const d = t.analyzedAt || t.collectedAt;
    if(d){ const days = (Date.now() - new Date(d+'T00:00:00').getTime())/864e5; if(days >= H.SLANG_STALE_DAYS) return false; }
    return true;
  };

  /* ---------- 공유 (네이티브 공유 시트 → 실패 시 링크 복사) ---------- */
  H.share = async (opts)=>{
    const data = { title: opts.title||'한끗', text: opts.text||'', url: opts.url||location.href };
    try{
      if(navigator.share){ await navigator.share(data); return 'shared'; }
    }catch(e){ if(e && e.name==='AbortError') return 'cancel'; }
    try{
      await navigator.clipboard.writeText((data.text?data.text+'\n':'')+data.url);
      H.toast && H.toast('링크를 복사했어요 — 붙여넣기 하세요');
      return 'copied';
    }catch(e){ H.toast && H.toast('공유를 지원하지 않는 환경이에요'); return 'fail'; }
  };

  /* ---------- masthead (auth-aware), injected into [data-mast] ---------- */
  H.renderMast = ()=>{
    const host=H.q('[data-mast]'); if(!host) return;
    const u=H.user();
    const right = u
      ? `<a class="me-link" href="me.html"><span class="avatar">${H.esc(u.name.slice(0,1))}</span>${H.esc(u.name)}</a>`
      : `<a href="login.html">로그인</a><a class="btn-mini" href="signup.html">가입</a>`;
    host.className='mast';
    host.innerHTML=`<div class="wrap">
      <a class="wordmark" href="index.html">한<b>끗</b></a>
      <span class="issue">오늘 ${H.todayStr()} 기준</span>
      <button class="nav-toggle" type="button" aria-label="메뉴 열기" aria-expanded="false" aria-controls="mastNav">☰</button>
      <nav id="mastNav">
        <a href="index.html#ad">광고일까 진짜일까</a>
        <a href="index.html#trend">요즘 트렌드</a>
        <a href="dictionary.html">MZ 사전</a>
        <a href="quiz.html">유행어 퀴즈</a>
        <a href="pulse.html">트렌드 펄스</a>
        ${right}
      </nav>
    </div>`;
    // 모바일 햄버거 토글 (≤560px). 링크 누르면 닫힘.
    const tg=host.querySelector('.nav-toggle'), nv=host.querySelector('#mastNav');
    if(tg && nv){
      const setOpen=(o)=>{ nv.classList.toggle('open',o); tg.setAttribute('aria-expanded',String(o)); tg.textContent=o?'✕':'☰'; };
      tg.addEventListener('click',()=> setOpen(!nv.classList.contains('open')));
      nv.querySelectorAll('a').forEach(a=> a.addEventListener('click',()=> setOpen(false)));
      document.addEventListener('click',(e)=>{ if(nv.classList.contains('open') && !host.contains(e.target)) setOpen(false); });
    }
  };

  /* ---------- reveal on scroll (pure enhancement; default visible) ---------- */
  H.initReveals = ()=>{
    const els=H.qa('.reveal'); if(!els.length) return;
    const reduce = global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(!('IntersectionObserver' in global) || reduce) return;
    els.forEach(e=>e.classList.add('pre'));
    const io=new IntersectionObserver((ents)=>{ ents.forEach(e=>{ if(e.isIntersecting){ e.target.classList.remove('pre'); io.unobserve(e.target);} }); },{threshold:0.08});
    els.forEach(e=>io.observe(e));
    setTimeout(()=>els.forEach(e=>e.classList.remove('pre')), 1500);
  };

  /* ---------- per-page boot ---------- */
  H.boot = ()=>{ H.renderMast(); H.initReveals(); };

  global.H = H;
})(window);
