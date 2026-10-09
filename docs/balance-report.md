# Relatório de balanceamento

Gerado com `node tools/simulate.js --games 8 --maxwave 30` (8 partidas por linha, seeds 1000–1007).
"Wave" = a wave em que o Rei morreu. Partidas de Fácil que chegam a 31 bateram no limite de 30 do teste.

## Antes × depois (mediana entre as estratégias com plano)

| Dificuldade | Antes | Depois | Observação |
|---|---|---|---|
| Fácil   | wave 35 | wave 23 | multiplicadores 0.6/0.6/0.75/0.7 → 0.8/0.8/0.9/0.85 |
| Normal  | wave 14 | wave 14 | não alterado |
| Difícil | wave 1  | wave 7  | multiplicadores 1.4/1.4/1.25/1.35 → 1.12/1.12/1.06/1.1 |

*(ordem dos multiplicadores: HP, dano, velocidade, quantidade de inimigos)*

No Difícil original **todos os bots morriam na wave 1**. Além dos multiplicadores, a mão inicial agora garante
pelo menos 3 tropas (antes dava para abrir só com cartas de utilidade).

## Resultado atual

| dificuldade | estratégia | mediana | média | p10 | p90 | ≥w10 | ≥w15 | ≥w20 |
|---|---|---|---|---|---|---|---|---|
| easy | naive | 12 | 12.3 | 6 | 16 | 88% | 13% | 0% |
| easy | spam | 23 | 23.8 | 20 | 31 | 100% | 100% | 100% |
| easy | balanced | 28 | 25 | 21 | 31 | 100% | 100% | 100% |
| easy | eco | 22 | 21.6 | 16 | 28 | 100% | 100% | 75% |
| easy | tank | 25 | 24 | 16 | 31 | 100% | 100% | 88% |
| normal | naive | 12 | 10.1 | 1 | 14 | 75% | 0% | 0% |
| normal | spam | 14 | 15.4 | 13 | 21 | 100% | 38% | 13% |
| normal | balanced | 15 | 16.3 | 14 | 22 | 100% | 50% | 25% |
| normal | eco | 16 | 14.4 | 1 | 20 | 88% | 63% | 13% |
| normal | tank | 14 | 14.3 | 10 | 21 | 100% | 25% | 13% |
| hard | naive | 6 | 6.5 | 1 | 11 | 25% | 0% | 0% |
| hard | spam | 8 | 10 | 6 | 15 | 38% | 13% | 0% |
| hard | balanced | 11 | 8.6 | 1 | 14 | 50% | 0% | 0% |
| hard | eco | 6 | 6.1 | 1 | 12 | 13% | 0% | 0% |
| hard | tank | 7 | 7.6 | 1 | 14 | 25% | 0% | 0% |

Estratégias: `naive` joga a primeira carta que consegue pagar (perfil de iniciante); `spam` prioriza tropas baratas;
`balanced` mistura tropas e uma fábrica; `eco` investe em 3 fábricas antes de tudo; `tank` monta parede de Blocão com cura.

## O que os números mostram

- **Conquistas:** "Veterano" (wave 10) é alcançada por quase todos os bots no Fácil e no Normal e por cerca de 25–50% no
  Difícil. "Lendário" (wave 20) é realista no Fácil, rara no Normal (13–25% dos bots com plano) e não apareceu no Difícil.
- **Curva em "degrau":** o número de inimigos, o HP e a velocidade crescem com o quadrado da wave, enquanto o poder do
  jogador cresce quase linearmente. Na prática o Rei fica com HP cheio por muitas waves e morre em 1–2 waves quando o
  poder dos inimigos ultrapassa o das tropas (veja com `--trace`). Se quiser uma curva mais gradual, o caminho é reduzir
  `hp.quad` e `enemyCount.quad` em `BALANCE` e conferir no simulador.
- **p10 = 1 em algumas linhas:** são partidas dos bots `eco` e `balanced` que gastam a goma inicial em fábrica e ficam sem
  defesa na wave 1 — é erro da estratégia, não do jogo. Um jogador humano deve evitar isso.
- **Amostra pequena:** 8 partidas por linha dão uma ideia da ordem de grandeza, não precisão. Para decidir entre
  números próximos, rode com `--games 30` ou mais.
