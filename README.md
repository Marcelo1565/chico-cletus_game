# Reino do Chicletão 🍬

## Screenshots

### Gameplay — Combo x9 e conquista desbloqueada
![Gameplay](docs/screenshot-gameplay.png)

### Tela pós-partida — Stats, histórico e conquistas
![Pós-partida](docs/screenshot-postgame.png)

### Boss
![Boss](docs/boss-screenshot.png)

---

## Descrição

Jogo de tower defense baseado em cartas: defenda o Rei Chicletão posicionando tropas num grid 5x5 contra hordas de inimigos (Venom). Gerencie sua goma, invoque unidades, sobreviva o maior número de waves possível e tente bater seu recorde.

Desenvolvido como Trabalho de Conclusão de Curso (TCC) — ETEC Desenvolvimento de Games 2D/3D.

---

## Como executar

Abra o arquivo `Jogo.html` em um navegador moderno (Chrome/Edge/Firefox). Não requer servidor — basta dar duplo-clique no arquivo.

A arena escala automaticamente para qualquer tamanho de janela, zoom do navegador ou celular (no celular, jogue na horizontal).

> ⚠️ Mantenha `Jogo.html`, `script.js`, `style.css` e a pasta `assets/` juntos, com a mesma estrutura do projeto.
>
> O script é um arquivo clássico (não usa módulos ES) justamente para funcionar com duplo-clique, sem servidor.

---

## Controles

| Ação | Controle |
|---|---|
| Selecionar carta | Clique na carta da mão, ou teclas **1–9** (e **0** para a 10ª carta) |
| Posicionar tropa | Clique numa célula do grid |
| Fazer upgrade de tropa | Clique na célula com a mesma carta |
| Iniciar wave | Botão **Invocar Horda** ou **Enter** |
| Usar Xarope King / Puxada de Goma | Clique na carta (efeito imediato, não precisa de célula) |
| Usar Derretimento | Selecione a carta e clique na **tropa** que quer sacrificar |
| Pausar | **P** ou **Espaço** |

---

## Mecânicas de jogo

### Tropas (cartas de unidade)
| Carta | Custo | Passiva |
|---|---|---|
| Mascador 🍬 | 2 | Regenera HP das tropas vizinhas |
| Chicle Ácido 🍋 | 2 | — |
| Blocão 🛡 | 4 | **Taunt** — inimigos priorizam ele |
| Franqueiro 🎯 | 3 | **Crítico** — 20% chance de dano duplo |
| Par de Goma 🍡 | 2 | — |
| Rei da Bala 🍮 | 4 | Lendário (raridade especial) |
| Goma Grudenta 🟤 | 5 | Lentifica inimigos automaticamente |
| Chicle Cura 💚 | 3 | Cura tropas aliadas próximas |

### Tipos de inimigo
| Inimigo | Comportamento |
|---|---|
| Normal 💀 | Padrão |
| Tank 🛡️ | Muito HP, lento |
| Fast 💨 | Pouco HP, muito rápido |
| Boss 👹 | Entra em fúria a 40% HP, se divide em 3 ao morrer |
| Curador 💊 | Heala aliados próximos — prioridade de abate |
| Corredor 🏃 | Ignora tropas, vai direto no Rei (wave 6+) |
| Armado 🪖 | Primeiro hit quebra o escudo (wave 8+) |

### Outros sistemas
- **Sinergias** — quanto mais tropas no grid, maior o bônus de dano coletivo
- **Combo** — matar 3+ inimigos seguidos ativa multiplicador de score
- **Fábrica 🏭** — gera goma extra por wave
- **Loja** — aparece a cada 3 waves para comprar itens com goma
- **Upgrades pós-wave** — escolha 1 de 3 power-ups ao fim de cada wave
- **Eventos especiais** — Horda Dupla (wave 7, 14…), Horda Veloz (wave 6, 12…), Curador em campo (wave 4, 8…). Boss a cada 5 waves.
- **Conquistas** — 12 conquistas salvas localmente com toast animado
- **Histórico** — últimas 5 partidas salvas com wave, score e kills
- **Dificuldades** — Fácil, Normal e Difícil selecionáveis no menu (a última escolha fica salva)
- **Prévia da wave** — antes de invocar a horda, o canto da arena mostra quantos inimigos vêm e se há boss ou evento
- **Alerta de HP baixo** — borda vermelha pulsando quando o Rei está abaixo de 30%
- **Dicas da 1ª partida** — 3 dicas rápidas que aparecem uma única vez
- **Mão inicial justa** — sempre começa com pelo menos 3 tropas

---

## Velocidade

Use os botões **1× 2× 3×** na arena para acelerar o jogo.

---

## Balanceamento e simulador

Todos os números das waves (quantidade, HP, dano, velocidade e multiplicadores de dificuldade) estão no objeto
`BALANCE`, no começo do `script.js`. Para testar mudanças sem jogar na mão, existe um simulador que roda o
**`script.js` real** (sem copiar regras) com bots de várias estratégias — precisa só de Node 18+:

```bash
node tools/simulate.js                                   # tabela completa (demora alguns minutos)
node tools/simulate.js --games 6 --maxwave 20            # rápido, serve de teste de fumaça
node tools/simulate.js --diff hard --strategy balanced --trace   # mostra HP do Rei e nº de tropas wave a wave
node tools/simulate.js --set difficulty.hard.hp=1.2      # testa um número sem editar o jogo
```

As partidas são determinísticas (mesma seed = mesmo resultado), então dá para comparar antes/depois de uma mudança.
Estratégias: `naive` (iniciante), `spam`, `balanced`, `eco`, `tank`. O relatório mais recente está em
[`docs/balance-report.md`](docs/balance-report.md).

> Os bots são aproximações: servem para comparar versões e achar problemas grosseiros (como "Difícil mata na wave 1"),
> não para prever exatamente o que um jogador humano faria.

---

## Estrutura do projeto

```
chico-cletus_game-main/
├── Jogo.html               — estrutura HTML da página
├── script.js               — lógica completa do jogo
├── style.css               — estilos e animações
├── assets/                 — sprites das tropas (WebP)
│   ├── chicleteMascador.webp
│   ├── chicleteAcido.webp
│   ├── chicleteTanque.webp
│   └── Franqueiro.webp
├── docs/                   — screenshots, arte de referência e relatório de balanceamento
├── tools/
│   └── simulate.js         — simulador de balanceamento (bots jogam o jogo real)
└── README.md
```

---

## Tecnologias

- HTML5, CSS3, JavaScript puro (sem frameworks ou bibliotecas)
- Renderização via DOM (sem Canvas)
- Web Audio API para efeitos sonoros procedurais
- localStorage para high score, conquistas, histórico de partidas e última dificuldade escolhida (com fallback seguro se o storage estiver indisponível)

---

## Equipe

Desenvolvido por Raul Pinheiro das Chagas (R7Chaca) e colaboradores — ETEC, 2025.

---

## Licença

MIT
