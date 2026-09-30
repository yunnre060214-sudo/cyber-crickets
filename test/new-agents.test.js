import test from "node:test";
import assert from "node:assert/strict";
import { generateMap } from "../engine/maps.js";
import { testConfig } from "./support/factories.js";
import { createBudget } from "../agents/budget.js";
import { createRng } from "../engine/rng.js";
test("A star takes a real four-edge detour around a blocked direct cell", async () => {
  const { findPath } = await import("../agents/pathfinder.js");
  const { board } = generateMap(testConfig());
  board.terrain.fill(1);
  board.owner.fill(-1);
  board.core.fill(-1);
  board.blocked.fill(0);
  board.blocked[326] = 1;
  const r = findPath(board, 325, 327, { seat: 0, budget: createBudget() });
  assert.equal(r.cost, 4);
  assert.equal(r.path.length, 5);
  assert.equal(r.path.includes(326), false);
  assert.ok(r.expanded > 0);
});
test("boundary scheduling favors supported resource protection", async () => {
  const { createAgent, AGENT_REGISTRY } = await import("../agents/registry.js");
  assert.equal(AGENT_REGISTRY.length, 21);
  const a = createAgent("boundary", {
      seat: 0,
      participantId: "a",
      rng: createRng("s", "a"),
      size: 4096,
    }),
    options = [
      {
        from: 0,
        to: 1,
        ownN: 1,
        enemyN: 2,
        enemyPressure: 0.5,
        resource: 0,
        protectedResourceValue: 0,
        terrain: 1,
      },
      {
        from: 0,
        to: 2,
        ownN: 3,
        enemyN: 1,
        enemyPressure: 0.25,
        resource: 0,
        protectedResourceValue: 3,
        terrain: 1,
      },
    ];
  assert.equal(
    a.selectAction(
      { options, remaining: 10, cellCount: 4096, resourceTotal: 48 },
      createBudget(),
    ).to,
    2,
  );
});
test("UCB initializes all four arms and updates actual counts before exploration", async () => {
  const { createAgent } = await import("../agents/registry.js");
  const a = createAgent("ucb", {
      seat: 0,
      participantId: "a",
      rng: createRng("s", "a"),
      size: 4096,
    }),
    o = {
      from: 0,
      to: 1,
      ownN: 1,
      enemyN: 0,
      enemy: false,
      resource: 0,
      terrain: 1,
      resourcePull: 0,
    };
  for (let i = 0; i < 4; i++) {
    a.selectAction({ options: [o], vpRate: i, remaining: 10 }, createBudget());
    assert.equal(a.pendingMacro, i);
  }
  a.selectAction({ options: [o], vpRate: 4 }, createBudget());
  assert.deepEqual(a.counts, [1, 1, 1, 1]);
  assert.deepEqual(a.values, [1, 1, 1, 1]);
  assert.equal(a.pendingMacro, 0);
});
