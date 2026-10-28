// Cliente da API da Riot com fila única e prioridade.
// Limite da chave (desenvolvimento ou pessoal): 100 chamadas a cada 2 min → uma chamada a cada 1,25 s.
// Prioridade 0 = o que o usuário está esperando (atualizar partidas); 1 = segundo plano (referências do elo).
const fs = require('fs');
const path = require('path');

function readKey() {
  if (process.env.RIOT_KEY) return process.env.RIOT_KEY.trim();
  const f = path.join(__dirname, '..', '..', 'riot_key.txt');
  if (!fs.existsSync(f)) throw new Error('Não achei a chave da Riot (riot_key.txt na pasta Relatorio LoL Duo).');
  return fs.readFileSync(f, 'utf8').replace(/^﻿/, '').trim();
}

const GAP_MS = 1250;
const queue = [];
let busy = false, last = 0;

function riot(url, priority = 0) {
  return new Promise((resolve, reject) => {
    queue.push({ url, priority, resolve, reject, tries: 0 });
    queue.sort((a, b) => a.priority - b.priority);
    pump();
  });
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    // Espera ANTES de escolher: assim quem acabou de receber resposta já colocou o próximo pedido na fila
    // e a prioridade funciona (a atualização do usuário passa na frente das referências).
    await sleep(Math.max(5, last + GAP_MS - Date.now()));
    queue.sort((a, b) => a.priority - b.priority);
    const job = queue.shift();
    last = Date.now();
    try {
      const r = await fetch(job.url, { headers: { 'X-Riot-Token': readKey() } });
      if (r.status === 429 && job.tries < 5) {
        job.tries++;
        await sleep(1000 * Number(r.headers.get('retry-after') || 10));
        queue.unshift(job);
        continue;
      }
      if (r.status === 401 || r.status === 403) throw new Error('A chave da Riot foi recusada (venceu ou é inválida).');
      if (r.status === 404) { job.resolve(null); continue; }
      if (!r.ok) throw new Error(`Riot respondeu ${r.status}`);
      job.resolve(await r.json());
    } catch (e) { job.reject(e); }
  }
  busy = false;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pending = () => queue.length;

// Endereços (contas e partidas ficam em "americas"; elo, maestria e invocador em "br1")
const AM = 'https://americas.api.riotgames.com', BR = 'https://br1.api.riotgames.com';
const regionOf = id => (/^(EUW1|EUN1|TR1|RU|ME1)_/.test(id) ? 'europe' : /^(KR|JP1)_/.test(id) ? 'asia' : /^(OC1|PH2|SG2|TH2|TW2|VN2)_/.test(id) ? 'sea' : 'americas');
const api = {
  account: (name, tag, p) => riot(`${AM}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`, p),
  summoner: (puuid, p) => riot(`${BR}/lol/summoner/v4/summoners/by-puuid/${puuid}`, p),
  league: (puuid, p) => riot(`${BR}/lol/league/v4/entries/by-puuid/${puuid}`, p),
  mastery: (puuid, p) => riot(`${BR}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=12`, p),
  ids: (puuid, count, start = 0, p) => riot(`${AM}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=${start}&count=${count}`, p),
  match: (id, p) => riot(`https://${regionOf(id)}.api.riotgames.com/lol/match/v5/matches/${id}`, p),
  timeline: (id, p) => riot(`https://${regionOf(id)}.api.riotgames.com/lol/match/v5/matches/${id}/timeline`, p),
  tierEntries: (tier, div, page, p) => riot(`${BR}/lol/league/v4/entries/RANKED_SOLO_5x5/${tier}/${div}?page=${page}`, p),
  apex: (tier, p) => riot(`${BR}/lol/league/v4/${tier.toLowerCase()}leagues/by-queue/RANKED_SOLO_5x5`, p),
};

module.exports = { riot, api, pending, readKey };
