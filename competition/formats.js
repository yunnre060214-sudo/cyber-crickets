export const FORMAT_NAMES = {
  round_robin: "单循环",
  double_round_robin: "双循环",
  knockout: "淘汰赛",
  groups: "小组赛",
  swiss: "瑞士轮",
  group_knockout: "小组＋淘汰",
};
export function circlePairs(ids) {
  const circle = [...ids],
    rounds = [];
  for (let r = 0; r < ids.length - 1; r++) {
    rounds.push(
      Array.from({ length: ids.length / 2 }, (_, i) => [
        circle[i],
        circle[ids.length - 1 - i],
      ]),
    );
    circle.splice(1, 0, circle.pop());
  }
  return rounds;
}
const compare = (a, b) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
};
export function swissPairs(ranked, previous) {
  const memo = new Map(),
    n = ranked.length;
  function solve(mask) {
    if (!mask) return { cost: [0, 0, 0, ""], pairs: [] };
    if (memo.has(mask)) return memo.get(mask);
    let i = 0;
    while (!(mask & (1 << i))) i++;
    let best = null;
    for (let j = i + 1; j < n; j++)
      if (mask & (1 << j)) {
        const a = ranked[i],
          b = ranked[j],
          key = [a.id, b.id].sort().join(":"),
          tail = solve(mask ^ (1 << i) ^ (1 << j)),
          pairs = [[a.id, b.id], ...tail.pairs],
          cost = [
            tail.cost[0] + Number(previous.has(key)),
            tail.cost[1] + Math.abs(a.points - b.points),
            tail.cost[2] + Math.abs(a.seedRank - b.seedRank),
            pairs
              .map((p) => [...p].sort().join(":"))
              .sort()
              .join("|"),
          ];
        if (!best || compare(cost, best.cost) < 0) best = { cost, pairs };
      }
    memo.set(mask, best);
    return best;
  }
  return solve((1 << n) - 1).pairs;
}
