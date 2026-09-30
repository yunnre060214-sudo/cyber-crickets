export function standingsFor(
  config,
  rounds,
  allowed = config.entrants.map((e) => e.participantId),
  group = null,
) {
  const rows = new Map(
    config.entrants
      .filter((e) => allowed.includes(e.participantId))
      .map((e, seedRank) => [
        e.participantId,
        {
          ...e,
          id: e.participantId,
          seedRank: config.entrants.indexOf(e),
          played: 0,
          wins: 0,
          draws: 0,
          points: 0,
          vpFor: 0,
          vpAgainst: 0,
          buchholz: 0,
          opponents: [],
        },
      ]),
  );
  for (const r of rounds)
    for (const f of r.fixtures) {
      if (!f.result || (group && f.group !== group)) continue;
      const [a, b] = f.entrants;
      if (!rows.has(a) || !rows.has(b)) continue;
      for (const [id, rival] of [
        [a, b],
        [b, a],
      ]) {
        const t = rows.get(id);
        t.played++;
        t.opponents.push(rival);
        t.vpFor += f.result.aggregates[id].vp;
        t.vpAgainst += f.result.aggregates[rival].vp;
        if (f.result.winner === id) {
          t.wins++;
          t.points += 3;
        } else if (f.result.winner === null) {
          t.draws++;
          t.points++;
        }
      }
    }
  for (const t of rows.values())
    t.buchholz = t.opponents.reduce((s, id) => s + rows.get(id).points, 0);
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      (config.format === "swiss" ? b.buchholz - a.buchholz : 0) ||
      b.vpFor - b.vpAgainst - (a.vpFor - a.vpAgainst) ||
      a.seedRank - b.seedRank,
  );
}
