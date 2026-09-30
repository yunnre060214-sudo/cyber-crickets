import test from "node:test";
import assert from "node:assert/strict";
import { generateMap, neighbors } from "../engine/maps.js";
import { testConfig } from "./support/factories.js";
test("incremental frontiers include each legal target exactly once after control changes", async () => {
  const { FrontierIndex } = await import("../engine/frontier.js");
  const { board } = generateMap(testConfig());
  const f = new FrontierIndex(board);
  for (let turn = 0; turn < 50; turn++) {
    for (let seat = 0; seat < 4; seat++) {
      const expected = new Set();
      for (let i = 0; i < 4096; i++)
        if (board.owner[i] === seat)
          for (const n of neighbors(i))
            if (
              board.owner[n] !== seat &&
              board.core[n] < 0 &&
              !board.blocked[n]
            )
              expected.add(n);
      const opts = f.options(seat);
      assert.deepEqual(
        opts.map((o) => o.to),
        [...expected].sort((a, b) => a - b),
      );
      if (opts[0]) {
        const c = { index: opts[0].to, owner: seat };
        board.owner[c.index] = seat;
        f.applyChanges([c]);
      }
    }
  }
});
test("budgets charge exactly and refuse work once exhausted", async () => {
  const { createBudget } = await import("../agents/budget.js");
  const b = createBudget("standard");
  assert.equal(b.remaining, 8192);
  b.consume("score", 2);
  b.consume("rollout", 3);
  assert.equal(b.used, 14);
  assert.equal(b.remaining, 8178);
  assert.equal(b.consume("path", 8179), false);
  assert.equal(b.remaining, 8178);
});
