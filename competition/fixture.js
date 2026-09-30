import { createMatchConfig } from "../engine/config.js";
import { randomFor } from "../engine/rng.js";
export function fixtureJobs(fixture, config) {
  const ids = fixture.entrants;
  return Array.from(
    { length: config.mapCount + (fixture.extraMap ? 1 : 0) },
    (_, map) =>
      [0, 1].map((leg) => ({
        jobId: config.id + "/" + fixture.id + "/map" + map + "/leg" + leg,
        fixtureId: fixture.id,
        map,
        leg,
        kind: "fixture-leg",
        status: "pending",
        config: createMatchConfig({
          ...config,
          teamCount: 2,
          rotation: 0,
          seed: fixture.seed + "|map:" + map,
          entrants: (leg ? [...ids].reverse() : ids).map((id) =>
            config.entrants.find((e) => e.participantId === id),
          ),
        }),
      })),
  ).flat();
}
export function aggregateFixture(fixture, legResults) {
  const aggregates = Object.fromEntries(
    fixture.entrants.map((id) => [id, { vp: 0, captures: 0, territory: 0 }]),
  );
  for (const r of legResults)
    for (const t of r.teams) {
      const a = aggregates[t.participantId];
      if (!a) throw Error("FIXTURE_PARTICIPANT_MISMATCH");
      a.vp += t.score;
      a.captures += t.captures ?? 0;
      a.territory += t.territory;
    }
  const [a, b] = fixture.entrants,
    x = aggregates[a],
    y = aggregates[b];
  let winner = x.vp > y.vp + 1e-9 ? a : y.vp > x.vp + 1e-9 ? b : null;
  const decisive = ["knockout", "final", "bronze"].includes(fixture.stage);
  if (winner === null && decisive && !fixture.extraMap)
    return { winner, aggregates, legs: legResults, needsExtraMap: true };
  if (winner === null && decisive)
    winner =
      x.captures !== y.captures
        ? x.captures > y.captures
          ? a
          : b
        : x.territory !== y.territory
          ? x.territory > y.territory
            ? a
            : b
          : randomFor(fixture.seed, { stream: "tiebreak", tick: 0 }) < 0.5
            ? a
            : b;
  return { winner, aggregates, legs: legResults };
}
