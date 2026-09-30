import test from "node:test";
import assert from "node:assert/strict";
import { testConfig, resultDigest } from "./support/factories.js";
test("batch sizes never change complete results and each team gets 99 decisions", async () => {
  const { createMatch } = await import("../engine/factory.js");
  const results = [];
  for (const size of [1, 7, 100]) {
    const m = createMatch(testConfig());
    while (!m.getSnapshot().finished) m.advance(size);
    const r = m.getResult();
    assert.equal(r.timeMs, 10000);
    assert.equal(r.ledger.filter((t) => t.proposals.length).length, 99);
    assert.equal(r.ledger[4].timeMs, 100);
    assert.equal(r.ledger.at(-1).proposals.length, 0);
    for (const team of r.teams) {
      const sum = r.ledger
        .flatMap((t) => t.scoreDeltas)
        .filter((d) => d.participantId === team.participantId)
        .reduce((s, d) => s + d.areaVP + d.resourceVP, 0);
      assert.ok(Math.abs(sum - team.score) < 1e-9);
    }
    const score = m.getSnapshot().teams[0].score;
    m.advance(100);
    assert.equal(m.getSnapshot().teams[0].score, score);
    results.push(resultDigest(r));
  }
  assert.equal(new Set(results).size, 1);
});
test("checkpoints resume identically at events and end boundaries", async () => {
  const { createMatch } = await import("../engine/factory.js");
  for (const mode of ["standard", "migration"]) {
    const config = testConfig({ mode }),
      reference = createMatch(config);
    reference.advance(500);
    const digest = resultDigest(reference.getResult());
    for (const ms of [3280, 3300, 6180, 6200, 8180, 8200, 9980, 10000]) {
      const a = createMatch(config);
      a.advance(ms / 20);
      const cp = a.captureCheckpoint(),
        b = createMatch(config);
      b.restore(cp);
      b.advance(500);
      assert.equal(resultDigest(b.getResult()), digest, mode + " " + ms);
      assert.throws(() => b.restore({ ...cp, integrityHash: "invalid" }));
    }
    assert.throws(() => createMatch(config).getResult(), /MATCH_NOT_FINISHED/);
  }
});
