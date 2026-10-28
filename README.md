# Rumo ao Objetivo

App local para acompanhar a subida de elo no League of Legends: você diz o elo que quer alcançar e em quanto tempo, e o painel mostra onde você está, o quanto falta e o que melhorar para chegar lá.

> **English:** a small local web app (Node.js, no dependencies) that tracks a League of Legends rank goal. It reads match history from the official Riot API, estimates MMR and LP gain, compares your stats with the target rank, and suggests what to improve.

Feito do zero por mim como projeto de estudo de JavaScript e de APIs.

## O que ele faz

- **Perfis e assistente de criação:** você digita `Nick#tag`, escolhe o elo-alvo (elo, divisão e PDL), a rota e quantas partidas por semana quer jogar.
- **Painel do jogador:** elo atual, gráfico de elo × MMR estimado na mesma escala de PDL, e quanto falta para o objetivo.
- **Meta de vitórias:** calcula a taxa de vitória necessária para chegar ao elo-alvo até o fim da temporada, quantas vitórias isso dá por semana e cenários com mais ou menos partidas por semana.
- **Partidas por sessão:** as últimas partidas agrupadas por dia de jogo, com abates, mortes, assistências, CS por minuto, visão e outras métricas.
- **Métricas por campeão:** compara os seus números com a média de jogadores do elo-alvo para o mesmo campeão e rota.
- **O que desenvolver:** lista os pontos em que você mais está abaixo da referência.
- **Estratégias por rota:** resumo de dicas de vídeos públicos, cada uma com o vídeo e o minuto de onde saiu.
- **Informações da conta:** posição no ladder, elo das temporadas anteriores e partidas por campeão (dados públicos do op.gg que a API da Riot não fornece).

## Como rodar

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo e de uma chave de desenvolvedor da Riot ([developer.riotgames.com](https://developer.riotgames.com)). A chave pessoal expira em 24 horas.

```bash
# 1. informe a chave (uma das duas formas)
set RIOT_KEY=RGAPI-sua-chave          # Windows (cmd)
# ou crie o arquivo riot_key.txt na pasta acima da pasta do app

# 2. inicie
node server.js
```

Depois abra <http://localhost:5177>. No Windows também dá para dar dois cliques em `Abrir App LoL.bat`.

Na primeira vez o app baixa sozinho os dados dos campeões (Data Dragon) e cria a pasta `data/` para guardar perfis, partidas e caches. Essa pasta não vai para o repositório porque tem dados pessoais.

## Como funciona

```
server.js            servidor HTTP em Node puro: rotas /api e arquivos estáticos
lib/riot.js          cliente da API da Riot com fila e limite de pedidos
lib/dd.js            nomes e ícones de campeões (Data Dragon), com cache local
lib/opgg.js          ladder e temporadas anteriores (dados públicos do op.gg)
lib/model.js         escala de elo, métricas, MMR estimado, previsão de PDL e metas
lib/estrategias.js   dicas por rota, com link para o vídeo e o minuto
public/              interface em JavaScript puro (perfis, assistente e painel)
```

Decisões que quis praticar:

- **Zero dependências:** só módulos do próprio Node (`http`, `fs`, `path` e `fetch`).
- **Cache e atualização incremental:** só baixa as partidas novas, para respeitar os limites da API.
- **Elo como número:** Ferro IV 0 PDL vale 0, cada divisão soma 100 e cada elo soma 400; isso deixa fácil medir a distância até a meta e desenhar o gráfico.

## Aviso

Projeto pessoal e de estudo, para uso local. Ele precisa da sua própria chave da Riot e não guarda nenhuma chave no repositório. Os dados do op.gg são lidos de páginas públicas, só para uso próprio.

*This project isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.*
