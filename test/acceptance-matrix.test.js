import test from "node:test";
import assert from "node:assert/strict";
import { createAcceptanceMatrix } from "../scripts/acceptance.mjs";
import { evaluateAcceptanceGame } from "../scripts/acceptance-game.mjs";
import { runAcceptanceJobs } from "../scripts/acceptance-pool.mjs";
test("parallel acceptance preserves production game hashes and executes each job once", async () => {
  const jobs = createAcceptanceMatrix(
    Array.from({ length: 8 }, (_, i) => "pool-proof-" + i),
  )
    .slice(0, 2)
    .map((job) => ({ ...job, config: { ...job.config, durationMs: 10000 } }));
  const expected = jobs.map(evaluateAcceptanceGame);
  const actual = [];
  await runAcceptanceJobs(jobs, {
    concurrency: 2,
    onComplete: (record) => actual.push(record),
  });
  assert.equal(actual.length, 2);
  assert.equal(new Set(actual.map((record) => record.game.id)).size, 2);
  actual.sort((a, b) => a.game.id.localeCompare(b.game.id));
  for (let i = 0; i < jobs.length; i++) {
    assert.equal(actual[i].game.canonicalHash, expected[i].canonicalHash);
    assert.equal(actual[i].game.sha256, expected[i].sha256);
    assert.deepEqual(actual[i].game.teams, expected[i].teams);
    assert.equal(actual[i].game.timeMs, 10000);
  }
});
test("acceptance uses 128 four-way holdouts, eight long matches and twelve paired duels", () => {
  const matrix = createAcceptanceMatrix(
    Array.from({ length: 8 }, (_, i) => "independent-" + i),
  );
  assert.equal(matrix.length, 148);
  assert.equal(matrix.filter((j) => j.category === "holdout").length, 128);
  for (const seed of new Set(
    matrix.filter((j) => j.category === "holdout").map((j) => j.config.seed),
  )) {
    const jobs = matrix.filter(
      (j) => j.category === "holdout" && j.config.seed === seed,
    );
    assert.equal(jobs.length, 16);
    assert.equal(new Set(jobs.map((j) => j.config.mapPreset)).size, 4);
  }
  assert.equal(matrix.filter((j) => j.config.durationMs === 180000).length, 4);
  assert.equal(matrix.filter((j) => j.config.durationMs === 400000).length, 4);
  assert.equal(matrix.filter((j) => j.category === "duel").length, 12);
  assert.equal(new Set(matrix.map((j) => j.id)).size, 148);
});
