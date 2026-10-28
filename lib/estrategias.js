// Estratégias básicas por rota, resumidas de vídeos públicos do YouTube (canais escolhidos pelo usuário).
// Cada dica aponta para o vídeo e o minuto de onde saiu. Notas completas em guias/notas.md.
const V = {
  turtleTop: ['Coach Turtle', 'XfHLzfatTqI'], turtleJg: ['Coach Turtle', 'QrTnmIeZVqE'], turtleMid: ['Coach Turtle', '-XWZVbGGGx8'],
  turtleAdc: ['Coach Turtle', 'hQOd3U8Y-fQ'], turtleSup: ['Coach Turtle', 'Yn1KQsx6ZmM'],
  scTop: ['Skill Capped', 'nyq8F-ABQ4Y'], scTopMacro: ['Skill Capped', 'ppryenkYaNY'], scJg: ['Skill Capped', 'zeMhXijaV3Y'],
  tutuJg: ['Tutu', 'Dw_qUMf2eFE'], tutuMid: ['Tutu', 'lrMItSLiyas'],
  qaMid: ['Que Aula', 'nCOF_9KInhs'], qaBot: ['Que Aula', 'XbYrYMrdZ1Q'], qaAuto: ['Que Aula', 'jZdFIPBdx3E'],
  qaWave: ['Que Aula', '4DOnLAoNTBY'], qaMestre: ['Que Aula', 'Alx_ra5ld2I'], qaVisao: ['Que Aula', 'a4pMf4_HaQo'],
  micAph: ['Micão', '9w9Z7EzWQ7U'], micCait: ['Micão', 'TPrPZk_Yqu4'], micZeri: ['Micão', '4kc2CXBZfro'],
  dRegras: ['Dioud', 'J0Ud2mThbwA'], dRoam: ['Dioud', 'VF1c-WJPNOs'], d3: ['Dioud', 'hegzq3QtbCc'],
  dPos: ['Dioud', '9rCDNVN5dWw'], dVisao: ['Dioud', 'NB5Rsfg2fRs'],
};
const tip = (t, src, min) => ({ t, canal: V[src][0], video: V[src][1], min });

const STRATS = {
  TOP: {
    resumo: 'Vença a rota "por mil cortes" (XP, ouro, plates), termine a missão primeiro e, depois dos 15 min, pressione a rota lateral oposta ao próximo objetivo sem perder o tempo do time.',
    fases: [
      { fase: 'Fase de rotas (0–15 min)', itens: [
        tip('Saiba se a matchup é de ataque ou defesa em cada nível (2, 3, 6) e jogue a postura certa: em defesa, use skill para farmar e não troque à toa.', 'turtleTop', '2:00'),
        tip('Trocas curtas x longas: se o oponente é melhor em trocas longas, acerte o combo e recue antes do sangramento/acúmulo dele.', 'scTop', '6:04'),
        tip('Puna o último golpe do inimigo: fique perto da tropa que ele vai farmar e bata nele quando ele for no minion.', 'scTop', '7:04'),
        tip('Nível 2 = 1ª onda + 1 tropa da 2ª. Empurre a 1ª onda e ataque no instante em que subir de nível.', 'scTop', '13:06'),
        tip('Slow push: mantenha 1–2 tropas de vantagem desde a 1ª onda para ganhar XP, trocas melhores e voltar à base de graça.', 'scTop', '19:09'),
        tip('Volte à base com pouca vida/mana logo depois de empurrar a onda ANTES do canhão; nunca numa onda pequena que o inimigo vai puxar.', 'turtleTop', '11:10'),
        tip('Wards: atacando → pink no rio/tribush e verde avançada; defendendo → pink perto da torre.', 'turtleTop', '25:25'),
        tip('Atrás no jogo? Não tente recuperar trocando: farme a distância segura e minimize perdas.', 'scTop', '9:06'),
      ] },
      { fase: 'Meio de jogo (15+ min)', itens: [
        tip('Missão concluída / 2º dragão: vá para o lado SEM objetivo; com TP, largue a onda e entre na luta.', 'turtleTop', '29:30'),
        tip('Ritmo: empurre a onda até a torre inimiga, junte com o time enquanto alguém defende e volte antes de as tropas baterem na sua torre.', 'scTopMacro', '2:02'),
        tip('Empurre a lateral oposta ao próximo objetivo (dragão → top, barão → bot) e só avance com o time ativo no mapa.', 'scTop', '28:15'),
        tip('Sincronize: pressione a torre enquanto o time faz o objetivo; se o time quer voltar à base, volte junto.', 'scTopMacro', '10:06'),
        tip('Troque plate por controle: não pegue a plate se isso faz você perder a próxima onda.', 'turtleTop', '40:39'),
      ] },
      { fase: 'Erros comuns', itens: [
        tip('Ficar agrupado tempo demais sem jogada clara e voltar tarde para a rota (inimigo corta seu caminho).', 'scTopMacro', '5:04'),
        tip('Ir para o meio forçar jogada quando o time está voltando à base.', 'scTopMacro', '12:06'),
        tip('Passar da metade da rota ao avançar e perder a prioridade da próxima onda.', 'turtleTop', '38:39'),
      ] },
    ],
  },
  JUNGLE: {
    resumo: 'Escolha o lado pela tela de carregamento, termine o clear desse lado, rastreie o caçador inimigo e só largue campos por jogadas muito prováveis. No meio de jogo, converta vantagem em torres e objetivos.',
    fases: [
      { fase: 'Início (0–8 min)', itens: [
        tip('Escolha onde TERMINAR o clear: o lado com rota de CC/volátil ou inimigo frágil. Sem lado óbvio, termine embaixo (dragão).', 'scJg', '0:00'),
        tip('Ward nos raptors/selva inimiga e conte o CS dele (cada campo = 4 CS) para saber o pathing; avise o time.', 'scJg', '14:08'),
        tip('Truque das 5:30: termine o 2º clear após o petisco das 5:30 para ter smite de 1000 no 3º scuttle e nível 6.', 'turtleJg', '7:05'),
        tip('Perder os 2 primeiros scuttles não é grave (o 1º vale pouco): não perca tempo brigando por eles.', 'turtleJg', '6:04'),
        tip('Não seja bombeiro: fique perto do lado forte e não responda a todo ping.', 'tutuJg', '2:00'),
      ] },
      { fase: 'Regras de farm e gank', itens: [
        tip('Priorize campos, esteja neles quando nascem e termine o quadrante que começou.', 'scJg', '6:04'),
        tip('Regra dos 80%: só largue campos vivos por jogada com alta chance; senão faça no tempo livre.', 'scJg', '10:06'),
        tip('Leia as ondas: gank a rota com o inimigo avançado; onda grande na torre volta em ~1 min (rebote) — planeje o próximo gank.', 'scJg', '19:11'),
        tip('Segure o CC até o inimigo usar o flash.', 'scJg', '21:12'),
        tip('Com nível 6/item antes do rival, os campos valem menos: use a vantagem (invade/gank).', 'scJg', '12:07'),
      ] },
      { fase: 'Meio e fim de jogo', itens: [
        tip('Lane assignment: farme o lado oposto e vá para o lado do próximo objetivo; com ult disponível, farme 1–2 campos e jogue.', 'turtleJg', '17:15'),
        tip('A partir de ~12 min jogue por TORRES: cada torre encolhe o mapa seguro do inimigo. Sempre jogue com quem está forte.', 'tutuJg', '7:02'),
        tip('20+ min: jogue em volta do Barão com visão e pick antes; com o buff, derrube inibidores — não vá farmar.', 'tutuJg', '11:05'),
        tip('Objetivo é quando é óbvio (pick, caçador inimigo do outro lado, luta ganha).', 'scJg', '24:14'),
      ] },
    ],
  },
  MIDDLE: {
    resumo: 'Ganhe a prioridade com trocas curtas, use o tempo de onda empurrada (ward, rio, roam) e, no meio de jogo, vá para o lado do próximo objetivo mantendo o controle do meio.',
    fases: [
      { fase: 'Fase de rotas (0–15 min)', itens: [
        tip('Nível 1: bata na onda para ter 2 hits de vantagem → nível 2 e prioridade primeiro.', 'turtleMid', '5:04'),
        tip('Skill no oponente e recue ("usa e volta"); ao terminar o turno de skills, saia. Não chegue perto quando não há tropa morrendo.', 'tutuMid', '17:20'),
        tip('3 pressões: onda (crashar e ganhar tempo), abate e fog (sumir e ameaçar). Onda na torre dele = use o tempo, não fique parado.', 'tutuMid', '1:01'),
        tip('Roam quando a rota alvo está avançada ou o seu time tem dive; leia as ondas na tela, não só no minimapa.', 'tutuMid', '11:15'),
        tip('Mana: chegue saudável no primeiro item (ex.: ~5 min); voltar antes costuma ser erro de spacing.', 'tutuMid', '23:25'),
        tip('Volte na onda antes do canhão; no meio você perde no máximo 1–2 tropas.', 'turtleMid', '3:03'),
        tip('Wards: com pressão, pink/verde no rio; sem pressão, defensivas. Ward do lado de onde o caçador inimigo vem.', 'turtleMid', '9:14'),
      ] },
      { fase: 'Meio de jogo (15+ min)', itens: [
        tip('Vá para o lado do PRÓXIMO objetivo (dragão > arauto). Terminou o objetivo de cima? Troque de lado já.', 'turtleMid', '24:38'),
        tip('Na lateral, não gaste skills na onda se o inimigo pode tomar o controle do meio: fique no meio do caminho e reaja.', 'turtleMid', '29:40'),
        tip('Depois da T1, empurre a onda do meio e defenda a região; só vá fundo na lateral se estiver livre.', 'turtleMid', '33:43'),
      ] },
      { fase: 'Erros comuns', itens: [
        tip('Perseguir além do razoável: perde farm, XP e pressão de rota.', 'qaMid', '1:02'),
        tip('Ward avançada sem saber o pathing ou ward no próprio pé.', 'qaMid', '2:02'),
        tip('Abandonar ondas na torre para caçar: duas ondas = ouro de um abate, garantido.', 'qaMid', '3:02'),
        tip('Sair da rota com onda vindo para você é cara ou coroa (com uma onda, ~20 s de tempo).', 'qaMestre', '9:09'),
      ] },
    ],
  },
  BOTTOM: {
    resumo: 'Trocas curtas com o seu suporte, controle de onda perto da sua torre, volta à base no canhão e, no meio de jogo, farme seguro no meio com o push e o controle do rio.',
    fases: [
      { fase: 'Fase de rotas (0–15 min)', itens: [
        tip('A matchup é da DUPLA e muda por nível/item: quando o inimigo gasta skill/escudo, avance; quando vocês gastam, recue.', 'turtleAdc', '3:03'),
        tip('Nível 1 sem skill: fique ao lado da sua tropa, bata quando o inimigo for farmar e recue para perder o agro.', 'micAph', '4:01'),
        tip('Kiting: atacar → mover com "atacar-mover" e "alvejar somente campeões"; só clique quando o ataque estiver pronto.', 'qaAuto', '4:02'),
        tip('Onda perto da sua torre (sem estar nela) é o lugar ideal para farmar; perto da torre inimiga é onde se toma gank.', 'qaBot', '9:07'),
        tip('Volte na onda antes do canhão. Truque: o atirador volta e o suporte segura a onda (XP solo), depois inverte.', 'turtleAdc', '17:06'),
        tip('Em defesa, volte na onda de canhão sem medo: perde 1 tropa, e quem fica batendo na torre sem mana fica vulnerável.', 'turtleAdc', '26:15'),
        tip('Fique lado a lado com o suporte; se o suporte fica atrás, você "triangula" e luta 1x2.', 'qaBot', '14:08'),
      ] },
      { fase: 'Meio de jogo (15+ min)', itens: [
        tip('Bot vai para o meio (rota curta e segura). Cuide do mato do meio do lado do objetivo.', 'turtleAdc', '34:22'),
        tip('Com push no meio, ande até o meio do rio para ameaçar; passou dessa linha, perde a próxima onda.', 'turtleAdc', '38:25'),
        tip('Sem pressão, rote pelo caminho defensivo (perto das suas torres), não pelo rio.', 'turtleAdc', '40:26'),
        tip('Item defensivo é melhor quando você já está na frente; atrás, priorize dano.', 'micAph', '24:24'),
      ] },
      { fase: 'Erros comuns', itens: [
        tip('Empurrar a onda o tempo todo: entrega gank e dificulta o engage do seu suporte.', 'qaWave', '6:05'),
        tip('Morrer com uma onda grande vindo para você: o custo é muito maior que o KDA mostra.', 'qaMestre', '1:01'),
        tip('Forçar jogada agressiva quando a matchup está em defesa (ex.: seu suporte saiu e é 1x2).', 'turtleAdc', '20:09'),
      ] },
    ],
  },
  UTILITY: {
    resumo: 'Domine o mato e o nível 2, estabilize a rota antes de roamar, controle a visão do lado do próximo objetivo e, depois dos 11–14 min, jogue com quem está forte.',
    fases: [
      { fase: 'Fase de rotas (0–15 min)', itens: [
        tip('Saia da base na hora e ward o mato do meio da bot; quem ganha o nível 1 domina o mato.', 'qaBot', '5:04'),
        tip('Nível 2 vem com os 3 corpo a corpo da 2ª onda: ajude a bater e avance ANTES da última tropa morrer.', 'qaBot', '6:05'),
        tip('Depois que o inimigo usa o engage, não corra: vire e devolva o dano enquanto ele está sem skills.', 'turtleSup', '18:10'),
        tip('Conheça as recargas do seu atirador: engajar quando ele está sem skills não mata ninguém.', 'turtleSup', '19:11'),
        tip('Ward no mato do rio do bot por volta de 2:30–2:40: cobre o scuttle das 3:15 e mostra se o caçador inimigo está embaixo.', 'd3', '4:01'),
        tip('Recall com a onda crashada na torre inimiga e use o bônus de velocidade da volta.', 'd3', '0:00'),
        tip('Não "suma" com tropas (principalmente o canhão) quando a onda está boa para o atirador; não use área na onda debaixo da torre.', 'qaBot', '10:07'),
        tip('Engage (Leona, Nautilus, Rell, Blitz, Pyke) que quer matar: Incendiar; Curar agressivo também funciona (usar cedo, ~90% de vida).', 'd3', '8:03'),
      ] },
      { fase: 'Roam e visão', itens: [
        tip('Estabilize o bot antes de roamar; saia quando a onda está crashada ou voltando (bounce), nunca com o atirador sob dive.', 'turtleSup', '10:06'),
        tip('No 1º/2º recall passe pelo meio: ward, tirar visão, skill no mid inimigo. Roam de no máximo 30–40 s.', 'dRegras', '0:00'),
        tip('Objetivos de roam: 1º scuttle do seu lado, dragão, larvas (~8 min, tente nível 6), tirar o flash do mid (5 min de janela).', 'dRoam', '9:05'),
        tip('Visão sempre do lado do PRÓXIMO objetivo; use o trinket e compre pink todo recall.', 'dRegras', '4:03'),
        tip('Coloque 1 ward e defenda o controle; não gaste todas e volte à base. Luta > ward.', 'turtleSup', '28:16'),
        tip('Tracking: no TAB veja as pinks e cargas do suporte inimigo; sem wards dele, o rio é seu.', 'dVisao', '0:00'),
        tip('Ajude a empurrar a onda antes de ir wardar: o inimigo vem coletar e o rio fica seguro.', 'qaMestre', '4:02'),
      ] },
      { fase: 'Depois da rota (11+ min)', itens: [
        tip('Aperte TAB entre 11 e 14 min: jogue com quem está forte (amplifique a vitória), não com quem está 0/5.', 'dPos', '2:03'),
        tip('Top de split forte: visão rasa na T1, profunda na T2/T3, e fique na sombra perto dele.', 'dPos', '4:05'),
        tip('Wards no meio de jogo: T1 → rasa; T2 → profunda; T3 → saídas da base inimiga.', 'dPos', '13:14'),
        tip('Antes de luta decisiva, veja se o seu carry tem flash; sem flash, proteja em vez de iniciar.', 'dPos', '13:14'),
        tip('Você é um "2º caçador": controle o lado do objetivo e garanta o push do mid e do carry lateral.', 'turtleSup', '29:16'),
      ] },
    ],
  },
};

// Dicas por métrica e rota (usadas em "O que desenvolver" quando a métrica está abaixo da meta)
const METRIC_TIPS = {
  d: {
    TOP: tip('Atrás? Farme a distância segura e não tente recuperar trocando; respeite os níveis em que você perde a troca.', 'scTop', '9:06'),
    JUNGLE: tip('Regra dos 80%: só force jogadas com alta chance; rastreie o caçador inimigo antes de invadir.', 'scJg', '10:06'),
    MIDDLE: tip('Não persiga além do razoável e não avance sem saber onde está o inimigo que sumiu.', 'qaMid', '1:02'),
    BOTTOM: tip('Mantenha a onda perto da sua torre e não avance quando o suporte saiu (1x2).', 'qaBot', '9:07'),
    UTILITY: tip('Ward antes de entrar no rio (ajude a empurrar a onda primeiro) e roame só com a rota estável.', 'qaMestre', '4:02'),
  },
  vpm: {
    UTILITY: tip('Visão do lado do próximo objetivo, trinket sempre em uso e pink todo recall.', 'dRegras', '4:03'),
    JUNGLE: tip('Ward a selva inimiga para rastrear o pathing e avise o time.', 'scJg', '14:08'),
    default: tip('Wards em pares (rio + tribush) e use o indicador de alcance da ward.', 'qaVisao', '1:01'),
  },
  cw: {
    UTILITY: tip('Compre pink todo recall: o seu trabalho é deixar o mapa inimigo escuro.', 'dRegras', '6:03'),
    default: tip('Tenha sempre uma pink: com pressão no rio, sem pressão perto da torre.', 'turtleMid', '9:14'),
  },
  kp: {
    UTILITY: tip('Depois de 11–14 min jogue com quem está forte e chegue nas lutas — luta vale mais que a ward.', 'dPos', '2:03'),
    JUNGLE: tip('Converta vantagem em torres e objetivos jogando com quem está forte.', 'tutuJg', '7:02'),
    default: tip('Sincronize com o time: pressione enquanto eles fazem o objetivo ou largue a onda e entre na luta.', 'scTopMacro', '10:06'),
  },
  a: {
    UTILITY: tip('Roam nas janelas certas (onda crashada/bounce) e esteja no 1º scuttle, dragão e larvas.', 'dRoam', '0:00'),
  },
  laneWin: {
    UTILITY: tip('Domine o mato, pegue nível 2 primeiro e puna quem avança sem skill.', 'qaBot', '6:05'),
    BOTTOM: tip('Trocas curtas: avance quando o inimigo gasta skill e recue quando vocês gastam.', 'turtleAdc', '9:03'),
    TOP: tip('Slow push desde a 1ª onda e trocas nas janelas de nível (2 e 6).', 'scTop', '19:09'),
    MIDDLE: tip('Ganhe a prioridade no nível 1 batendo na onda e faça trocas curtas.', 'turtleMid', '5:04'),
    default: tip('Ganhe a prioridade com controle de onda.', 'qaWave', '0:00'),
  },
  csMin: {
    JUNGLE: tip('Priorize campos e esteja neles quando nascem; termine o quadrante que começou.', 'scJg', '6:04'),
    default: tip('Não largue ondas para caçar: duas ondas valem um abate e são garantidas.', 'qaMid', '3:02'),
  },
  cs10: {
    JUNGLE: tip('Pratique o clear do seu campeão no modo prática; velocidade de clear é a habilidade nº 1.', 'scJg', '3:03'),
    default: tip('Volte à base na onda antes do canhão para não perder tropas.', 'turtleTop', '11:10'),
  },
  dpm: { default: tip('Esteja nas lutas: quem controla o push do meio controla os objetivos.', 'turtleAdc', '46:31') },
  gpm: { default: tip('Use o tempo de onda empurrada para plates/torres e volte com ouro para fechar item.', 'qaWave', '17:17') },
  solo: { default: tip('Trocas nas janelas: inimigo sem a skill principal, nível 2 e nível 6 antes dele.', 'scTop', '16:07') },
};
function metricTip(key, lane) {
  const m = METRIC_TIPS[key];
  if (!m) return null;
  return m[lane] || m.default || null;
}

module.exports = { STRATS, metricTip };
