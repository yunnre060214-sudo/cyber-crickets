import test from "node:test";
import assert from "node:assert/strict";
import { decodeMatchQuery, encodeMatchQuery } from "../ui/router.js";
import { createMatchConfig } from "../engine/config.js";
import { htmlSafe } from "../export/model.js";
test("shareable classic configurations preserve seed rotation lineup and scoring context", () => {
  const c = createMatchConfig(
    decodeMatchQuery(
      "?seed=abc&rotation=1&agents=dfs,greedy,random,pid&duration=60",
    ).configInput,
  );
  assert.equal(c.mode, "classic");
  assert.equal(c.seed, "abc");
  assert.equal(c.rotation, 1);
  assert.equal(c.durationMs, 60000);
  assert.deepEqual(
    c.entrants.map((e) => e.strategyId),
    ["dfs", "greedy", "random", "pid"],
  );
  assert.deepEqual(
    createMatchConfig(decodeMatchQuery(encodeMatchQuery(c, 1)).configInput),
    c,
  );
});
test("untrusted seed text stays text in portable reports", () => {
  const malicious = "<img src=x onerror=alert(1)>";
  assert.equal(createMatchConfig({ seed: malicious }).seed, malicious);
  assert.doesNotMatch(htmlSafe(malicious), /<img/);
});
