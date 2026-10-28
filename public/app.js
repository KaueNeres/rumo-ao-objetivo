// Interface do app: tela de perfis → assistente de criação → painel (partidas, métricas, melhorias, conta).
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app'), modalRoot = $('#modal-root');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (v, d = 0) => (v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (v, d = 1) => (v == null ? '—' : nf(v * 100, d) + '%');
const sg = v => { if (v == null) return '—'; const r = Math.round(v); return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r); };
async function json(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { 'Content-Type': 'application/json' }, body: opt.body ? JSON.stringify(opt.body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Erro ${r.status}`);
  return d;
}

// ---------- elo ----------
const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
const APEX = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];
const PT = { IRON: 'Ferro', BRONZE: 'Bronze', SILVER: 'Prata', GOLD: 'Ouro', PLATINUM: 'Platina', EMERALD: 'Esmeralda', DIAMOND: 'Diamante', MASTER: 'Mestre', GRANDMASTER: 'Grão-Mestre', CHALLENGER: 'Desafiante' };
const DIVS = ['IV', 'III', 'II', 'I'];
const LANES = [['TOP', 'Topo', 'top'], ['JUNGLE', 'Selva', 'jungle'], ['MIDDLE', 'Meio', 'middle'], ['BOTTOM', 'Atirador', 'bottom'], ['UTILITY', 'Suporte', 'utility']];
const emblem = t => `https://opgg-static.akamaized.net/images/medals_new/${(t || 'unranked').toLowerCase()}.png`;
const laneIcon = k => { const l = LANES.find(x => x[0] === k); return l ? `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${l[2]}.png` : ''; };
const tierOfScore = s => (s == null ? null : s >= 2800 ? 'MASTER' : TIERS[Math.floor(s / 400)]);
function scoreLabel(s, short) {
  if (s == null) return '—';
  s = Math.round(s);
  if (s >= 2800) return short ? `M+${s - 2800}` : `Mestre+ ${s - 2800} PDL`;
  const t = TIERS[Math.floor(s / 400)], d = DIVS[Math.floor((s % 400) / 100)];
  const INI = { IRON: 'F', BRONZE: 'B', SILVER: 'Pr', GOLD: 'O', PLATINUM: 'Pl', EMERALD: 'E', DIAMOND: 'D' };
  return short ? `${INI[t]}${4 - DIVS.indexOf(d)}` : `${PT[t]} ${d} ${s % 100} PDL`;
}
const goalText = g => (!g ? '—' : APEX.includes(g.tier) ? `${PT[g.tier]} ${g.lp || 0} PDL` : `${PT[g.tier]} ${g.div}`);

// ---------- estado ----------
const state = { view: 'home', id: null, data: null, tab: 'partidas', open: {}, closedSessions: {}, champSel: null, poll: null };
function go(view, id) { state.view = view; if (id !== undefined) state.id = id; location.hash = view === 'dash' ? `#/p/${state.id}` : view === 'new' ? '#/novo' : '#/'; render(); }
window.addEventListener('hashchange', () => {
  const m = location.hash.match(/^#\/p\/(\w+)/);
  if (m && (state.view !== 'dash' || state.id !== m[1])) { state.view = 'dash'; state.id = m[1]; state.data = null; render(); }
  else if (location.hash === '#/novo' && state.view !== 'new') { state.view = 'new'; render(); }
  else if ((!location.hash || location.hash === '#/') && state.view !== 'home') { state.view = 'home'; render(); }
});

function render() {
  clearInterval(state.poll); state.poll = null;
  if (state.view === 'new') return renderWizard();
  if (state.view === 'dash') return renderDash();
  return renderHome();
}

// =====================================================================
// Tela inicial: perfis criados + "novo perfil"
// =====================================================================
async function renderHome() {
  app.innerHTML = `<div class="home"><div class="brand"><div class="brand-mark">R</div><h1>Rumo ao Objetivo</h1></div>
    <p class="lead">Cada perfil é uma janela de acompanhamento: elo, MMR estimado, metas diárias e comparação com o elo que você quer alcançar.</p>
    <div class="profiles" id="plist"><div class="pcard"><span class="spin"></span></div></div></div>`;
  let list = [];
  try { list = await json('/api/profiles'); } catch (e) { $('#plist').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const v = await ddVersion();
  $('#plist').innerHTML = list.map(p => {
    const prog = p.score != null && p.goalScore ? Math.max(0, Math.min(1, p.score / p.goalScore)) : 0;
    return `<button class="pcard" data-id="${p.id}">
      <span class="del" data-del="${p.id}" title="Apagar perfil" aria-label="Apagar perfil">×</span>
      <div class="who">${p.icon && v ? `<img src="https://ddragon.leagueoflegends.com/cdn/${v}/img/profileicon/${p.icon}.png" alt="">` : `<img src="${emblem(p.tier)}" alt="">`}
        <div><div class="nick">${esc(p.gameName)} <span class="tag">#${esc(p.tagLine)}</span></div><div class="muted" style="font-size:13px">${esc(LANES.find(l => l[0] === p.lane)?.[1] || '')} · ${p.gpw} partidas/semana</div></div></div>
      <div class="rk"><span>${esc(p.elo || 'Carregando…')}</span><span>→ <b>${esc(goalText(p.goal))}</b></span></div>
      <div class="bar"><i style="width:${(prog * 100).toFixed(1)}%"></i></div>
    </button>`;
  }).join('') + `<button class="pcard new" id="newp"><span class="plus">+</span>Novo perfil</button>`;
  $('#newp').onclick = () => go('new');
  app.querySelectorAll('.pcard[data-id]').forEach(b => b.onclick = e => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      if (confirm('Apagar este perfil e os dados salvos dele?')) json(`/api/profiles/${del.dataset.del}`, { method: 'DELETE' }).then(renderHome);
      return;
    }
    state.data = null; state.tab = 'partidas'; go('dash', b.dataset.id);
  });
}
let _ddv = null;
async function ddVersion() { if (_ddv) return _ddv; try { _ddv = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0]; } catch { } return _ddv; }

// =====================================================================
// Assistente: Nick#tag → objetivo (elo, divisão/PDL) → rota → partidas por semana
// =====================================================================
function renderWizard() {
  const w = { step: 1, name: '', tag: '', found: null, goal: null, lane: null, gpw: 21 };
  const draw = () => {
    const steps = `<div class="steps">${[1, 2].map(i => `<i class="${i <= w.step ? 'on' : ''}"></i>`).join('')}</div>`;
    if (w.step === 1) {
      app.innerHTML = `<div class="wizard">${steps}<h2>Qual é a sua conta?</h2><p class="sub">Digite o nome de jogo e a tag (o que vem depois do #).</p>
        <form id="f1"><div class="field"><label for="nm">Riot ID</label>
        <div class="riotid"><input id="nm" placeholder="Nick" autocomplete="off" value="${esc(w.name)}" required><span>#</span><input id="tg" placeholder="BR1" autocomplete="off" value="${esc(w.tag)}" required></div></div>
        <div id="e1" class="err"></div>
        <div class="actions"><button type="button" class="btn ghost" id="back">Voltar</button><button class="btn primary" id="ok1">Confirmar</button></div></form></div>`;
      $('#nm').focus();
      $('#back').onclick = () => go('home');
      $('#f1').onsubmit = async e => {
        e.preventDefault();
        w.name = $('#nm').value.trim(); w.tag = $('#tg').value.trim().replace(/^#/, '');
        if (!w.name || !w.tag) return;
        $('#ok1').disabled = true; $('#ok1').innerHTML = '<span class="spin"></span>Procurando…'; $('#e1').textContent = '';
        try {
          w.found = await json(`/api/account?name=${encodeURIComponent(w.name)}&tag=${encodeURIComponent(w.tag)}`);
          w.name = w.found.gameName; w.tag = w.found.tagLine; w.step = 2; draw();
        } catch (err) { $('#e1').textContent = err.message; $('#ok1').disabled = false; $('#ok1').textContent = 'Confirmar'; }
      };
      return;
    }
    app.innerHTML = `<div class="wizard">${steps}
      <div class="found"><img src="${emblem(w.found.tier)}" alt=""><div><b>${esc(w.name)}</b> <span class="muted">#${esc(w.tag)}</span><div class="muted" style="font-size:13px">${esc(w.found.elo)}</div></div></div>
      <h2>Monte o seu objetivo</h2><p class="sub">Estas escolhas definem as metas e com quem você será comparado.</p>
      <div class="field"><label>Elo objetivo</label>
        <button class="selector" id="goalBtn">${w.goal ? `<img src="${emblem(w.goal.tier)}" alt=""><b>${esc(goalText(w.goal))}</b>` : '<span class="ph">Escolher elo e divisão</span>'}<span class="chev">▾</span></button></div>
      <div class="field"><label>Rota principal</label><div class="lanes">${LANES.map(([k, n]) => `<button class="pick ${w.lane === k ? 'on' : ''}" data-lane="${k}"><img src="${laneIcon(k)}" alt="">${n}</button>`).join('')}</div></div>
      <div class="field"><label for="gpw">Quantas partidas por semana, em média, você consegue jogar?</label>
        <div class="gpw"><input type="range" id="gpw" min="3" max="70" step="1" value="${w.gpw}"><span class="val num" id="gpwv">${w.gpw}</span></div>
        <div class="hint" id="gpwh">≈ ${nf(w.gpw / 7, 1)} por dia</div></div>
      <div id="e2" class="err"></div>
      <div class="actions"><button class="btn ghost" id="back">Voltar</button><button class="btn primary" id="create">Criar painel</button></div></div>`;
    $('#back').onclick = () => { w.step = 1; draw(); };
    $('#goalBtn').onclick = () => pickGoal(w.goal, g => { w.goal = g; draw(); });
    app.querySelectorAll('[data-lane]').forEach(b => b.onclick = () => { w.lane = b.dataset.lane; draw(); });
    $('#gpw').oninput = e => { w.gpw = Number(e.target.value); $('#gpwv').textContent = w.gpw; $('#gpwh').textContent = `≈ ${nf(w.gpw / 7, 1)} por dia`; };
    $('#create').onclick = async () => {
      if (!w.goal) return ($('#e2').textContent = 'Escolha o elo objetivo.');
      if (!w.lane) return ($('#e2').textContent = 'Escolha a rota principal.');
      $('#create').disabled = true;
      try {
        const p = await json('/api/profiles', { method: 'POST', body: { gameName: w.name, tagLine: w.tag, goal: w.goal, lane: w.lane, gpw: w.gpw } });
        state.data = null; state.tab = 'partidas'; go('dash', p.id);
      } catch (err) { $('#e2').textContent = err.message; $('#create').disabled = false; }
    };
  };
  draw();
}

// ---------- janelas flutuantes: elo → divisão (ou PDL para Mestre+) ----------
function modal(html, onMount) {
  modalRoot.innerHTML = `<div class="overlay" id="ov"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const close = () => { modalRoot.innerHTML = ''; document.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  $('#ov').onclick = e => { if (e.target.id === 'ov') close(); };
  onMount(close);
}
function pickGoal(current, done) {
  modal(`<h3>Elo objetivo</h3><p class="sub">Até onde você quer chegar nesta temporada?</p>
    <div class="tiers">${TIERS.map(t => `<button class="pick ${current && current.tier === t ? 'on' : ''}" data-t="${t}"><img src="${emblem(t)}" alt="">${PT[t]}</button>`).join('')}</div>
    <div class="modal-foot"><button class="btn ghost" id="mc">Cancelar</button></div>`, close => {
    $('#mc').onclick = close;
    modalRoot.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { close(); pickDiv(b.dataset.t, current, done); });
  });
}
function pickDiv(tier, current, done) {
  if (APEX.includes(tier)) {
    const val = current && current.tier === tier ? current.lp : tier === 'MASTER' ? 100 : tier === 'GRANDMASTER' ? 500 : 900;
    modal(`<div style="display:flex;gap:14px;align-items:center;margin-bottom:12px"><img src="${emblem(tier)}" alt="" style="width:64px;height:64px"><div><h3>${PT[tier]}</h3><p class="sub" style="margin:0">Quantos PDL você quer alcançar?</p></div></div>
      <form id="lpf"><input class="text num" id="lp" type="number" min="0" max="3000" step="1" value="${val}" required style="font-size:26px">
      <div class="hint">De Mestre para cima não há divisões: o elo é medido só em PDL. No servidor BR, Grão-Mestre e Desafiante dependem do corte do ladder (por volta de 200+ e 500+ PDL).</div>
      <div class="modal-foot"><button type="button" class="btn ghost" id="mb">Voltar</button><button class="btn primary">Confirmar</button></div></form>`, close => {
      $('#lp').focus(); $('#lp').select();
      $('#mb').onclick = () => { close(); pickGoal(current, done); };
      $('#lpf').onsubmit = e => { e.preventDefault(); const lp = Math.max(0, Math.round(Number($('#lp').value) || 0)); close(); done({ tier, div: 'I', lp }); };
    });
    return;
  }
  modal(`<div style="display:flex;gap:14px;align-items:center;margin-bottom:16px"><img src="${emblem(tier)}" alt="" style="width:64px;height:64px"><div><h3>${PT[tier]}</h3><p class="sub" style="margin:0">Qual divisão?</p></div></div>
    <div class="divs">${DIVS.map(d => `<button class="pick ${current && current.tier === tier && current.div === d ? 'on' : ''}" data-d="${d}">${d}</button>`).join('')}</div>
    <div class="modal-foot"><button class="btn ghost" id="mb">Voltar</button></div>`, close => {
    $('#mb').onclick = () => { close(); pickGoal(current, done); };
    modalRoot.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { close(); done({ tier, div: b.dataset.d, lp: 0 }); });
  });
}

// =====================================================================
// Painel
// =====================================================================
const TABS = [['partidas', 'Partidas'], ['campeoes', 'Métricas Campeão'], ['melhorar', 'O que desenvolver'], ['conta', 'Informações da Conta']];

async function renderDash() {
  if (!state.data || state.data.profile.id !== state.id) {
    app.innerHTML = `<div class="empty-state"><span class="spin"></span>Carregando…</div>`;
    try { state.data = await json(`/api/profiles/${state.id}`); }
    catch (e) { app.innerHTML = `<div class="empty-state"><p class="err">${esc(e.message)}</p><button class="btn" onclick="location.hash='#/'">Voltar</button></div>`; return; }
  }
  clearInterval(state.poll); state.poll = null;
  const D = state.data, V = D.view, P = D.profile;
  app.innerHTML = `
  <div class="top"><div class="top-in">
    <button class="btn ghost small" id="home" title="Voltar para os perfis">← Perfis</button>
    <nav class="tabs">${TABS.map(([k, n]) => `<button class="tab ${state.tab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</nav>
    <div class="upd"><span class="st" id="ust">${D.updated ? 'Atualizado ' + ago(D.updated) : ''}</span><button class="btn primary" id="updBtn">⟳ Atualizar partidas</button></div>
  </div><div class="progress"><i id="prog" style="width:0"></i></div></div>
  <div class="dash">
    <aside class="col">${leftCol(D)}</aside>
    <main class="col" id="right">${rightCol(D)}</main>
  </div>`;
  $('#home').onclick = () => go('home');
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { state.tab = b.dataset.tab; renderDash(); });
  $('#updBtn').onclick = () => startUpdate();
  $('#swapGoal').onclick = () => pickGoal(P.goal, async g => { await json(`/api/profiles/${P.id}`, { method: 'PATCH', body: { goal: g } }); await reload(); });
  bindChart(D);
  bindRight(D);
  const running = (D.job && D.job.state === 'running') || (D.refJob && D.refJob.state === 'running') || (D.lifeJob && D.lifeJob.state === 'running');
  if (running) poll();
}
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; };
async function reload() { state.data = await json(`/api/profiles/${state.id}`); renderDash(); }

async function startUpdate(more) {
  await json(`/api/profiles/${state.id}/update${more ? '?more=1' : ''}`, { method: 'POST' });
  poll();
}
function poll() {
  clearInterval(state.poll);
  let lastDone = -1, lastReload = Date.now();
  const tick = async () => {
    let s; try { s = await json(`/api/profiles/${state.id}/status`); } catch { return; }
    const j = s.job, rj = s.refJob, lj = s.lifeJob;
    const btn = $('#updBtn'), st = $('#ust'), pr = $('#prog');
    if (!btn) return clearInterval(state.poll);
    if (j && j.state === 'running') {
      btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Atualizando';
      st.textContent = j.step || '';
      pr.style.width = j.total ? `${Math.round(j.done / j.total * 100)}%` : '8%';
      if (j.done !== lastDone && Date.now() - lastReload > 6000) { lastDone = j.done; lastReload = Date.now(); quietReload(); }
    } else if (rj && rj.state === 'running') {
      btn.disabled = false; btn.textContent = '⟳ Atualizar partidas';
      st.textContent = `Montando a meta do elo: ${rj.step}`;
      pr.style.width = rj.total ? `${Math.round(rj.done / rj.total * 100)}%` : '5%';
      if (Date.now() - lastReload > 20000) { lastReload = Date.now(); quietReload(); }
    } else if (lj && lj.state === 'running') {
      st.textContent = lj.step || 'Lendo histórico no op.gg…';
    } else {
      clearInterval(state.poll); state.poll = null;
      pr.style.width = '0';
      if (j && j.state === 'error') { st.innerHTML = `<span class="down">${esc(j.error)}</span>`; btn.disabled = false; btn.textContent = '⟳ Tentar de novo'; return; }
      reload();
    }
  };
  state.poll = setInterval(tick, 1500); tick();
}
async function quietReload() { // atualiza os dados sem perder a posição da página
  try {
    state.data = await json(`/api/profiles/${state.id}`);
    const y = scrollY;
    renderDash(); scrollTo(0, y);
  } catch { }
}

// ---------- coluna esquerda ----------
function leftCol(D) {
  const V = D.view, P = D.profile, G = V.goals, v = D.dd.v;
  const lad = D.opgg && D.opgg.ladder;
  const curTier = V.snap ? V.snap.tier : null;
  const mmrTier = tierOfScore(V.mmrNow);
  const icon = D.summoner ? `https://ddragon.leagueoflegends.com/cdn/${v}/img/profileicon/${D.summoner.icon}.png` : emblem(curTier);
  return `
  <section class="card idcard"><img src="${icon}" alt="">
    <div><div class="nick">${esc(P.gameName)} <span>#${esc(P.tagLine)}</span></div>
    <div class="ladder">${lad ? `Posição <b>${nf(lad.rank)}</b> de ${lad.total ? '~' + nf(lad.total) : '—'} jogadores (top ${nf(lad.ratio, 2)}%)` : 'Posição no ladder: atualize para buscar'}</div>
    <div class="lvl">${D.summoner ? `Nível ${D.summoner.level} · ` : ''}${esc(D.lanePt[P.lane])} · ${P.gpw} partidas/semana</div></div></section>

  <section class="quad">
    <div class="tile cur"><span class="lbl">Elo atual</span><img src="${emblem(curTier)}" alt=""><span class="big">${esc(V.snap ? V.curLabel : 'Sem ranqueada')}</span>
      <span class="sub2">${V.snap ? `${V.snap.w}V ${V.snap.l}D · ${pct(V.seasonWR)}` : ''}</span></div>
    <div class="tile goal"><span class="lbl">Elo meta</span><button class="swap" id="swapGoal" title="Trocar objetivo" aria-label="Trocar objetivo">⇄</button><img src="${emblem(P.goal.tier)}" alt=""><span class="big">${esc(G.goalLabel)}</span>
      <span class="sub2">${G.reached ? 'Objetivo alcançado!' : G.goal != null && V.cur != null ? `faltam ${nf(G.goal - V.cur)} PDL` : ''}</span></div>
    <div class="tile cur"><span class="lbl">MMR estimado</span><img src="${emblem(mmrTier)}" alt=""><span class="big">${esc(V.mmrLabel)}</span>
      <span class="sub2">${V.mmrNow != null && V.cur != null ? `${sg(V.gapNow)} em relação ao elo` : 'aguardando partidas'}</span></div>
    <div class="tile goal"><span class="lbl">MMR meta</span><img src="${emblem(tierOfScore(G.goal))}" alt=""><span class="big">${esc(scoreLabel(G.goal))}</span>
      <span class="sub2">próxima: <b class="up">+${Math.round(V.next.win)}</b> / <b class="down">−${Math.round(V.next.loss)}</b></span></div>
  </section>

  <section class="card"><h3>Gráfico de elo <small>últimas ${V.chart.length} partidas</small></h3>${chartSvg(V)}</section>
  ${goalsCard(D)}
  ${summaryCard(D)}`;
}

function goalsCard(D) {
  const G = D.view.goals, T = G.today, W = G.week;
  const slots = [];
  for (let i = 0; i < Math.max(T.games, T.w + T.l); i++) slots.push(i);
  const todayGames = (D.view.sessions[0] && D.view.sessions[0].key === todayKey()) ? D.view.sessions[0].games.filter(g => !g.remake).slice().reverse() : [];
  let status;
  if (G.reached) status = '<span class="pill ok">Objetivo alcançado</span>';
  else if (G.wrNeed == null) status = '<span class="pill no">Inviável no ritmo atual: aumente as partidas/semana</span>';
  else if (!T.w && !T.l) status = '<span class="pill">Nenhuma partida hoje</span>';
  else if (T.w >= T.wins) status = '<span class="pill ok">Meta do dia batida</span>';
  else if (T.l > T.maxLoss) status = '<span class="pill no">Limite de derrotas: pare por hoje</span>';
  else status = `<span class="pill mid">Faltam ${T.wins - T.w} vitória(s)</span>`;
  return `<section class="card"><h3>Meta de hoje <small>${G.daysLeft} dias até 14/11</small></h3>
    <div class="slots">${slots.map(i => { const g = todayGames[i]; return `<span class="slot ${g ? (g.win ? 'w' : 'l') : ''}" title="${g ? esc(g.champ) : 'a jogar'}">${g ? (g.win ? 'V' : 'D') : ''}</span>`; }).join('')}</div>
    ${status}
    <div class="goalrow" style="margin-top:12px"><span>Hoje <b>${T.wins ?? '—'}V</b> · máx. <b>${T.maxLoss ?? '—'}D</b></span><span>Semana <b>${W.w}V ${W.l}D</b> / meta ${W.wins ?? '—'}V em ${W.games}</span></div>
    <div class="goalrow" style="margin-top:6px"><span>Winrate necessário <b>${pct(G.wrNeed)}</b></span><span>Últimas 20 <b>${pct(D.view.wr20, 0)}</b></span></div>
    <table class="alt"><tr><th>Partidas/semana</th><th>Até o fim</th><th>Winrate necessário</th></tr>
      ${G.alt.map(a => `<tr class="${a.gpw === G.gpw ? 'me' : ''}"><td>${a.gpw}${a.gpw === G.gpw ? ' (você)' : ''}</td><td class="num">${a.games}</td><td class="num">${a.wr == null ? 'inviável' : pct(a.wr)}</td></tr>`).join('')}</table>
    <div class="note">Se jogar mais que o planejado num dia, tudo conta no mesmo dia (até 6h da manhã) e a meta cresce com o mesmo winrate.</div></section>`;
}
const todayKey = () => new Date(Date.now() - 9 * 3600e3).toISOString().slice(0, 10);

function summaryCard(D) {
  const V = D.view, laneName = D.lanePt[D.profile.lane];
  const rows = V.summary.map(s => {
    const better = s.you != null && s.ref != null ? (s.lower ? s.you <= s.ref : s.you >= s.ref) : null;
    const max = Math.max(s.you || 0, s.ref || 0) * 1.25 || 1;
    return `<div class="srow"><span class="n">${esc(s.label)}</span><span class="you ${better == null ? '' : better ? 'up' : 'down'}">${nf(s.you, s.dec)}${s.unit || ''}</span><span class="ref">${nf(s.ref, s.dec)}${s.unit || ''}</span>
      <div class="cmp"><i style="width:${Math.min(100, (s.you || 0) / max * 100)}%;background:${better == null ? 'var(--muted)' : better ? 'var(--good)' : 'var(--bad)'}"></i>${s.ref != null ? `<b style="left:${Math.min(99, s.ref / max * 100)}%"></b>` : ''}</div></div>`;
  }).join('');
  return `<section class="card"><h3>Resumo · ${esc(laneName)} <small>${V.laneUsed ? 'suas últimas partidas na rota' : 'poucas partidas na rota: usando todas'}</small></h3>
    <div class="sumhead"><span></span><span>Você</span><span>Meta</span></div>
    <div class="sum">${rows}</div>${refNote(D)}</section>`;
}
function refNote(D) {
  if (D.refJob && D.refJob.state === 'running') return `<div class="note">Montando a meta de ${esc(goalText(D.profile.goal))}: ${esc(D.refJob.step)}</div>`;
  if (!D.refs) return `<div class="note">A meta aparece depois da primeira atualização (amostra de partidas de ${esc(goalText(D.profile.goal))}).</div>`;
  return `<div class="note">Meta = média de ${nf(D.refs.samples)} jogadores em ${nf(D.refs.matches)} partidas de ${esc(goalText(D.profile.goal))}, com o mesmo campeão quando há amostra (senão, a média da rota).</div>`;
}

// ---------- gráfico de elo × MMR (um eixo só: os dois na mesma escala de PDL) ----------
function chartSvg(V) {
  const pts = V.chart.filter(p => p.elo != null);
  if (pts.length < 2) return `<p class="muted">O gráfico aparece depois de algumas partidas.</p>`;
  const W = 340, H = 190, L = 34, R = 8, T = 10, B = 22;
  const goal = V.goals.goal;
  const vals = pts.flatMap(p => [p.elo, p.mmr]).filter(v => v != null);
  if (goal != null) vals.push(goal);
  let lo = Math.floor((Math.min(...vals) - 20) / 100) * 100, hi = Math.ceil((Math.max(...vals) + 20) / 100) * 100;
  if (hi - lo < 200) hi = lo + 200;
  const X = i => L + i / (pts.length - 1) * (W - L - R), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const line = key => { let d = '', pen = false; pts.forEach((p, i) => { if (p[key] == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p[key]).toFixed(1)}`; pen = true; }); return d; };
  const step = (hi - lo) > 800 ? 400 : 100;
  let grid = '';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 4}" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="var(--muted)">${esc(scoreLabel(v, true))}</text>`;
  const gl = goal != null && goal <= hi && goal >= lo ? `<line x1="${L}" x2="${W - R}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="var(--ink2)" stroke-dasharray="4 3" stroke-width="1.2"/><text x="${W - R}" y="${Y(goal) - 4}" text-anchor="end" font-size="9" fill="var(--ink2)">meta</text>` : '';
  const lastI = pts.length - 1;
  const dots = pts.map((p, i) => `<rect x="${(X(i) - 2.5).toFixed(1)}" y="${H - B + 6}" width="5" height="5" rx="1" fill="${p.win ? 'var(--win)' : 'var(--loss)'}"/>`).join('');
  return `<div class="legend"><span><i style="background:#5b8cff"></i>Elo${pts.some(p => !p.exact) ? ' (estimado onde não foi medido)' : ''}</span><span><i style="background:#c27a44"></i>MMR estimado</span><span><i class="dashed"></i>Meta</span></div>
  <div class="chart-wrap" id="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do elo e do MMR estimado">
    ${grid}${gl}
    <path d="${line('mmr')}" fill="none" stroke="#c27a44" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${line('elo')}" fill="none" stroke="#5b8cff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${X(lastI)}" cy="${Y(pts[lastI].elo)}" r="4" fill="#5b8cff" stroke="var(--panel)" stroke-width="2"/>
    ${pts[lastI].mmr != null ? `<circle cx="${X(lastI)}" cy="${Y(pts[lastI].mmr)}" r="4" fill="#c27a44" stroke="var(--panel)" stroke-width="2"/>` : ''}
    ${dots}
    <line id="cx" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--ink2)" stroke-width="1" opacity="0"/>
    <rect id="hit" x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/>
  </svg><div class="tip hidden" id="ctip"></div></div>`;
}
function bindChart(D) {
  const wrap = $('#chart'); if (!wrap) return;
  const pts = D.view.chart.filter(p => p.elo != null);
  const svg = $('svg', wrap), tip = $('#ctip'), cx = $('#cx'), W = 340, L = 34, R = 8;
  const show = e => {
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W;
    const i = Math.max(0, Math.min(pts.length - 1, Math.round((x - L) / (W - L - R) * (pts.length - 1))));
    const p = pts[i], px = L + i / (pts.length - 1) * (W - L - R);
    cx.setAttribute('x1', px); cx.setAttribute('x2', px); cx.setAttribute('opacity', '.6');
    tip.classList.remove('hidden');
    tip.style.left = `${px / W * r.width}px`; tip.style.top = '30px';
    tip.innerHTML = `${new Date(p.t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${esc(p.champ)} · <b class="${p.win ? 'up' : 'down'}">${p.win ? 'Vitória' : 'Derrota'}</b><br>Elo <b>${esc(scoreLabel(p.elo))}</b>${p.exact ? '' : ' (est.)'}<br>MMR <b>${esc(scoreLabel(p.mmr))}</b>`;
  };
  const hide = () => { tip.classList.add('hidden'); cx.setAttribute('opacity', '0'); };
  $('#hit', wrap).addEventListener('pointermove', show);
  $('#hit', wrap).addEventListener('pointerleave', hide);
}

// ---------- coluna direita (abas) ----------
function rightCol(D) {
  if (state.tab === 'campeoes') return champTab(D);
  if (state.tab === 'melhorar') return improveTab(D);
  if (state.tab === 'conta') return accountTab(D);
  return matchesTab(D);
}
function bindRight(D) {
  app.querySelectorAll('[data-sess]').forEach(b => b.onclick = () => { const k = b.dataset.sess; state.closedSessions[k] = !b.parentElement.classList.contains('closed'); b.parentElement.classList.toggle('closed'); });
  app.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const m = b.closest('.match'); m.classList.toggle('open'); state.open[b.dataset.open] = m.classList.contains('open'); });
  const more = $('#moreBtn'); if (more) more.onclick = () => startUpdate(true);
  app.querySelectorAll('[data-champ]').forEach(b => b.onclick = () => { state.champSel = b.dataset.champ; $('#right').innerHTML = champTab(D); bindRight(D); });
  app.querySelectorAll('[data-strat]').forEach(b => b.onclick = () => { state.stratLane = b.dataset.strat; $('#right').innerHTML = improveTab(D); bindRight(D); });
  const cs = $('#csort'); if (cs) cs.onchange = () => { state.champSort = cs.value; $('#right').innerHTML = champTab(D); bindRight(D); };
  const life = $('#lifeBtn'); if (life) life.onclick = async () => { await json(`/api/profiles/${D.profile.id}/lifetime`, { method: 'POST' }); life.disabled = true; life.innerHTML = '<span class="spin"></span>Lendo todas as temporadas no op.gg…'; poll(); };
  const pf = $('#prefForm'); if (pf) pf.onsubmit = async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(pf).entries());
    await json(`/api/profiles/${D.profile.id}`, { method: 'PATCH', body: { lane: fd.lane, gpw: Number(fd.gpw) } });
    reload();
  };
}

// ---------- Partidas, agrupadas por sessão ----------
const img = {
  champ: (D, id, name) => `https://ddragon.leagueoflegends.com/cdn/${D.dd.v}/img/champion/${(D.dd.champs[id] || {}).id || name}.png`,
  item: (D, id) => `https://ddragon.leagueoflegends.com/cdn/${D.dd.v}/img/item/${id}.png`,
  spell: (D, id) => (D.dd.spells[id] ? `https://ddragon.leagueoflegends.com/cdn/${D.dd.v}/img/spell/${D.dd.spells[id].id}.png` : ''),
  perk: (D, id) => (D.dd.perks[id] ? `https://ddragon.leagueoflegends.com/cdn/img/${D.dd.perks[id].icon}` : ''),
};
const itemImg = (D, id, cls = '', title = '') => (id ? `<img class="${cls}" src="${img.item(D, id)}" alt="" title="${esc(title)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'empty'}))">` : `<span class="empty ${cls}" title="${esc(title)}"></span>`);

function matchesTab(D) {
  const V = D.view;
  if (!V.sessions.length) {
    const j = D.job;
    return `<div class="card empty-state">${j && j.state === 'running' ? `<span class="spin"></span>${esc(j.step)}<p class="muted">Na primeira vez o app baixa 15 partidas e o elo dos outros jogadores de cada uma (para estimar o MMR). Leva uns 3 minutos por causa do limite da API da Riot.</p>` : j && j.state === 'error' ? `<p class="err">${esc(j.error)}</p>` : 'Nenhuma partida ranqueada ainda. Clique em <b>Atualizar partidas</b>.'}</div>`;
  }
  const tk = todayKey();
  return V.sessions.map((s, si) => {
    const closed = state.closedSessions[s.key] ?? si > 2;
    const d = new Date(s.key + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'short' });
    return `<section class="session ${s.key === tk ? 'now' : ''} ${closed ? 'closed' : ''}">
      <button class="shead" data-sess="${s.key}"><span class="d">Sessão ${esc(d)}</span>
        <span class="stat">V: <b class="up">${s.w}</b> &nbsp;D: <b class="down">${s.l}</b></span>
        <span class="stat ${s.pdl > 0 ? 'up' : s.pdl < 0 ? 'down' : ''}">${s.pdlExact ? '' : '≈'}${sg(s.pdl)} PDL</span>
        <span class="stat">${s.mmr == null ? '' : `${sg(s.mmr)} MMR`}</span><span class="chev">▾</span></button>
      <div class="games">${s.games.map(g => matchCard(D, g)).join('')}</div></section>`;
  }).join('') + `<div class="more"><button class="btn ghost" id="moreBtn">Carregar partidas mais antigas</button></div>`;
}

function matchCard(D, g) {
  const r = g.ref, m = g.m;
  const when = new Date(g.t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const dur = `${Math.floor(g.dur / 60)}:${String(g.dur % 60).padStart(2, '0')}`;
  const cls = g.remake ? 'r' : g.win ? 'w' : 'l';
  const lane = g.lane ? `<span class="stat2"><span class="grade ${g.lane.grade}">${g.lane.grade}</span>Rota aos 14: <b>${sg(g.lane.gd14)}</b> ouro · <b>${sg(g.lane.csd14)}</b> CS</span>` : '';
  const delta = g.remake ? '' : `<div class="lp ${g.estDelta > 0 ? 'up' : 'down'}">${g.deltaKind === 'exato' ? '' : '≈'}${sg(g.estDelta)} PDL</div>`;
  const refLine = r ? `<div class="line2"><span>Meta ${esc(goalText(D.profile.goal))}${r.scope === 'rota' ? ' (rota)' : ''}:</span><span><b>${nf(r.k, 1)} / ${nf(r.d, 1)} / ${nf(r.a, 1)}</b></span><span>CS/min <b>${nf(r.csMin, 1)}</b></span><span>Visão/min <b>${nf(r.vpm, 2)}</b></span><span>Rota dominada <b>${nf(r.laneWin, 0)}%</b></span></div>` : '';
  return `<article class="match ${cls} ${state.open[g.id] ? 'open' : ''}">
    <div class="mrow">
      <div class="champ"><img src="${img.champ(D, g.champId, g.champ)}" alt="${esc(g.champ)}" title="${esc(g.champ)}">${g.pos ? `<img class="pos" src="${laneIcon(g.pos)}" alt="">` : ''}</div>
      <div class="sr"><img src="${img.spell(D, g.spells[0])}" alt="" title="${esc((D.dd.spells[g.spells[0]] || {}).name)}"><img class="rune" src="${img.perk(D, g.keystone)}" alt="" title="${esc((D.dd.perks[g.keystone] || {}).name)}">
        <img src="${img.spell(D, g.spells[1])}" alt="" title="${esc((D.dd.spells[g.spells[1]] || {}).name)}"><img class="rune" src="${img.perk(D, g.sub)}" alt="" title="${esc((D.dd.perks[g.sub] || {}).name)}"></div>
      <div class="meta"><div class="res">${g.remake ? 'Remake' : g.win ? 'Vitória' : 'Derrota'}</div>${esc(when)}<br>${dur}${delta}</div>
      <div class="main">
        <div class="line1"><span class="kda">${m.k} / <span class="dd">${m.d}</span> / ${m.a}</span><span class="stat2">KDA <b>${nf(m.kda, 2)}</b></span><span class="stat2">CS/min <b>${nf(m.csMin, 1)}</b></span><span class="stat2">Visão/min <b>${nf(m.vpm, 2)}</b></span>${lane}</div>
        ${refLine}
        <div class="items">${g.items.map(id => itemImg(D, id)).join('')}<span class="sep"></span>${itemImg(D, g.trinket, '', 'Lente / amuleto')}${itemImg(D, g.quest, 'quest', 'Missão da rota')}</div>
      </div>
      <button class="expand" data-open="${g.id}" title="Detalhes da partida" aria-label="Detalhes da partida"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 4l5 6 5-6z" fill="currentColor"/></svg></button>
    </div>
    <div class="detail">${matchDetail(D, g)}</div>
  </article>`;
}
function matchDetail(D, g) {
  const r = g.ref || {}, M = D.metrics;
  const rows = Object.keys(M).map(k => {
    const you = g.m[k], ref = r[k];
    const better = you != null && ref != null ? (M[k].lower ? you <= ref : you >= ref) : null;
    return `<tr><td>${esc(M[k].label)}</td><td class="${better == null ? '' : better ? 'up' : 'down'}">${nf(you, M[k].dec)}${M[k].unit || ''}</td><td class="r">${nf(ref, M[k].dec)}${M[k].unit || ''}</td></tr>`;
  }).join('');
  const team = ally => g.players.filter(p => p.team === ally).map(p => `<div class="pl ${p.me ? 'me' : ''}"><img src="${img.champ(D, p.champId, p.champ)}" alt="" loading="lazy"><span class="nm">${esc(p.name)}</span><span class="k">${p.k}/${p.d}/${p.a}</span></div>`).join('');
  const lane = g.lane ? `<p class="note">Contra o oponente da rota aos 14 min: ${sg(g.lane.gd14)} ouro, ${sg(g.lane.csd14)} CS, ${sg(g.lane.xpd14)} XP. Elo médio do lobby: ${esc(scoreLabel(g.lobby))}.</p>` : `<p class="note">Elo médio do lobby: ${esc(scoreLabel(g.lobby))}.</p>`;
  return `<div><table class="mtab"><tr><th>Métrica</th><th>Você</th><th>Meta</th></tr>${rows}</table>${lane}</div>
    <div class="teams"><div class="team"><h4>Seu time</h4>${team(true)}</div><div class="team"><h4>Inimigos</h4>${team(false)}</div></div>`;
}

// ---------- Métricas por campeão ----------
const CSORT = [['n', 'Mais jogados'], ['wr', 'Maior winrate'], ['w', 'Mais vitórias'], ['l', 'Mais derrotas'], ['kda', 'Maior KDA'], ['d', 'Menos mortes'], ['csMin', 'Maior CS/min'], ['vpm', 'Maior visão/min'], ['name', 'Nome (A–Z)']];
function sortChamps(list, key) {
  const by = {
    n: c => -c.n, wr: c => -(c.w / c.n) * 1000 - c.n, w: c => -c.w * 1000 - c.n, l: c => -(c.n - c.w) * 1000 - c.n,
    kda: c => -(c.m.kda ?? 0), d: c => c.m.d ?? 99, csMin: c => -(c.m.csMin ?? 0), vpm: c => -(c.m.vpm ?? 0),
  }[key];
  return [...list].sort(key === 'name' ? (a, b) => a.champ.localeCompare(b.champ) : (a, b) => by(a) - by(b));
}
function champTab(D) {
  const M = D.metrics, C = sortChamps(D.view.champs, state.champSort || 'n');
  if (!C.length) return `<div class="card empty-state">Sem partidas ainda.</div>`;
  const sel = C.find(c => c.champ === state.champSel) || C[0];
  const keys = ['k', 'd', 'a', 'kda', 'csMin', 'cs10', 'gpm', 'dpm', 'dmgShare', 'kp', 'vpm', 'cw', 'laneWin', 'solo'];
  const bars = keys.map(k => {
    const you = sel.m[k], ref = sel.ref ? sel.ref[k] : null;
    const better = you != null && ref != null ? (M[k].lower ? you <= ref : you >= ref) : null;
    const max = Math.max(you || 0, ref || 0) * 1.2 || 1;
    return `<div class="brow"><div class="t"><span>${esc(M[k].label)}</span><span><b class="${better == null ? '' : better ? 'up' : 'down'}">${nf(you, M[k].dec)}${M[k].unit || ''}</b> <span class="r">/ ${nf(ref, M[k].dec)}${M[k].unit || ''}</span></span></div>
      <div class="track"><i style="width:${Math.min(100, (you || 0) / max * 100)}%;background:${better == null ? 'var(--muted)' : better ? 'var(--good)' : 'var(--bad)'}"></i>${ref != null ? `<b style="left:${Math.min(99, ref / max * 100)}%"></b>` : ''}</div></div>`;
  }).join('');
  const table = `<div class="scroll"><table class="ctable"><tr><th>Campeão</th><th>Jogos</th><th>V</th><th>D</th><th>Winrate</th><th>KDA</th><th>Mortes</th><th>CS/min</th><th>Dano/min</th><th>Visão/min</th><th>Part.</th><th>Meta WR</th></tr>
    ${C.map(c => `<tr><td><img src="${img.champ(D, c.champId, c.champ)}" alt="">${esc(c.champ)}</td><td>${c.n}</td><td class="up">${c.w}</td><td class="down">${c.n - c.w}</td><td class="${c.w / c.n >= 0.5 ? 'up' : 'down'}">${pct(c.w / c.n, 0)}</td><td>${nf(c.m.kda, 2)}</td><td>${nf(c.m.d, 1)}</td><td>${nf(c.m.csMin, 1)}</td><td>${nf(c.m.dpm, 0)}</td><td>${nf(c.m.vpm, 2)}</td><td>${nf(c.m.kp, 0)}%</td><td class="muted">${c.ref ? pct(c.ref.wr, 0) : '—'}</td></tr>`).join('')}</table></div>`;
  return `<section class="card"><h3>Métricas por campeão <small>você × meta de ${esc(goalText(D.profile.goal))}</small></h3>
    <div class="cm"><div><label class="sortby">Ordenar por <select id="csort" class="text">${CSORT.map(([k, n]) => `<option value="${k}" ${(state.champSort || 'n') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><div class="clist">${C.map(c => `<button class="citem ${c === sel ? 'on' : ''}" data-champ="${esc(c.champ)}"><img src="${img.champ(D, c.champId, c.champ)}" alt=""><div><div class="nm">${esc(c.champ)}</div><div class="s">${c.n} jogos · <span class="up">${c.w}V</span> <span class="down">${c.n - c.w}D</span> · ${esc(D.lanePt[c.pos] || '')}</div></div><span class="wr ${c.w / c.n >= 0.5 ? 'up' : 'down'}">${pct(c.w / c.n, 0)}</span></button>`).join('')}</div></div>
    <div><div class="cmp-head"><img src="${img.champ(D, sel.champId, sel.champ)}" alt=""><div><h2>${esc(sel.champ)}</h2><div class="muted">${sel.n} partidas · ${sel.w}V ${sel.n - sel.w}D · ${sel.ref ? `meta: ${sel.ref.scope === 'campeão' ? `${nf(sel.ref.n)} partidas de ${esc(sel.champ)}` : `média da rota (${nf(sel.ref.n)} jogadores)`} em ${esc(goalText(D.profile.goal))}` : 'meta ainda não montada'}</div></div></div>
      <div class="legend"><span><i style="background:var(--good)"></i>Você (verde = igual ou melhor que a meta)</span><span><i style="background:var(--bronze-hi)"></i>Meta</span></div>
      <div class="bars">${bars}</div></div></div></section>
    <section class="card"><h3>Todos os campeões</h3>${table}</section>`;
}

// ---------- O que desenvolver ----------
function improveTab(D) {
  const I = D.view.improve;
  const mc = p => `<div class="icard ${p.gap > 0 ? 'good' : ''}"><h4>${esc(p.title)}</h4>
    <div class="vs"><span>Você <b>${nf(p.you, p.dec)}${p.unit}</b></span><span class="r">Meta <b>${nf(p.ref, p.dec)}${p.unit}</b></span><span>${p.gap > 0 ? '+' : ''}${nf(p.gap * 100, 0)}%</span></div>
    ${p.gap < 0 ? `<p>${esc(p.tip)}</p>${p.src ? srcLink(p.src) : ''}` : ''}</div>`;
  return `<section class="card"><h3>O que desenvolver <small>comparado com ${esc(goalText(D.profile.goal))} · ${esc(D.lanePt[D.profile.lane])}</small></h3>
    ${I.metrics.length ? `<div class="sec-title">Maiores diferenças para a meta</div><div class="imp">${I.metrics.map(mc).join('')}</div>` : `<p class="muted">${D.refs ? 'Nenhuma métrica principal mais de 5% abaixo da meta. 👏' : 'A comparação aparece quando a meta do elo terminar de ser montada.'}</p>`}
    ${I.patterns.length ? `<div class="sec-title">Padrões nas suas partidas</div><div class="imp">${I.patterns.map(p => `<div class="icard pat"><h4>${esc(p.title)}</h4><p>${esc(p.text)}</p></div>`).join('')}</div>` : ''}
    ${I.strong.length ? `<div class="sec-title">Seus pontos fortes</div><div class="imp">${I.strong.map(mc).join('')}</div>` : ''}
    ${refNote(D)}</section>
  ${stratCard(D)}`;
}

// ---------- Estratégias por rota (resumo dos vídeos) ----------
const toSec = m => { const [a, b] = String(m).split(':').map(Number); return a * 60 + (b || 0); };
const srcLink = s => `<a class="src" href="https://www.youtube.com/watch?v=${encodeURIComponent(s.video)}&t=${toSec(s.min)}s" target="_blank" rel="noopener">▶ ${esc(s.canal)} · ${esc(s.min)}</a>`;
function stratCard(D) {
  const lane = state.stratLane || D.profile.lane;
  const S = D.strats && D.strats[lane];
  if (!S) return '';
  return `<section class="card"><h3>Estratégias da rota <small>resumo de vídeos públicos · clique para abrir no minuto</small></h3>
    <div class="lanechips">${LANES.map(([k, n]) => `<button class="chip ${k === lane ? 'on' : ''}" data-strat="${k}"><img src="${laneIcon(k)}" alt="">${n}${k === D.profile.lane ? ' (sua)' : ''}</button>`).join('')}</div>
    <p class="lead2">${esc(S.resumo)}</p>
    ${S.fases.map(f => `<div class="sec-title">${esc(f.fase)}</div><ul class="strat">${f.itens.map(i => `<li><span>${esc(i.t)}</span>${srcLink(i)}</li>`).join('')}</ul>`).join('')}
    <p class="note">Fontes: Coach Turtle, Skill Capped, Tutu, Que Aula, Micão e Dioud (só vídeos públicos). Notas completas em guias/notas.md.</p></section>`;
}

// ---------- Informações da conta ----------
function accountTab(D) {
  const P = D.profile, s = D.view.snap, o = D.opgg, life = D.lifetime;
  const lad = o && o.ladder;
  const seasons = (o && o.seasons) || [];
  const first = seasons.length ? seasons[seasons.length - 1].season : null;
  const lifeTot = life ? life.seasons.reduce((a, x) => ({ p: a.p + x.play, w: a.w + x.win }), { p: 0, w: 0 }) : null;
  const divTxt = r => (r ? `${PT[r.tier] || r.tier}${APEX.includes(r.tier) ? '' : ' ' + (DIVS[4 - r.div] || '')}${r.lp != null && APEX.includes(r.tier) ? ` ${r.lp} PDL` : ''}` : 'Sem rank');
  const champsLife = life ? Object.entries(life.champs).map(([id, c]) => ({ id, ...c })).sort((a, b) => b.play - a.play).slice(0, 24) : [];
  const kpi = (l, v, sub = '') => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`;
  return `<section class="card"><h3>Informações da conta</h3>
    <div class="kpis">
      ${kpi('Nível', D.summoner ? D.summoner.level : '—')}
      ${kpi('Ladder BR', lad ? '#' + nf(lad.rank) : '—', lad ? `top ${nf(lad.ratio, 2)}% (op.gg)` : '')}
      ${kpi('Temporada atual', s ? `${s.w}V ${s.l}D` : '—', s ? pct(s.w / (s.w + s.l)) + ' de vitórias' : '')}
      ${kpi('Primeira ranqueada', first ? esc(first) : '—', 'temporada mais antiga com elo')}
      ${kpi('Ranqueadas na vida', lifeTot ? nf(lifeTot.p) : '—', lifeTot ? `${nf(lifeTot.w)}V ${nf(lifeTot.p - lifeTot.w)}D · ${pct(lifeTot.w / lifeTot.p)}` : 'carregue o histórico abaixo')}
    </div>

    <div class="sec-title">Elo em cada temporada (Solo/Duo)</div>
    ${seasons.length ? `<div class="seasons">${seasons.map(x => `<div class="season"><div class="sn">${esc(x.season)}</div><img src="${emblem(x.final ? x.final.tier : null)}" alt=""><div class="t">${esc(divTxt(x.final))}</div>${x.peak ? `<div class="pk">pico: ${esc(divTxt(x.peak))}</div>` : ''}</div>`).join('')}</div>` : '<p class="muted">Atualize as partidas para buscar no op.gg.</p>'}

    <div class="sec-title">Maestria (top 12)</div>
    <div class="mast">${D.mastery.map(m => `<div class="mitem"><img src="${img.champ(D, m.champId, '')}" alt=""><div><div>${esc((D.dd.champs[m.champId] || {}).name || m.champId)}</div><div class="p">${nf(m.points)} pts</div><div class="s">nível ${m.level}</div></div></div>`).join('') || '<p class="muted">—</p>'}</div>

    <div class="sec-title">Partidas ranqueadas por campeão (toda a conta)</div>
    ${life ? `<div class="scroll"><table class="ctable"><tr><th>Campeão</th><th>Partidas</th><th>Vitórias</th><th>Winrate</th></tr>${champsLife.map(c => `<tr><td><img src="${img.champ(D, c.id, '')}" alt="">${esc((D.dd.champs[c.id] || {}).name || c.id)}</td><td>${nf(c.play)}</td><td>${nf(c.win)}</td><td class="${c.win / c.play >= .5 ? 'up' : 'down'}">${pct(c.win / c.play)}</td></tr>`).join('')}</table></div>
      <p class="note">Soma de ${life.seasons.length} temporadas no op.gg (Solo/Duo). ${ago(life.at)}.</p>` : ''}
    <button class="btn ${life ? 'ghost small' : 'primary'}" id="lifeBtn" ${D.lifeJob && D.lifeJob.state === 'running' ? 'disabled' : ''}>${D.lifeJob && D.lifeJob.state === 'running' ? '<span class="spin"></span>Lendo…' : life ? 'Recarregar histórico' : 'Carregar histórico completo (op.gg, ~30 s)'}</button>
  </section>
  <section class="card"><h3>Preferências do perfil</h3>
    <form id="prefForm" style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
      <div class="field" style="margin:0"><label>Rota principal</label><select name="lane" class="text" style="width:auto">${LANES.map(([k, n]) => `<option value="${k}" ${P.lane === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field" style="margin:0"><label>Partidas por semana</label><input name="gpw" type="number" min="1" max="140" class="text" style="width:120px" value="${P.gpw}"></div>
      <button class="btn primary">Salvar</button></form></section>`;
}

// ---------- início ----------
(function start() {
  const m = location.hash.match(/^#\/p\/(\w+)/);
  if (m) { state.view = 'dash'; state.id = m[1]; }
  else if (location.hash === '#/novo') state.view = 'new';
  render();
})();
