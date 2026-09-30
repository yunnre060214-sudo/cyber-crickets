import test from "node:test";
import assert from "node:assert/strict";
import { createAcceptanceMatrix } from "../scripts/acceptance.mjs";
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
