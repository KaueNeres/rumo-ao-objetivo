// Data Dragon (dados públicos da Riot): versão do patch, campeões, feitiços e runas, com cache local de 1 dia.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'ddragon.json');
const CDN = 'https://ddragon.leagueoflegends.com';

let dd = null;
async function load() {
  if (dd) return dd;
  if (fs.existsSync(FILE)) {
    const c = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (Date.now() - c.at < 864e5) return (dd = c);
  }
  const v = (await (await fetch(`${CDN}/api/versions.json`)).json())[0];
  const get = async p => (await fetch(`${CDN}/cdn/${v}/data/pt_BR/${p}`)).json();
  const [champ, spell, runes] = await Promise.all([get('champion.json'), get('summoner.json'), get('runesReforged.json')]);
  const champs = {}, spells = {}, perks = {};
  for (const c of Object.values(champ.data)) champs[c.key] = { id: c.id, name: c.name };
  for (const s of Object.values(spell.data)) spells[s.key] = { id: s.id, name: s.name };
  for (const tree of runes) {
    perks[tree.id] = { name: tree.name, icon: tree.icon };
    for (const slot of tree.slots) for (const r of slot.runes) perks[r.id] = { name: r.name, icon: r.icon };
  }
  dd = { at: Date.now(), v, champs, spells, perks };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(dd));
  return dd;
}

module.exports = { load };
