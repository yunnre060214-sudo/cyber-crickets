import test from "node:test";
import assert from "node:assert/strict";
test("old match logs provide archives but never fabricated resume checkpoints", async () => {
  const { importPackage } = await import("../export/import.js");
  const { Match } = await import("../match.js"),
    { buildFullData } = await import("../export/model.js");
  const m = new Match({
    seed: "old",
    duration: 10,
    strategies: ["bfs", "dfs", "greedy", "random"],
  });
  while (!m.finished) m.step(0.035);
  const old = buildFullData({ match: m }),
    r = await importPackage(new File([JSON.stringify(old)], "old.json"));
  assert.equal(r.resume, false);
  assert.equal(r.archive, true);
  assert.equal(r.package.original.formatVersion, 2);
});
