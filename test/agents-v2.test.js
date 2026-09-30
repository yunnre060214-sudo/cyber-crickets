import test from "node:test";
import assert from "node:assert/strict";
import { STRATEGY_IDS } from "../engine/config.js";
import { createRng } from "../engine/rng.js";
import { createBudget } from "../agents/budget.js";
import { generateMap } from "../engine/maps.js";
import { FrontierIndex } from "../engine/frontier.js";
import { buildAgentView } from "../agents/context.js";
import { testConfig } from "./support/factories.js";
test("all eighteen strategies deterministically restore decisions and their independent RNG", async () => {
  const { createAgent } = await import("../agents/registry.js");
  const config = testConfig(),
    { board } = generateMap(config),
    options = new FrontierIndex(board).options(0),
    teams = config.entrants.map((e, seat) => ({
      ...e,
      seat,
      score: 0,
      vpRate: 0.1,
      territory: 9,
      resources: 0,
    })),
    v = buildAgentView({ config, timeMs: 1000, board, teams }, 0, options);
  for (const id of STRATEGY_IDS.slice(0, 18)) {
    const ctx = () => ({
        participantId: "p0",
        seat: 0,
        rng: createRng("state", "p0"),
        size: 4096,
        parameters: {},
        budgetProfile: "standard",
      }),
      a = createAgent(id, ctx()),
      b = createAgent(id, ctx());
    const first = a.selectAction(v, createBudget());
    a.onResult({
      seat: 0,
      participantId: "p0",
      move: first,
      success: true,
      reward: 5,
    });
    b.importState(a.exportState());
    assert.deepEqual(b.exportState(), a.exportState(), id);
    assert.deepEqual(
      a.selectAction(v, createBudget()),
      b.selectAction(v, createBudget()),
      id,
    );
    const budget = createBudget();
    budget.consume("score", 8192);
    assert.equal(a.selectAction(v, budget)?.to, options[0].to);
    assert.equal(a.selectAction({ ...v, options: [] }, createBudget()), null);
  }
});
test("agent state rejects mismatched versions and unknown fields", async () => {
  const { createAgent } = await import("../agents/registry.js");
  const a = createAgent("aco", {
      participantId: "p0",
      seat: 0,
      rng: createRng("x", "p0"),
      size: 4096,
      parameters: {},
    }),
    s = a.exportState();
  assert.throws(() => a.importState({ ...s, version: "999" }));
  s.fields.dangerous = 1;
  assert.throws(() => a.importState(s));
});
