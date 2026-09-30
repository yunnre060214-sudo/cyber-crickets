import test from "node:test";
import assert from "node:assert/strict";
const cfg = (n = 4, format = "round_robin") => ({
  id: "t",
  name: "T",
  format,
  seed: "t",
  durationMs: 10000,
  mode: "standard",
  mapPreset: "plain",
  mapCount: 1,
  swissRounds: 3,
  entrants: Array.from({ length: n }, (_, i) => ({
    participantId: "p" + i,
    strategyId: ["bfs", "dfs", "greedy", "random"][i % 4],
  })),
});
test("all valid sizes schedule every pair once or twice", async () => {
  const { createTournament } = await import("../competition/tournament.js");
  for (const n of [4, 8, 16])
    for (const format of ["round_robin", "double_round_robin"]) {
      const t = createTournament(cfg(n, format)),
        fs = t.rounds.flatMap((r) => r.fixtures);
      assert.equal(
        fs.length,
        ((n * (n - 1)) / 2) * (format === "round_robin" ? 1 : 2),
      );
      assert.equal(
        new Set(fs.map((f) => [...f.entrants].sort().join(","))).size,
        (n * (n - 1)) / 2,
      );
    }
});
test("three maps produce six swapped legs with stable participant identities and paired seeds", async () => {
  const { createTournament, Tournament } =
      await import("../competition/tournament.js"),
    { fixtureJobs } = await import("../competition/fixture.js");
  const t = createTournament({ ...cfg(), mapCount: 3 }),
    f = t.rounds[0].fixtures[0],
    jobs = fixtureJobs(f, t.config);
  assert.equal(jobs.length, 6);
  for (let i = 0; i < 6; i += 2) {
    assert.equal(jobs[i].config.seed, jobs[i + 1].config.seed);
    assert.deepEqual(
      jobs[i].config.entrants.map((e) => e.participantId),
      jobs[i + 1].config.entrants.map((e) => e.participantId).reverse(),
    );
  }
  assert.deepEqual(Tournament.fromJSON(t.toJSON()).toJSON(), t.toJSON());
});
test("groups advance only top two and knockout reaches one champion", async () => {
  const { createTournament } = await import("../competition/tournament.js");
  for (const n of [8, 16]) {
    const t = createTournament(cfg(n, "group_knockout"));
    let count = 0;
    while (t.status !== "completed") {
      for (const f of t.rounds.find((r) => !r.completed).fixtures) {
        const a = Object.fromEntries(
          f.entrants.map((id, i) => [
            id,
            { vp: i ? 1 : 2, captures: 0, territory: 1 },
          ]),
        );
        t.applyFixtureResult(f.id, {
          winner: f.entrants[0],
          aggregates: a,
          legs: [],
        });
      }
      assert.ok(++count < 8);
    }
    assert.equal(
      t.rounds.find((r) => r.phase === "knockout").fixtures.length,
      n / 4,
    );
    assert.ok(t.champion());
  }
});
test("Swiss pairing prioritizes avoiding repeats over arbitrary point gaps", async () => {
  const { swissPairs } = await import("../competition/formats.js");
  const ranked = [
      { id: "a", points: 0, seedRank: 0 },
      { id: "b", points: 100000, seedRank: 1 },
      { id: "c", points: 1, seedRank: 2 },
      { id: "d", points: 100001, seedRank: 3 },
    ],
    pairs = swissPairs(ranked, new Set(["a:c", "b:d"]));
  assert.equal(
    pairs.some((p) => ["a:c", "b:d"].includes([...p].sort().join(":"))),
    false,
  );
});
test("classic fixtures keep frozen paired-leg scores and tie policy", async () => {
  const { ClassicTournamentAdapter } = await import("../competition/legacy.js"),
    { Tournament, runDuel } = await import("../legacy/v1/tournament.js"),
    { createMatch } = await import("../engine/factory.js");
  const t = new Tournament({
      seed: "old",
      format: "knockout",
      duration: 10,
      entrants: [
        "bfs",
        "dfs",
        "greedy",
        "random",
        "aco",
        "voronoi",
        "potential",
        "pid",
      ],
    }),
    a = new ClassicTournamentAdapter(t.toJSON()),
    f = t.nextRound.fixtures[0],
    jobs = a.nextJobs().filter((j) => j.fixtureId === f.id),
    results = jobs.map((j) => {
      const m = createMatch(j.config);
      while (!m.getSnapshot().finished) m.advance(100);
      return m.getResult();
    });
  assert.equal(jobs[0].config.ruleVersion, "v1-eff46735");
  assert.deepEqual(a.aggregate(f, results), runDuel(f, t.config));
});
