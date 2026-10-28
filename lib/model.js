// Cálculos: escala de elo, métricas de partida, MMR estimado, previsão de PDL, metas e pontos a melhorar.

// ---------- escala de elo: Ferro IV 0 = 0, cada divisão +100, cada tier +400, Mestre 0 = 2800 ----------
const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
const APEX = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];
const DIVS = ['IV', 'III', 'II', 'I'];
const PT = { IRON: 'Ferro', BRONZE: 'Bronze', SILVER: 'Prata', GOLD: 'Ouro', PLATINUM: 'Platina', EMERALD: 'Esmeralda', DIAMOND: 'Diamante', MASTER: 'Mestre', GRANDMASTER: 'Grão-Mestre', CHALLENGER: 'Desafiante' };

function score(tier, div, lp) {
  if (!tier) return null;
  if (APEX.includes(tier)) return 2800 + (lp || 0);
  return TIERS.indexOf(tier) * 400 + DIVS.indexOf(div) * 100 + (lp || 0);
}
function label(s) {
  if (s == null) return '—';
  s = Math.round(s);
  if (s >= 2800) return `Mestre+ ${s - 2800} PDL`;
  const t = TIERS[Math.floor(s / 400)], d = DIVS[Math.floor((s % 400) / 100)];
  return `${PT[t]} ${d} ${s % 100} PDL`;
}
const tierOf = s => (s == null ? null : s >= 2800 ? 'MASTER' : TIERS[Math.floor(s / 400)]);

// ---------- métricas de uma participação (as mesmas para você e para a referência do elo) ----------
const METRICS = {
  k: { label: 'Abates', dec: 1 },
  d: { label: 'Mortes', dec: 1, lower: true },
  a: { label: 'Assistências', dec: 1 },
  kda: { label: 'KDA', dec: 2 },
  csMin: { label: 'CS/min', dec: 1 },
  cs10: { label: 'CS aos 10 min', dec: 0 },
  gpm: { label: 'Ouro/min', dec: 0 },
  dpm: { label: 'Dano/min', dec: 0 },
  dmgShare: { label: '% do dano do time', dec: 0, unit: '%' },
  kp: { label: 'Part. em abates', dec: 0, unit: '%' },
  vpm: { label: 'Visão/min', dec: 2 },
  cw: { label: 'Control wards', dec: 1 },
  wk: { label: 'Wards destruídas', dec: 1 },
  laneWin: { label: 'Rota dominada aos 14 min', dec: 0, unit: '%' },
  solo: { label: 'Abates solo', dec: 1 },
};
// Números principais por rota (resumo e "o que desenvolver")
const LANE_KEYS = {
  TOP: ['csMin', 'cs10', 'dpm', 'd', 'laneWin', 'solo'],
  JUNGLE: ['kp', 'csMin', 'cs10', 'd', 'vpm', 'dpm'],
  MIDDLE: ['csMin', 'cs10', 'dpm', 'kp', 'd', 'laneWin'],
  BOTTOM: ['csMin', 'cs10', 'dpm', 'gpm', 'd', 'laneWin'],
  UTILITY: ['vpm', 'cw', 'kp', 'd', 'a', 'laneWin'],
};
const LANE_PT = { TOP: 'Topo', JUNGLE: 'Selva', MIDDLE: 'Meio', BOTTOM: 'Atirador', UTILITY: 'Suporte' };

function metricsOf(p, info) {
  const min = Math.max(1, info.gameDuration / 60), c = p.challenges || {};
  return {
    k: p.kills, d: p.deaths, a: p.assists,
    kda: (p.kills + p.assists) / Math.max(1, p.deaths),
    csMin: (p.totalMinionsKilled + p.neutralMinionsKilled) / min,
    cs10: p.teamPosition === 'JUNGLE' ? (c.jungleCsBefore10Minutes || 0) * 1 + (c.laneMinionsFirst10Minutes || 0) : c.laneMinionsFirst10Minutes ?? null,
    gpm: p.goldEarned / min,
    dpm: p.totalDamageDealtToChampions / min,
    dmgShare: c.teamDamagePercentage != null ? c.teamDamagePercentage * 100 : null,
    kp: c.killParticipation != null ? c.killParticipation * 100 : null,
    vpm: p.visionScore / min,
    cw: p.visionWardsBoughtInGame,
    wk: p.wardsKilled,
    laneWin: c.laningPhaseGoldExpAdvantage != null ? c.laningPhaseGoldExpAdvantage * 100 : null,
    solo: c.soloKills ?? null,
  };
}

const mean = a => { a = a.filter(v => typeof v === 'number' && isFinite(v)); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null; };

// ---------- referência do elo objetivo ----------
// Por campeão+rota quando há amostra suficiente; senão, média da rota naquele elo.
const MIN_CHAMP_SAMPLE = 6;
function refFor(refs, champ, pos) {
  if (!refs) return null;
  const c = refs.byChamp[`${champ}|${pos}`];
  if (c && c.n >= MIN_CHAMP_SAMPLE) return { ...avgOf(c), n: c.n, scope: 'campeão' };
  const p = refs.byPos[pos];
  if (p && p.n) return { ...avgOf(p), n: p.n, scope: 'rota' };
  return null;
}
function avgOf(b) { const o = {}; for (const k in b.sum) o[k] = b.cnt[k] ? b.sum[k] / b.cnt[k] : null; o.wr = b.w / b.n; return o; }
function addSample(b, m, win) {
  b.n++; if (win) b.w++;
  for (const k in m) if (typeof m[k] === 'number' && isFinite(m[k])) { b.sum[k] = (b.sum[k] || 0) + m[k]; b.cnt[k] = (b.cnt[k] || 0) + 1; }
}
const emptyBucket = () => ({ n: 0, w: 0, sum: {}, cnt: {} });

// ---------- regressão linear simples (calibra o PDL com as suas partidas) ----------
function fit(xs, ys) {
  const n = xs.length; if (n < 3) return null;
  const mx = mean(xs), my = mean(ys); let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxx ? sxy / sxx : 0; return { a: my - b * mx, b, n };
}

const MMR_WINDOW = 15, K = 20, DAY_CUTOFF_H = 6;
const SEASON_END = Date.parse('2026-11-15T02:59:59Z'); // 14/11/2026 23:59:59 (Brasília)
const brDay = t => new Date(t - (3 + DAY_CUTOFF_H) * 3600e3).toISOString().slice(0, 10);
function weekStart(t) { // segunda-feira da semana (Brasília, virada às 6h)
  const d = new Date(brDay(t) + 'T00:00:00Z'); const wd = (d.getUTCDay() + 6) % 7;
  return new Date(d - wd * 864e5).toISOString().slice(0, 10);
}

// ---------- monta tudo o que o painel mostra ----------
function build(profile, store, refs) {
  const snaps = store.snaps || [];
  const snap = snaps[snaps.length - 1] || null;
  const all = Object.values(store.games || {}).sort((a, b) => b.t - a.t);
  const games = all.filter(g => !g.remake);

  // MMR: média móvel do elo dos outros 9 jogadores
  games.forEach((g, i) => { g.mmr = mean(games.slice(i, i + MMR_WINDOW).map(x => x.lobby)); });
  const cur = snap ? snap.score : null;
  const mmrNow = games.length && games[0].mmr != null ? games[0].mmr : cur;
  const gapNow = mmrNow != null && cur != null ? mmrNow - cur : 0;

  const exact = games.filter(g => g.deltaKind === 'exato' && g.before != null && g.mmr != null);
  const W = exact.filter(g => g.win), L = exact.filter(g => !g.win);
  const fw = W.length >= 3 ? fit(W.map(g => g.mmr - g.before), W.map(g => g.delta)) : null;
  const fl = L.length >= 3 ? fit(L.map(g => g.mmr - g.before), L.map(g => -g.delta)) : null;
  const clamp = v => Math.max(8, Math.min(35, v));
  const gain = gap => clamp(fw ? fw.a + fw.b * gap : 20 + gap / 20);
  const loss = gap => clamp(fl ? fl.a + fl.b * gap : 20 - gap / 20);
  const next = { win: gain(gapNow), loss: loss(gapNow) };
  const breakeven = next.loss / (next.win + next.loss);

  // Elo antes de cada partida: exato quando medido, estimado (pela fórmula) quando não
  let after = cur;
  for (const g of games) {
    if (after == null) break;
    g.after = after;
    if (g.deltaKind === 'exato' && g.before != null) { g.estDelta = g.delta; after = g.before; }
    else {
      const gap = (g.mmr ?? after) - after;
      g.estDelta = Math.round(g.win ? gain(gap) : -loss(gap));
      after = after - g.estDelta;
    }
    g.eloBefore = after;
  }

  const goal = profile.goal ? score(profile.goal.tier, profile.goal.div, profile.goal.lp) : null;
  function project(p, target) {
    let s = cur, mmr = mmrNow ?? cur;
    for (let i = 1; i <= 4000; i++) {
      const gap = mmr - s; s += p * gain(gap) - (1 - p) * loss(gap); mmr += K * (p - 0.5);
      if (s >= target) return i;
    }
    return null;
  }
  function reqWR(N, target) {
    if (cur == null || target == null) return null;
    if (cur >= target) return 0;
    if (N <= 0) return null;
    let lo = 0.30, hi = 0.90;
    const top = project(hi, target); if (top == null || top > N) return null;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; const g = project(mid, target); if (g != null && g <= N) hi = mid; else lo = mid; }
    return hi;
  }

  // Metas a partir das partidas por semana
  const now = Date.now();
  const daysLeft = Math.max(0, Math.ceil((SEASON_END - now) / 864e5));
  const gpw = Math.max(1, Number(profile.gpw) || 21);
  const perDay = gpw / 7;
  const totalGames = Math.round(perDay * daysLeft);
  const wrNeed = reqWR(totalGames, goal);
  const todayKey = brDay(now);
  const today = games.filter(g => brDay(g.t) === todayKey);
  const tw = today.filter(g => g.win).length, tl = today.length - tw;
  const block = Math.max(1, Math.round(perDay));
  const dayGames = Math.max(block, Math.ceil(today.length / block) * block);
  const dayWins = wrNeed == null ? null : Math.ceil(wrNeed * dayGames - 1e-9);
  const wk = weekStart(now);
  const week = games.filter(g => weekStart(g.t) === wk);
  const weekW = week.filter(g => g.win).length;
  const goals = {
    goal, goalLabel: goal != null ? goalText(profile.goal) : '—', daysLeft, gpw, totalGames, wrNeed,
    seasonEnd: SEASON_END, reached: cur != null && goal != null && cur >= goal,
    today: { w: tw, l: tl, games: dayGames, wins: dayWins, maxLoss: dayWins == null ? null : dayGames - dayWins,
      pdl: today.reduce((s, g) => s + (g.estDelta || 0), 0) },
    week: { w: weekW, l: week.length - weekW, games: gpw, wins: wrNeed == null ? null : Math.ceil(wrNeed * gpw - 1e-9) },
    alt: [0.5, 1, 1.5, 2].map(f => { const g = Math.round(gpw * f); return { gpw: g, games: Math.round(g / 7 * daysLeft), wr: reqWR(Math.round(g / 7 * daysLeft), goal) }; }),
  };

  // Sessões (um dia de jogo, com virada às 6h)
  const sessions = [];
  for (const g of all) {
    const key = brDay(g.t);
    let s = sessions.find(x => x.key === key);
    if (!s) sessions.push(s = { key, games: [] });
    s.games.push(g);
  }
  for (const s of sessions) {
    const ok = s.games.filter(g => !g.remake);
    s.w = ok.filter(g => g.win).length; s.l = ok.length - s.w;
    s.pdl = ok.reduce((a, g) => a + (g.estDelta || 0), 0);
    s.pdlExact = ok.every(g => g.deltaKind === 'exato');
    const first = ok[ok.length - 1], lastG = ok[0];
    const prevIdx = first ? games.indexOf(first) + 1 : -1;
    const prevMmr = prevIdx > 0 && games[prevIdx] ? games[prevIdx].mmr : null;
    s.mmr = lastG && lastG.mmr != null && prevMmr != null ? lastG.mmr - prevMmr : null;
  }

  // Referência por partida e resumo da rota principal
  const lane = profile.lane || 'UTILITY';
  for (const g of all) g.ref = refFor(refs, g.champ, g.pos);
  const laneGames = games.filter(g => g.pos === lane).slice(0, 20);
  const basis = laneGames.length >= 3 ? laneGames : games.slice(0, 20);
  const summary = (LANE_KEYS[lane] || LANE_KEYS.UTILITY).map(k => ({
    key: k, ...METRICS[k], you: mean(basis.map(g => g.m[k])), ref: mean(basis.map(g => g.ref && g.ref[k])),
  }));
  const recent = games.slice(0, 20);

  // Por campeão
  const byChamp = {};
  for (const g of games) (byChamp[g.champ] = byChamp[g.champ] || []).push(g);
  const champs = Object.entries(byChamp).map(([champ, gs]) => {
    const pos = mode(gs.map(g => g.pos));
    const m = {}; for (const k in METRICS) m[k] = mean(gs.map(g => g.m[k]));
    return { champ, champId: gs[0].champId, pos, n: gs.length, w: gs.filter(g => g.win).length, m, ref: refFor(refs, champ, pos) };
  }).sort((a, b) => b.n - a.n);

  return {
    snap, cur, curLabel: label(cur), mmrNow, mmrLabel: label(mmrNow), gapNow, next, breakeven,
    model: fw && fl ? 'calibrada' : 'padrão', exactCount: exact.length,
    wr20: recent.length ? recent.filter(g => g.win).length / recent.length : null,
    seasonWR: snap && snap.w + snap.l ? snap.w / (snap.w + snap.l) : null,
    lastDelta: games[0] ? { v: games[0].estDelta, exact: games[0].deltaKind === 'exato' } : null,
    mmrDelta: games.length > 1 && games[0].mmr != null && games[1].mmr != null ? games[0].mmr - games[1].mmr : null,
    goals, sessions, summary, laneUsed: laneGames.length >= 3 ? lane : null, champs,
    improve: improve(profile, games, summary, champs),
    chart: games.slice(0, 60).reverse().map(g => ({ t: g.t, elo: g.after, mmr: g.mmr, win: g.win, champ: g.champ, exact: g.deltaKind === 'exato' })),
  };
}

function goalText(goal) {
  if (APEX.includes(goal.tier)) return `${PT[goal.tier]} ${goal.lp || 0} PDL`;
  return `${PT[goal.tier]} ${goal.div}`;
}
const mode = a => { const c = {}; let best = null; for (const x of a) { c[x] = (c[x] || 0) + 1; if (best == null || c[x] > c[best]) best = x; } return best; };

// ---------- pontos a melhorar ----------
const { metricTip } = require('./estrategias');
const TIPS = {
  d: 'Morrer menos vale mais que qualquer outra métrica: antes de avançar, conte quantos inimigos não aparecem no mapa. Sem visão do caçador e do meio, jogue para trás da sua tropa.',
  csMin: 'Entre as lutas, volte para a rota com mais tropas. Depois dos 14 min, empurre a rota lateral só até o meio do mapa e volte para o grupo (não fique farmando sozinho).',
  cs10: 'Pratique o último golpe (last hit) no modo prática: meta de 70+ CS aos 10 min para rotas, 60+ para selva. Não troque dano com o inimigo perdendo tropa de canhão.',
  dpm: 'Fique perto das lutas: após os 14 min agrupe no meio com o time e use as rotas laterais só para empurrar ondas grandes.',
  gpm: 'Ouro vem de tropas, placas e objetivos. Use as lutas vencidas para derrubar torres em vez de voltar para a base.',
  kp: 'Acompanhe os objetivos (dragão, arauto, barão) 40 s antes de nascerem e chegue antes do inimigo. Participar das lutas é mais valioso que farmar sozinho.',
  vpm: 'Compre sentinela de controle a cada volta para a base e troque o amuleto para a Lente quando terminar o item de suporte. Proteja a visão dos objetivos.',
  cw: 'Tenha sempre 1 sentinela de controle no inventário. Use-a no rio ou na selva inimiga antes dos objetivos.',
  a: 'Esteja junto do caçador nas jogadas e acompanhe o meio após a rota. Rotacione ao meio quando a sua rota estiver empurrada.',
  laneWin: 'Ganhe a rota com controle de onda: empurre antes do caçador inimigo aparecer, faça trocas quando o inimigo for pegar tropa e volte para a base com a onda empurrada.',
  solo: 'Procure trocas quando o inimigo usar a habilidade principal ou estiver com pouca mana. Conheça os níveis em que o seu campeão ganha a troca (2, 3 e 6).',
  wk: 'Compre Lente e limpe a visão antes dos objetivos.',
  dmgShare: 'Posicione-se para usar o combo completo nas lutas e não entre primeiro se o seu campeão não for o iniciador.',
};

function improve(profile, games, summary, champs) {
  const pts = [];
  for (const s of summary) {
    if (s.you == null || s.ref == null || !s.ref) continue;
    const gap = s.lower ? (s.ref - s.you) / s.ref : (s.you - s.ref) / s.ref;
    const src = metricTip(s.key, profile.lane || 'UTILITY');
    pts.push({ kind: 'metric', key: s.key, title: s.label, you: s.you, ref: s.ref, gap, unit: s.unit || '', dec: s.dec, tip: src ? src.t : TIPS[s.key] || '', src });
  }
  pts.sort((a, b) => a.gap - b.gap);
  const metrics = pts.filter(p => p.gap < -0.05).slice(0, 4);
  const strong = pts.filter(p => p.gap > 0.05).sort((a, b) => b.gap - a.gap).slice(0, 3);

  const patterns = [];
  const recent = games.slice(0, 30);
  const wins = recent.filter(g => g.win), losses = recent.filter(g => !g.win);
  const dW = mean(wins.map(g => g.m.d)), dL = mean(losses.map(g => g.m.d));
  if (dW != null && dL != null && dL - dW >= 2) patterns.push({ title: 'Mortes nas derrotas', text: `Nas derrotas você morre em média ${dL.toFixed(1)} vezes contra ${dW.toFixed(1)} nas vitórias. As derrotas começam nas mortes evitáveis: jogue a fase seguinte à primeira morte com mais cuidado.` });
  const ahead = recent.filter(g => g.lane && g.lane.gd14 != null && g.lane.gd14 >= 300);
  if (ahead.length >= 3) {
    const aw = ahead.filter(g => g.win).length;
    if (aw / ahead.length < 0.6) patterns.push({ title: 'Vantagem de rota não convertida', text: `Em ${ahead.length} partidas você saiu da rota com +300 de ouro aos 14 min e venceu só ${aw}. Depois da rota, junte com o time no meio e use a vantagem em objetivos (dragão, arauto, torres) em vez de ficar na rota lateral.` });
  }
  // Sequências: winrate depois de 2 derrotas seguidas no mesmo dia
  const chron = [...games].reverse(); let after2 = 0, after2w = 0;
  for (let i = 2; i < chron.length; i++) {
    const a = chron[i - 2], b = chron[i - 1];
    if (!a.win && !b.win && brDay(a.t) === brDay(chron[i].t)) { after2++; if (chron[i].win) after2w++; }
  }
  if (after2 >= 3 && after2w / after2 < 0.45) patterns.push({ title: 'Jogar depois de 2 derrotas', text: `Depois de 2 derrotas seguidas no mesmo dia você venceu ${after2w} de ${after2} partidas (${Math.round(after2w / after2 * 100)}%). Regra: perdeu 2 seguidas, pare a sessão.` });
  const weakChamps = champs.filter(c => c.n >= 4 && c.w / c.n < 0.42);
  if (weakChamps.length) patterns.push({ title: 'Campeões com resultado ruim', text: `${weakChamps.map(c => `${c.champ} (${c.w}V ${c.n - c.w}D)`).join(', ')}. Concentre as ranqueadas nos campeões em que você vence mais e treine esses fora da ranqueada.` });
  const off = games.slice(0, 20).filter(g => g.pos && g.pos !== (profile.lane || 'UTILITY'));
  if (off.length >= 5) patterns.push({ title: 'Fora da rota principal', text: `${off.length} das últimas 20 partidas foram fora da ${LANE_PT[profile.lane] || 'rota principal'} (${off.filter(g => g.win).length}V ${off.filter(g => !g.win).length}D). Evite a "fill" na ranqueada enquanto busca o objetivo.` });
  return { metrics, strong, patterns };
}

module.exports = { TIERS, APEX, DIVS, PT, METRICS, LANE_KEYS, LANE_PT, score, label, tierOf, metricsOf, emptyBucket, addSample, build, brDay, mean };
