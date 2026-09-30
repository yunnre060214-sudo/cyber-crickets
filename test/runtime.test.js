import test from "node:test";
import assert from "node:assert/strict";
import { testConfig } from "./support/factories.js";
import { canonicalHash } from "../engine/hash.js";
test("worker pause and all playback speeds produce identical engine results", async () => {
  const { createMatchWorkerService } =
    await import("../workers/match-worker.js");
  const hashes = [];
  for (const speed of [0.25, 1, 2, 20]) {
    const tasks = [],
      out = [];
    let time = 0;
    const s = createMatchWorkerService({
      emit: (m) => out.push(m),
      schedule: (cb) => tasks.push(cb),
      now: () => time,
    });
    const send = (type, payload = {}) =>
      s.handle({
        protocolVersion: 1,
        requestId: type,
        matchId: "run",
        type,
        payload,
      });
    await send("create", { config: testConfig() });
    await send("setSpeed", { speed });
    await send("start");
    let turns = 0;
    while (!out.some((m) => m.type === "result")) {
      time += 100;
      tasks.shift()?.();
      if (++turns === 3) {
        await send("pause");
        const tick = out.filter((m) => m.type === "snapshot").at(-1)
          .payload.tick;
        time += 300;
        tasks.shift()?.();
        assert.equal(
          out.filter((m) => m.type === "snapshot").at(-1).payload.tick,
          tick,
        );
        await send("resume");
      }
      assert.ok(turns < 600);
    }
    hashes.push(canonicalHash(out.find((m) => m.type === "result").payload));
    s.dispose();
  }
  assert.equal(new Set(hashes).size, 1);
});
test("queue honors pause, cancel and duplicate identifiers", async () => {
  const { JobQueue } = await import("../runtime/job-queue.js");
  const calls = [],
    results = [];
  const q = new JobQueue({
    execute: async (j) => {
      calls.push(j.jobId);
      return {};
    },
    onResult: (j, r) => results.push(j.jobId),
  });
  q.pause();
  q.enqueue([{ jobId: "a" }, { jobId: "b" }, { jobId: "a" }]);
  q.cancel("b");
  await Promise.resolve();
  assert.equal(calls.length, 0);
  q.resume();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(calls, ["a"]);
  assert.deepEqual(results, ["a"]);
  q.dispose();
});
test("clients assign unique runs and discard stale snapshots", async () => {
  const { createMatchClient } = await import("../runtime/match-client.js");
  let listener;
  const fake = {
    addEventListener: (_t, f) => (listener = f),
    postMessage(m) {
      queueMicrotask(() =>
        listener({ data: { ...m, type: "ack", payload: {} } }),
      );
    },
    terminate() {},
  };
  const c = createMatchClient(testConfig(), { transport: fake });
  await c.start();
  let count = 0;
  c.subscribe(() => count++);
  listener({
    data: {
      protocolVersion: 1,
      type: "snapshot",
      matchId: "old",
      payload: { tick: 999 },
    },
  });
  assert.equal(count, 0);
  await c.dispose();
});
