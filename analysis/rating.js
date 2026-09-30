export function calculateElo(pairs, { initial = 1000, k = 24 } = {}) {
  const ratings = {},
    seen = new Set();
  for (const p of [...pairs].sort((a, b) => a.pairId.localeCompare(b.pairId))) {
    if (seen.has(p.pairId)) continue;
    if (![0, 0.5, 1].includes(p.score)) throw Error("INVALID_PAIRED_SCORE");
    seen.add(p.pairId);
    const x = ratings[p.a] ?? initial,
      y = ratings[p.b] ?? initial,
      delta = k * (p.score - 1 / (1 + 10 ** ((y - x) / 400)));
    ratings[p.a] = x + delta;
    ratings[p.b] = (ratings[p.b] ?? initial) - delta;
  }
  return ratings;
}
