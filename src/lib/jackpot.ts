import type { Draw, LotteryGame } from '@/types/domain';

/**
 * Qual valor de prêmio uma tela pode apresentar.
 *
 * POR QUE ISSO É UMA FUNÇÃO, E NÃO UM `??` ESPALHADO
 *   Três telas faziam `draw?.advertisedJackpot ?? game.currentJackpot`, e esse
 *   `??` tem um efeito que não parece: ele reintroduz exatamente o problema
 *   que a regra do banco resolveu.
 *
 *   `draws.advertised_jackpot` é o prêmio DAQUELE sorteio, e só o próximo
 *   sorteio tem um — nos seguintes o campo é nulo, porque ninguém sabe hoje o
 *   prêmio do sorteio do fim do mês. `lottery_games.current_jackpot` é outra
 *   coisa: é o último valor que alguém apurou para o jogo.
 *
 *   Caindo de um para o outro, um sorteio de três semanas adiante passava a
 *   exibir o prêmio de hoje como se fosse o dele. E logo depois de um sorteio
 *   acontecer, o sorteio seguinte exibia o prêmio JÁ SORTEADO — a trava de
 *   validade de 12h não pegava, porque o carimbo continuava recente: o valor
 *   não estava velho no relógio, estava gasto.
 *
 * A REGRA
 *   Havendo sorteio em tela, vale o valor DELE. Nulo ali significa "ainda não
 *   divulgado" e é isso que a tela diz. A queda para o valor do jogo acontece
 *   só quando não há sorteio nenhum em tela — aí `current_jackpot` é a melhor
 *   informação disponível, e a trava de validade por idade cuida dela.
 */
export function jackpotEmCartaz(game: LotteryGame, draw: Draw | null): number | null {
  if (draw !== null) return draw.advertisedJackpot;
  return game.currentJackpot;
}
