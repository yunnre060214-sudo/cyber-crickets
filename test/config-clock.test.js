import test from "node:test";
import assert from "node:assert/strict";
test("integer clock batches preserve boundaries and never advance after end", async () => {
  const { FixedClock } = await import("../engine/clock.js");
  const a = new FixedClock({ durationMs: 10000, tickMs: 20 }),
    b = new FixedClock({ durationMs: 10000, tickMs: 20 });
  assert.deepEqual(
    a.advance(500),
    Array.from({ length: 5 }, () => b.advance(100)).flat(),
  );
  assert.equal(a.timeMs, 10000);
  assert.deepEqual(a.advance(1), []);
});
test("config rejects invalid duration, identities, unsafe parameters and duel rotations", async () => {
  const { createMatchConfig } = await import("../engine/config.js");
  for (const durationMs of [NaN, 10001, 9999, 1801000])
    assert.throws(() => createMatchConfig({ durationMs }));
  assert.throws(() => createMatchConfig({ teamCount: 2, rotation: 2 }));
  assert.throws(() =>
    createMatchConfig({
      teamCount: 2,
      entrants: [
        { participantId: "x", strategyId: "random" },
        { participantId: "x", strategyId: "random" },
      ],
    }),
  );
  const c = createMatchConfig({
    teamCount: 2,
    entrants: [
      { participantId: "a", strategyId: "random" },
      { participantId: "b", strategyId: "random" },
    ],
  });
  assert.equal(c.entrants.length, 2);
  assert.ok(Object.isFrozen(c));
});
test("RNG restores exactly and independent streams stay independent", async () => {
  const { createRng, randomFor } = await import("../engine/rng.js");
  const a = createRng("s", "map");
  a.next();
  const b = createRng("s", "map", a.exportState());
  assert.deepEqual(
    Array.from({ length: 20 }, () => a.next()),
    Array.from({ length: 20 }, () => b.next()),
  );
  assert.notEqual(
    createRng("s", "map").next(),
    createRng("s", "agent:a").next(),
  );
  assert.equal(
    randomFor("s", { stream: "outcome", tick: 10, target: 1 }),
    randomFor("s", { target: 1, tick: 10, stream: "outcome" }),
  );
});
