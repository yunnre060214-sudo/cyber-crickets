import test from "node:test";
import assert from "node:assert/strict";
import { Match } from "../match.js";

const config = {
  seed: "20260927",
  rotation: 2,
  duration: 60,
  strategies: ["aco", "mcts", "qlearn", "voronoi"],
};

function outcome(match) {
  return {
    owner: Array.from(match.owner),
    terrain: Array.from(match.terrain),
    resources: Array.from(match.resources),
    teams: match.teams.map((a) => ({
      score: a.score,
      territory: a.territory,
      resources: a.resources,
      captures: a.captures,
      lastMove: a.lastMove?.to,
    })),
  };
}

test("same seed, agents, rotation and steps replay exactly, without global randomness", () => {
  const oldRandom = Math.random;
  Math.random = () => {
    throw new Error("global random used during a match");
  };
  try {
    const a = new Match(config),
      b = new Match(config);
    for (let tick = 0; tick < 400; tick++) {
      a.step(0.035);
      b.step(0.035);
    }
    assert.deepEqual(outcome(a), outcome(b));
    assert.ok(a.teams.some((team) => team.score > 0));
  } finally {
    Math.random = oldRandom;
  }
});

test("rotating spawn slots keeps the generated terrain and resources fixed", () => {
  const a = new Match({ ...config, rotation: 0 });
  const b = new Match({ ...config, rotation: 1 });
  assert.deepEqual(Array.from(a.terrain), Array.from(b.terrain));
  assert.deepEqual(Array.from(a.resources), Array.from(b.resources));
  assert.equal(a.owner[5 + 5 * 64], 0);
  assert.equal(b.owner[5 + 5 * 64], 3);
});

test("a full match accumulates only VP from control and ends at the selected duration", () => {
  const match = new Match({ ...config, duration: 1 });
  for (let i = 0; i < 40; i++) match.step(0.035);
  assert.equal(match.time, 1);
  assert.equal(match.finished, true);
  const oldScores = match.teams.map((a) => a.score);
  match.step(0.035);
  assert.deepEqual(
    match.teams.map((a) => a.score),
    oldScores,
  );
});

test("duel seats use opposite sides and keep the same map and entrant random streams after swapping", () => {
  const left = new Match({
    seed: "duel",
    duration: 60,
    strategies: ["random", "greedy"],
    agentKeys: ["entry-a", "entry-b"],
  });
  const right = new Match({
    seed: "duel",
    duration: 60,
    strategies: ["greedy", "random"],
    agentKeys: ["entry-b", "entry-a"],
  });
  assert.equal(left.owner[32 * 64 + 5], 0);
  assert.equal(left.owner[32 * 64 + 58], 1);
  assert.equal(right.owner[32 * 64 + 5], 0);
  assert.deepEqual(Array.from(left.terrain), Array.from(right.terrain));
  assert.deepEqual(Array.from(left.resources), Array.from(right.resources));
  assert.equal(left.teams[0].agent.rng.next(), right.teams[1].agent.rng.next());
});

test("timeline records deterministic one-second snapshots and the final state", () => {
  const a = new Match({ ...config, duration: 3 });
  const b = new Match({ ...config, duration: 3 });
  while (!a.finished) a.step(0.035);
  while (!b.finished) b.step(0.035);
  assert.deepEqual(a.timeline, b.timeline);
  assert.equal(a.timeline[0].time, 0);
  assert.equal(a.timeline.at(-1).time, 3);
  assert.ok(a.timeline.length >= 4);
  assert.equal(a.timeline.at(-1).teams.length, 4);
});

test("decision and major-event logs preserve AI-analysis context", () => {
  const match = new Match({ ...config, duration: 3 });
  while (!match.finished) match.step(0.035);
  assert.ok(match.decisionLog.length > 0);
  const decision = match.decisionLog[0];
  assert.equal(decision.seq, 1);
  assert.equal(typeof decision.thought, "string");
  assert.ok(Number.isFinite(decision.time));
  assert.ok(Number.isInteger(decision.from.x));
  assert.ok(Number.isInteger(decision.to.y));
  assert.ok(decision.target && Number.isFinite(decision.target.enemyPressure));
  assert.ok(Number.isInteger(decision.rank) && decision.rank >= 1);
  assert.ok(Number.isFinite(decision.scoreGap));
  assert.ok(Number.isFinite(decision.vpRate));
  assert.ok(decision.result && typeof decision.result.success === "boolean");
  assert.ok(match.eventLog.some((event) => event.type === "major"));
});

test("continuations remove the captured origin from enemy support without changing the live map", () => {
  const match = new Match({ ...config, strategies: ["strongest", "random"] });
  match.owner.fill(-1);
  match.core.fill(-1);
  match.resources.fill(0);
  match.resourceCells = [];
  match.resourceTotal = 0;
  const from = 30 * 64 + 30,
    to = 30 * 64 + 31,
    next = 30 * 64 + 32;
  match.owner[from] = 0;
  match.owner[to] = 1;
  match.owner[next] = 1;
  const before = match.enrich(0, { from: to, to: next, dir: [1, 0] });
  assert.equal(before.enemyN, 1);
  assert.equal(before.enemyPressure, 0.25);
  const continuation = match
    .continuations(0, { from, to, dir: [1, 0] })
    .find((x) => x.to === next);
  assert.equal(continuation.ownN, 1);
  assert.equal(continuation.enemyN, 0);
  assert.equal(continuation.enemyPressure, 0);
  assert.equal(match.owner[to], 1);
});

test("every agent receives the same public rival scores and production rates", () => {
  const match = new Match({
    ...config,
    strategies: ["strongest", "random", "bfs", "mst"],
  });
  match.teams[0].score = 20;
  match.teams[1].score = 18;
  match.teams[2].score = 17;
  const seen = [];
  for (const team of match.teams) {
    team.agent.selectAction = (v) => {
      seen.push(v);
      return v.options[0];
    };
  }
  match.step(0.035);
  assert.equal(seen.length, 4);
  for (const view of seen) {
    assert.equal(view.opponents.length, 3);
    assert.ok(view.opponents.every((x) => x.id !== view.id));
    assert.ok(
      view.opponents.every(
        (x) => Number.isFinite(x.vpRate) && Number.isFinite(x.score),
      ),
    );
  }
  assert.equal(seen[0].opponents.find((x) => x.id === 1).score, 18);
  assert.equal(seen[1].opponents.find((x) => x.id === 0).score, 20);
});

test("public targets expose nearby threatened friendly resource value", () => {
  const match = new Match({ ...config, strategies: ["strongest", "random"] });
  match.owner.fill(-1);
  match.core.fill(-1);
  match.resources.fill(0);
  const from = 30 * 64 + 30,
    to = 30 * 64 + 31;
  match.owner[from] = 0;
  match.resources[from] = 3;
  match.owner[to] = 1;
  const exposed = match.enrich(0, { from, to, dir: [1, 0] });
  assert.equal(exposed.protectedResourceValue, 3);
  match.owner[to] = -1;
  assert.equal(
    match.enrich(0, { from, to, dir: [1, 0] }).protectedResourceValue,
    0,
  );
});

test("a continuation stops attracting the agent back toward the resource just captured", () => {
  const match = new Match({ ...config, strategies: ["strongest", "random"] });
  match.owner.fill(-1);
  match.core.fill(-1);
  match.resources.fill(0);
  const from = 30 * 64 + 30,
    to = 30 * 64 + 31,
    next = 30 * 64 + 32;
  match.owner[from] = 0;
  match.resources[to] = 3;
  match.resources[30 * 64 + 40] = 1;
  match.resourceCells = [to, 30 * 64 + 40];
  match.resourceTotal = 4;
  const continuation = match
    .continuations(0, { from, to, dir: [1, 0] })
    .find((x) => x.to === next);
  assert.equal(continuation.nearestResourceDist, 8);
  assert.equal(match.owner[to], -1);
});

test("strongest full matches replay exactly with public forecasts and virtual capture views", () => {
  const options = {
    seed: "strongest-v6-replay",
    rotation: 1,
    duration: 25,
    strategies: ["strongest", "qlearn", "minimax", "denial"],
  };
  const a = new Match(options),
    b = new Match(options);
  while (!a.finished) a.step(0.035);
  while (!b.finished) b.step(0.035);
  assert.deepEqual(outcome(a), outcome(b));
  assert.deepEqual(a.timeline, b.timeline);
  assert.ok(a.decisionLog.every((x) => x.result && Number.isFinite(x.vpRate)));
});
