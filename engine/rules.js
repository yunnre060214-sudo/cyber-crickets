import { neighbors } from "./maps.js";
import { randomFor } from "./rng.js";
export const vpRate = ({
  area,
  playableCellCount,
  resourceValue,
  resourceTotal,
}) =>
  (6.5 * area) / playableCellCount +
  (resourceTotal ? (3.5 * resourceValue) / resourceTotal : 0);
export function actionChance(board, seat, to, overclock = false) {
  const ns = neighbors(to, board.width, board.height),
    old = board.owner[to],
    support = ns.filter((i) => board.owner[i] === seat).length,
    defense = old < 0 ? 0 : ns.filter((i) => board.owner[i] === old).length;
  return Math.max(
    0.12,
    Math.min(
      0.93,
      (old < 0
        ? 0.93 - (board.terrain[to] - 1) * 0.12
        : 0.39 +
          support * 0.105 -
          defense * 0.075 -
          (board.terrain[to] - 1) * 0.05) + (overclock ? 0.075 : 0),
    ),
  );
}
export function resolveActions(
  board,
  proposals,
  { seed, tick, overclock = false },
) {
  const results = [...proposals]
    .sort((a, b) => a.participantId.localeCompare(b.participantId))
    .map((p) => {
      const { seat, participantId, move } = p,
        from = move?.from,
        to = move?.to;
      const valid =
        Number.isInteger(from) &&
        Number.isInteger(to) &&
        from >= 0 &&
        to >= 0 &&
        from < board.owner.length &&
        to < board.owner.length &&
        board.owner[from] === seat &&
        board.owner[to] !== seat &&
        board.core[to] < 0 &&
        !board.blocked[to] &&
        neighbors(from, board.width, board.height).includes(to);
      const chance = valid ? actionChance(board, seat, to, overclock) : 0;
      return {
        seat,
        participantId,
        move: move ?? null,
        success:
          valid &&
          randomFor(seed, {
            stream: "outcome",
            tick,
            participantId,
            target: to,
          }) <= chance,
        previousOwner: valid ? board.owner[to] : -1,
        chance,
        reward: -0.15,
      };
    });
  const groups = new Map();
  for (const r of results)
    if (r.success) {
      const g = groups.get(r.move.to) ?? [];
      g.push(r);
      groups.set(r.move.to, g);
    }
  for (const [target, g] of groups) {
    g.sort(
      (a, b) =>
        randomFor(seed, {
          stream: "conflict",
          tick,
          participantId: a.participantId,
          target,
        }) -
          randomFor(seed, {
            stream: "conflict",
            tick,
            participantId: b.participantId,
            target,
          }) || a.participantId.localeCompare(b.participantId),
    );
    const winner = g[0];
    for (const r of g.slice(1)) r.success = false;
    board.owner[target] = winner.seat;
    winner.reward =
      1 + 4 * board.resources[target] + (winner.previousOwner >= 0 ? 0.5 : 0);
  }
  return results;
}
