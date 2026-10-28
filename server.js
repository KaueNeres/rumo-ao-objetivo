// Servidor local do app (sem dependências: só Node). Abre em http://localhost:5177
// Guarda a chave da Riot aqui no computador e faz as chamadas à API quando a página pede.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { api, pending } = require('./lib/riot');
const dd = require('./lib/dd');
const opgg = require('./lib/opgg');
const M = require('./lib/model');
const { STRATS } = require('./lib/estrategias');

const PORT = Number(process.env.PORT) || 5177;
const DATA = path.join(__dirname, 'data');
const PUB = path.join(__dirname, 'public');
fs.mkdirSync(DATA, { recursive: true });

// ---------- armazenamento em arquivos JSON ----------
const file = n => path.join(DATA, n);
const readJson = (n, def) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return def; } };
const writeJson = (n, v) => { fs.writeFileSync(file(n) + '.tmp', JSON.stringify(v)); fs.renameSync(file(n) + '.tmp', file(n)); };
const profiles = () => readJson('profiles.json', []);
const saveProfiles = list => writeJson('profiles.json', list);
const getProfile = id => profiles().find(p => p.id === id);
const store = id => readJson(`p_${id}.json`, { games: {}, snaps: [] });
const saveStore = (id, s) => writeJson(`p_${id}.json`, s);
const rankCache = readJson('rankcache.json', {});
const saveRankCache = () => writeJson('rankcache.json', rankCache);
const refKey = g => (M.APEX.includes(g.tier) ? g.tier : `${g.tier}_${g.div}`);
const refs = key => readJson(`refs_${key}.json`, null);

// ---------- tarefas em andamento (a página consulta o progresso) ----------
const jobs = {}; // id do perfil → { state, step, done, total, error }
const refJobs = {}; // chave do elo → { state, step, done, total }
const setJob = (id, o) => { jobs[id] = { ...(jobs[id] || {}), ...o, at: Date.now() }; };

const solo = list => (list || []).find(e => e.queueType === 'RANKED_SOLO_5x5');
const RANK_TTL = 6 * 3600e3;

async function rankOf(puuid) {
  const c = rankCache[puuid];
  if (c && Date.now() - c.at < RANK_TTL) return c.s;
  const e = solo(await api.league(puuid));
  const s = e ? M.score(e.tier, e.rank, e.leaguePoints) : null;
  rankCache[puuid] = { s, at: Date.now() };
  return s;
}

// Ouro, CS e XP contra o oponente direto aos 14 min (da linha do tempo)
function laneAt14(tl, me, opp) {
  if (!tl || !opp) return null;
  const f = tl.info.frames[Math.min(14, tl.info.frames.length - 1)];
  if (!f) return null;
  const a = f.participantFrames[me.participantId], b = f.participantFrames[opp.participantId];
  if (!a || !b) return null;
  const cs = x => x.minionsKilled + x.jungleMinionsKilled;
  const gd14 = a.totalGold - b.totalGold, csd14 = cs(a) - cs(b), xpd14 = a.xp - b.xp;
  const sc = gd14 + xpd14 * 0.5;
  const grade = sc >= 1000 ? 'S' : sc >= 400 ? 'A' : sc >= -400 ? 'B' : sc >= -1000 ? 'C' : 'D';
  return { gd14, csd14, xpd14, grade };
}

function gameRecord(m, tl, puuid) {
  const info = m.info, p = info.participants.find(x => x.puuid === puuid);
  if (!p) return null;
  const opp = p.teamPosition ? info.participants.find(x => x.teamId !== p.teamId && x.teamPosition === p.teamPosition) : null;
  const st = p.perks && p.perks.styles || [];
  return {
    id: m.metadata.matchId, t: info.gameCreation, dur: info.gameDuration, win: p.win,
    remake: info.gameDuration < 300 || !!p.gameEndedInEarlySurrender,
    champ: p.championName, champId: p.championId, pos: p.teamPosition || null,
    items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5], trinket: p.item6, quest: p.roleBoundItem || 0,
    spells: [p.summoner1Id, p.summoner2Id],
    keystone: st[0] && st[0].selections[0] ? st[0].selections[0].perk : null, sub: st[1] ? st[1].style : null,
    m: M.metricsOf(p, info), lane: laneAt14(tl, p, opp),
    players: info.participants.map(x => ({ name: x.riotIdGameName || x.summonerName, tag: x.riotIdTagline || '', champ: x.championName, champId: x.championId,
      team: x.teamId === p.teamId, me: x.puuid === puuid, pos: x.teamPosition, k: x.kills, d: x.deaths, a: x.assists, puuid: x.puuid })),
    lobby: null, ally: null, enemy: null, delta: null, deltaKind: null, before: null,
  };
}

// ---------- atualizar partidas de um perfil ----------
async function update(id, { more = false } = {}) {
  const prof = getProfile(id);
  if (!prof) throw new Error('Perfil não encontrado');
  if (jobs[id] && jobs[id].state === 'running') return;
  setJob(id, { state: 'running', step: 'Buscando conta…', done: 0, total: 0, error: null });
  try {
    const s = store(id);
    if (!prof.puuid) {
      const acc = await api.account(prof.gameName, prof.tagLine);
      if (!acc) throw new Error('Conta não encontrada');
      prof.puuid = acc.puuid;
      saveProfiles(profiles().map(p => (p.id === id ? { ...p, puuid: acc.puuid } : p)));
    }
    setJob(id, { step: 'Lendo elo atual…' });
    const [sum, lg] = [await api.summoner(prof.puuid), await api.league(prof.puuid)];
    if (sum) s.summoner = { level: sum.summonerLevel, icon: sum.profileIconId };
    const me = solo(lg);
    const prev = s.snaps[s.snaps.length - 1];
    let snap = null;
    if (me) {
      snap = { at: Date.now(), score: M.score(me.tier, me.rank, me.leaguePoints), tier: me.tier, rank: me.rank, lp: me.leaguePoints, w: me.wins, l: me.losses };
      if (!prev || prev.score !== snap.score || prev.w !== snap.w || prev.l !== snap.l) s.snaps.push(snap);
    }
    // IDs: na primeira vez 15 partidas; depois, só as novas (até 20). "Carregar mais" busca 15 mais antigas.
    const have = Object.keys(s.games).length;
    const ids = more ? await api.ids(prof.puuid, 15, have) : await api.ids(prof.puuid, have ? 20 : 15);
    const fresh = (ids || []).filter(x => !s.games[x]);
    setJob(id, { total: fresh.length, done: 0 });
    let n = 0;
    for (const mid of fresh) {
      setJob(id, { step: `Baixando partida ${++n} de ${fresh.length}…`, done: n - 1 });
      const m = await api.match(mid);
      if (!m) continue;
      const g0 = m.info.participants.find(x => x.puuid === prof.puuid);
      const tl = g0 && m.info.gameDuration >= 300 ? await api.timeline(mid) : null;
      const g = gameRecord(m, tl, prof.puuid);
      if (g) { s.games[mid] = g; saveStore(id, s); }
    }
    // PDL exato da última partida: quando vitórias+derrotas aumentaram exatamente 1 desde a leitura anterior
    if (prev && snap && !more) {
      const played = snap.w + snap.l - (prev.w + prev.l);
      const newer = Object.values(s.games).filter(g => g.t > prev.at - 3 * 3600e3 && g.delta == null && !g.remake).sort((a, b) => b.t - a.t);
      if (played === 1 && newer.length >= 1) Object.assign(newer[0], { delta: snap.score - prev.score, deltaKind: 'exato', before: prev.score });
    }
    // Elo dos outros 9 jogadores (para o MMR estimado)
    const need = Object.values(s.games).filter(g => g.lobby == null && !g.remake);
    let k = 0;
    for (const g of need) {
      setJob(id, { step: `Calculando MMR: elo dos jogadores da partida ${++k} de ${need.length}…`, done: k - 1, total: need.length });
      const rk = [];
      for (const pl of g.players) if (!pl.me && pl.puuid) rk.push({ team: pl.team, s: await rankOf(pl.puuid) });
      g.lobby = M.mean(rk.map(x => x.s)); g.ally = M.mean(rk.filter(x => x.team).map(x => x.s)); g.enemy = M.mean(rk.filter(x => !x.team).map(x => x.s));
      saveStore(id, s); saveRankCache();
    }
    setJob(id, { step: 'Maestria e ladder…' });
    const mastery = await api.mastery(prof.puuid);
    if (mastery) s.mastery = mastery.map(x => ({ champId: x.championId, level: x.championLevel, points: x.championPoints, last: x.lastPlayTime }));
    try { s.opgg = await opgg.profile(prof.gameName, prof.tagLine); } catch { /* op.gg fora do ar: segue sem ladder */ }
    s.updated = Date.now();
    saveStore(id, s);
    setJob(id, { state: 'done', step: 'Atualizado', done: 1, total: 1 });
    ensureRefs(prof.goal);
  } catch (e) {
    setJob(id, { state: 'error', error: e.message, step: 'Erro' });
  }
}

// ---------- referência do elo objetivo: amostra de partidas de jogadores daquele elo ----------
const REF_PLAYERS = 30, REF_MATCHES_PER = 8, REF_TTL = 4 * 864e5;
function ensureRefs(goal) {
  if (!goal) return;
  const key = refKey(goal);
  const r = refs(key);
  if (r && !r.partial && Date.now() - r.at < REF_TTL) return;
  if (refJobs[key] && refJobs[key].state === 'running') return;
  buildRefs(goal, key);
}
async function buildRefs(goal, key) {
  refJobs[key] = { state: 'running', step: 'Escolhendo jogadores do elo…', done: 0, total: 0 };
  try {
    let entries;
    if (M.APEX.includes(goal.tier)) entries = ((await api.apex(goal.tier, 1)) || {}).entries || [];
    else entries = (await api.tierEntries(goal.tier, goal.div, 1, 1)) || [];
    entries = entries.filter(e => e.puuid).sort(() => Math.random() - 0.5).slice(0, REF_PLAYERS);
    const ids = new Set();
    let i = 0;
    for (const e of entries) {
      refJobs[key] = { state: 'running', step: `Lendo histórico do jogador ${++i} de ${entries.length}…`, done: i, total: entries.length + entries.length * REF_MATCHES_PER };
      for (const x of (await api.ids(e.puuid, REF_MATCHES_PER, 0, 1)) || []) ids.add(x);
    }
    const out = { key, at: Date.now(), matches: 0, samples: 0, byChamp: {}, byPos: {} };
    let j = 0;
    for (const mid of ids) {
      refJobs[key] = { state: 'running', step: `Lendo partida ${++j} de ${ids.size}…`, done: entries.length + j, total: entries.length + ids.size };
      const m = await api.match(mid, 1);
      if (!m || m.info.gameDuration < 900 || m.info.queueId !== 420) continue;
      out.matches++;
      for (const p of m.info.participants) {
        if (!p.teamPosition) continue;
        const mt = M.metricsOf(p, m.info);
        const ck = `${p.championName}|${p.teamPosition}`;
        M.addSample(out.byChamp[ck] = out.byChamp[ck] || M.emptyBucket(), mt, p.win);
        M.addSample(out.byPos[p.teamPosition] = out.byPos[p.teamPosition] || M.emptyBucket(), mt, p.win);
        out.samples++;
      }
      if (out.matches % 10 === 0) writeJson(`refs_${key}.json`, { ...out, partial: true });
    }
    writeJson(`refs_${key}.json`, out);
    refJobs[key] = { state: 'done', step: `${out.matches} partidas · ${out.samples} jogadores`, done: 1, total: 1 };
  } catch (e) {
    refJobs[key] = { state: 'error', step: e.message };
  }
}

// ---------- histórico completo da conta (op.gg, todas as temporadas) ----------
const lifeJobs = {};
async function lifetime(id) {
  const prof = getProfile(id);
  if (!prof || (lifeJobs[id] && lifeJobs[id].state === 'running')) return;
  lifeJobs[id] = { state: 'running', step: 'Começando…' };
  try {
    const life = await opgg.lifetime(prof.gameName, prof.tagLine, sid => { lifeJobs[id] = { state: 'running', step: `Lendo temporada (id ${sid}) no op.gg…` }; });
    const s = store(id); s.lifetime = life; saveStore(id, s);
    lifeJobs[id] = { state: 'done' };
  } catch (e) { lifeJobs[id] = { state: 'error', step: e.message }; }
}

// ---------- dados completos para a página ----------
async function dashboard(id) {
  const prof = getProfile(id);
  if (!prof) return null;
  const s = store(id);
  const key = prof.goal ? refKey(prof.goal) : null;
  const r = key ? refs(key) : null;
  const view = M.build(prof, s, r);
  const d = await dd.load();
  return {
    profile: prof, dd: { v: d.v, champs: d.champs, spells: d.spells, perks: d.perks },
    summoner: s.summoner || null, opgg: s.opgg || null, mastery: s.mastery || [], lifetime: s.lifetime || null,
    updated: s.updated || null, view, metrics: M.METRICS, lanePt: M.LANE_PT, strats: STRATS,
    refs: r ? { key, at: r.at, matches: r.matches, samples: r.samples, partial: !!r.partial } : null,
    refJob: key ? refJobs[key] || null : null, job: jobs[id] || null, lifeJob: lifeJobs[id] || null,
  };
}

// ---------- HTTP ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(r => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
const validGoal = g => g && M.TIERS.includes(g.tier) && (M.APEX.includes(g.tier) ? Number.isFinite(Number(g.lp)) : M.DIVS.includes(g.div));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (parts[0] === 'api') {
      const [, what, id, action] = parts;
      if (what === 'profiles' && !id && req.method === 'GET') {
        return send(res, 200, profiles().map(p => {
          const s = store(p.id), snap = s.snaps[s.snaps.length - 1];
          return { ...p, elo: snap ? M.label(snap.score) : null, tier: snap ? snap.tier : null, icon: s.summoner ? s.summoner.icon : null, goalScore: p.goal ? M.score(p.goal.tier, p.goal.div, p.goal.lp) : null, score: snap ? snap.score : null };
        }));
      }
      if (what === 'account' && req.method === 'GET') { // valida Nick#tag antes de criar o perfil
        const [name, tag] = [url.searchParams.get('name'), url.searchParams.get('tag')];
        const acc = await api.account(name, tag);
        if (!acc) return send(res, 404, { error: 'Conta não encontrada. Confira o Nick e a #.' });
        const lg = solo(await api.league(acc.puuid));
        return send(res, 200, { gameName: acc.gameName, tagLine: acc.tagLine, elo: lg ? M.label(M.score(lg.tier, lg.rank, lg.leaguePoints)) : 'Sem ranqueada solo', tier: lg ? lg.tier : null });
      }
      if (what === 'profiles' && req.method === 'POST' && !id) {
        const b = await body(req);
        if (!b.gameName || !b.tagLine || !validGoal(b.goal) || !M.LANE_KEYS[b.lane]) return send(res, 400, { error: 'Dados incompletos' });
        const list = profiles();
        const p = { id: Date.now().toString(36), gameName: b.gameName, tagLine: b.tagLine, goal: b.goal, lane: b.lane, gpw: Math.max(1, Math.min(140, Number(b.gpw) || 21)), created: Date.now(), manual: {} };
        list.push(p); saveProfiles(list);
        update(p.id);
        return send(res, 200, p);
      }
      if (what === 'profiles' && id && req.method === 'PATCH') {
        const b = await body(req);
        const list = profiles(); const p = list.find(x => x.id === id);
        if (!p) return send(res, 404, { error: 'Perfil não encontrado' });
        if (b.goal) { if (!validGoal(b.goal)) return send(res, 400, { error: 'Objetivo inválido' }); p.goal = b.goal; ensureRefs(p.goal); }
        if (b.lane && M.LANE_KEYS[b.lane]) p.lane = b.lane;
        if (b.gpw) p.gpw = Math.max(1, Math.min(140, Number(b.gpw)));
        if (b.manual) p.manual = { ...p.manual, ...b.manual };
        saveProfiles(list);
        return send(res, 200, p);
      }
      if (what === 'profiles' && id && req.method === 'DELETE') {
        saveProfiles(profiles().filter(x => x.id !== id));
        try { fs.unlinkSync(file(`p_${id}.json`)); } catch { /* já não existia */ }
        return send(res, 200, { ok: true });
      }
      if (what === 'profiles' && id && action === 'update' && req.method === 'POST') { update(id, { more: url.searchParams.get('more') === '1' }); return send(res, 200, { ok: true }); }
      if (what === 'profiles' && id && action === 'lifetime' && req.method === 'POST') { lifetime(id); return send(res, 200, { ok: true }); }
      if (what === 'profiles' && id && action === 'status') { const p = getProfile(id); const key = p && p.goal ? refKey(p.goal) : null; return send(res, 200, { job: jobs[id] || null, refJob: key ? refJobs[key] || null : null, lifeJob: lifeJobs[id] || null, queue: pending() }); }
      if (what === 'profiles' && id && req.method === 'GET') { const d = await dashboard(id); return d ? send(res, 200, d) : send(res, 404, { error: 'Perfil não encontrado' }); }
      return send(res, 404, { error: 'Rota desconhecida' });
    }
    // Arquivos da página
    let f = path.normalize(path.join(PUB, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(PUB, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`App LoL rodando em http://localhost:${PORT}  (feche esta janela para desligar)`);
  for (const p of profiles()) if (p.goal) ensureRefs(p.goal);
});
