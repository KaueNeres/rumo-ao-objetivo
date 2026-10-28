// Dados públicos do op.gg que a API da Riot não fornece: posição no ladder, elo das temporadas anteriores
// e partidas por campeão em cada temporada (para o total da vida da conta).
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' };
const slug = (name, tag) => encodeURIComponent(`${name}-${tag}`);
const BS = String.fromCharCode(92);

async function page(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`op.gg respondeu ${r.status}`);
  return (await r.text()).split(BS + '"').join('"');
}

// Recorta um objeto/lista JSON completo a partir da posição i (respeitando strings).
function grab(s, i) {
  let d = 0, j = i, inS = false;
  for (; j < s.length; j++) {
    const c = s[j];
    if (inS) { if (c === BS) { j++; continue; } if (c === '"') inS = false; continue; }
    if (c === '"') inS = true;
    else if (c === '{' || c === '[') d++;
    else if (c === '}' || c === ']') { d--; if (!d) break; }
  }
  return s.slice(i, j + 1);
}

async function profile(name, tag) {
  const s = await page(`https://op.gg/lol/summoners/br/${slug(name, tag)}`);
  const out = { at: Date.now(), ladder: null, seasons: [] };
  const lad = s.match(/Ladder Rank <span[^>]*>([\d,.]+)<\/span> \(([\d.]+)% of top\)/);
  if (lad) {
    const rank = Number(lad[1].replace(/[,.]/g, '')), ratio = Number(lad[2]);
    out.ladder = { rank, ratio, total: ratio > 0 ? Math.round(rank / (ratio / 100)) : null };
  }
  // A primeira lista de temporadas é a Solo/Duo (a segunda é a Flex)
  const seen = new Set();
  const re = /"season":"(S[^"]*?)\s*","rank_entries":/g;
  let m;
  while ((m = re.exec(s))) {
    const label = m[1].trim();
    if (seen.has(label)) break;
    seen.add(label);
    try {
      const o = JSON.parse(grab(s, m.index + m[0].length));
      const pick = x => (x && x.value && x.value !== 'Unranked' ? { tier: x.value, div: x.division ?? null, lp: x.lp != null ? Number(x.lp) : null } : null);
      out.seasons.push({ season: label, final: pick(o.rank_info), peak: pick(o.high_rank_info) });
    } catch { /* temporada com formato diferente: ignora */ }
  }
  return out;
}

const SEASON_IDS = [1, 2, 3, 4, 5, 6, 7, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33];

// Partidas por campeão em cada temporada (Solo/Duo). Soma tudo para o total da conta.
async function lifetime(name, tag, onStep) {
  const champs = {}, seasons = [];
  for (const sid of SEASON_IDS) {
    if (onStep) onStep(sid);
    let s;
    try { s = await page(`https://op.gg/lol/summoners/br/${slug(name, tag)}/champions?queue_type=SOLORANKED&season_id=${sid}`); }
    catch { continue; }
    // Temporadas novas: SOLORANKED + my_champion_stats; antigas (até 2017): RANKED + champion_stats
    const mm = new RegExp(`\{"game_type":"(SOLORANKED|RANKED)","season_id":${sid},`).exec(s);
    if (!mm) continue;
    const i = mm.index;
    let o; try { o = JSON.parse(grab(s, i)); } catch { continue; }
    if (!o.play) continue;
    seasons.push({ sid, play: o.play, win: o.win, lose: o.lose });
    for (const c of o.my_champion_stats || o.champion_stats || []) {
      if (!c.id) continue; // id 0 = linha de total
      const t = champs[c.id] || (champs[c.id] = { play: 0, win: 0 });
      t.play += c.play; t.win += c.win;
    }
    await new Promise(r => setTimeout(r, 400));
  }
  return { at: Date.now(), seasons, champs };
}

module.exports = { profile, lifetime };
