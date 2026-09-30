import test from "node:test";
import assert from "node:assert/strict";
const config = (teamCount = 4) => ({
  id: "lab",
  name: "L",
  mode: "standard",
  mapPresets: ["plain"],
  durationsMs: [10000],
  rosters: [
    ["random", "greedy", "turtle", "strongest"]
      .slice(0, teamCount)
      .map((strategyId, i) => ({ participantId: "p" + i, strategyId })),
  ],
  seedList: Array.from({ length: 8 }, (_, i) => "s" + i),
  teamCount,
  budgetProfile: "standard",
});
test("experiments include each duel leg and all four seat rotations", async () => {
  const { planExperiment } = await import("../analysis/experiment.js");
  assert.equal(
    planExperiment({
      ...config(2),
      mapPresets: ["plain", "basin", "canyon", "ring"],
      durationsMs: [10000, 60000],
    }).orderedTasks.length,
    128,
  );
  assert.equal(
    planExperiment({
      ...config(),
      rosters: [config().rosters[0], config().rosters[0]],
    }).orderedTasks.length,
    64,
  );
});
test("confidence intervals cluster seeds and require eight independent seeds", async () => {
  const { bootstrapInterval } = await import("../analysis/statistics.js");
  assert.equal(bootstrapInterval(Array(7).fill(1), { seed: "ci" }), null);
  assert.deepEqual(bootstrapInterval(Array(8).fill(1), { seed: "ci" }), {
    low: 1,
    high: 1,
    iterations: 2000,
  });
});
test("Elo updates ordered paired results with conserved total ratings", async () => {
  const { calculateElo } = await import("../analysis/rating.js");
  const games = [
    { pairId: "b", a: "x", b: "y", score: 0 },
    { pairId: "a", a: "x", b: "y", score: 1 },
  ];
  assert.deepEqual(calculateElo(games), calculateElo([...games].reverse()));
  const r = calculateElo(games);
  assert.ok(Math.abs(r.x + r.y - 2000) < 1e-9);
  assert.equal(
    calculateElo([{ pairId: "a", a: "x", b: "y", score: 1 }]).x,
    1012,
  );
});
test("partial seed groups do not count as independent completed samples", async () => {
  const { planExperiment, aggregateExperiment } =
    await import("../analysis/experiment.js");
  const c = config(),
    tasks = planExperiment(c).orderedTasks,
    results = tasks
      .slice(0, 3)
      .map((j) => ({
        jobId: j.jobId,
        result: {
          config: j.config,
          teams: j.config.entrants.map((e, i) => ({ ...e, score: 10 - i })),
        },
      }));
  const s = aggregateExperiment(results, c);
  assert.equal(s.independentSeeds, 0);
  const last = tasks[3];
  results.push({
    jobId: last.jobId,
    result: {
      config: last.config,
      teams: last.config.entrants.map((e, i) => ({ ...e, score: 10 - i })),
    },
  });
  const a = aggregateExperiment(results, c);
  assert.equal(a.independentSeeds, 1);
  assert.equal(a.teams[0].interval, null);
  assert.deepEqual(a, aggregateExperiment([...results].reverse(), c));
});
