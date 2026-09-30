import test from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../engine/factory.js";
import { testConfig, testExperimentConfig } from "./support/factories.js";
import { JobQueue } from "../runtime/job-queue.js";
import { createRecordStore } from "../storage/records.js";
import { MemoryBackend } from "./support/memory-backend.js";
import { createExperimentController } from "../runtime/experiment-jobs.js";
import { createJobExport } from "../export/jobs.js";
import { importPackage } from "../export/import.js";
import { createQueueWorkerService } from "../workers/queue-worker.js";
import { buildReplayPackage } from "../replay/ledger.js";
test("classic resource holding follows its original post-action integration", () => {
  const m = createMatch(testConfig({ mode: "classic" })),
    expected = [0, 0, 0, 0];
  while (!m.getSnapshot().finished) {
    const before = m.getSnapshot().timeMs;
    m.advance(1);
    const after = m.getSnapshot();
    after.teams.forEach(
      (t, i) => (expected[i] += (t.resources * (after.timeMs - before)) / 1000),
    );
  }
  const replay = buildReplayPackage({
    checkpoint: m.captureCheckpoint(),
    initialBoard: m.getInitialBoard(),
    ledger: m.readLedger().records,
    snapshot: m.getSnapshot(),
  });
  replay.summary.teams.forEach((t, i) =>
    assert.ok(Math.abs(t.resourceValueSeconds - expected[i]) < 1e-8),
  );
});
test("decision observations are measured separately from reproducible results", () => {
  for (const mode of ["standard", "classic"]) {
    const m = createMatch(testConfig({ mode }));
    m.advance(500);
    const observations = m.getObservations();
    assert.equal(observations.length, 4);
    for (const o of observations) {
      assert.ok(o.samples > 0);
      assert.ok(o.meanThinkMs >= 0 && Number.isFinite(o.meanThinkMs));
      assert.ok(o.meanBudgetUsed >= 0 && o.meanBudgetUsed <= 8192);
    }
    assert.ok(
      m.getResult().teams.every((t) => !Object.hasOwn(t, "meanThinkMs")),
    );
  }
});
test("classic canonical results and checkpoints exclude wall-clock observations", () => {
  const config = testConfig({ mode: "classic" }),
    a = createMatch(config),
    b = createMatch(config);
  a.advance(100);
  b.advance(100);
  assert.deepEqual(a.captureCheckpoint(), b.captureCheckpoint());
  a.advance(500);
  b.advance(500);
  assert.deepEqual(a.getResult(), b.getResult());
});
test("explicit re-enqueue restarts cancelled jobs while duplicate completed jobs stay completed", async () => {
  const calls = [],
    q = new JobQueue({
      execute: async (j) => {
        calls.push(j.jobId);
        return {};
      },
    });
  q.pause();
  q.enqueue([{ jobId: "a" }, { jobId: "b" }]);
  q.cancel("b");
  q.resume();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(calls, ["a"]);
  q.enqueue([{ jobId: "a" }, { jobId: "b" }]);
  q.resume();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(calls, ["a", "b"]);
  q.dispose();
});
test("an unfinished experiment package imports all results and schedules only remaining jobs", async () => {
  const store = createRecordStore({ backend: new MemoryBackend() }),
    jobs = [];
  const queue = {
    enqueue: (list) => jobs.push(...list),
    resume() {},
    pause() {},
    jobs: new Map(),
  };
  const c = createExperimentController({ store, queue });
  const id = await c.create(
    testExperimentConfig({
      seedList: ["portable"],
      teamCount: 2,
      rosters: [testConfig().entrants.slice(0, 2)],
    }),
  );
  await c.run(id);
  const job = jobs[0],
    m = createMatch(job.config);
  m.advance(500);
  await queue.onResult(job, m.getResult());
  const output = await createJobExport(id, store, "data"),
    target = createRecordStore({ backend: new MemoryBackend() });
  const imported = await importPackage(
    new File([output.blob], output.filename),
    { store: target },
  );
  assert.equal(imported.resume, true);
  const remaining = [];
  const restored = createExperimentController({
    store: target,
    queue: {
      enqueue: (list) => remaining.push(...list),
      resume() {},
      pause() {},
    },
  });
  const loaded = await restored.load(imported.id);
  assert.equal(loaded.summary.completedMatches, 1);
  await restored.run(imported.id);
  assert.equal(remaining.length, 1);
  assert.notEqual(remaining[0].jobId, job.jobId);
  assert.ok(await target.getPackage(loaded.results[0].result.replayId));
  await importPackage(new File([output.blob], output.filename), {
    store: target,
  });
  assert.equal((await target.taskResults(imported.id)).length, 1);
});
test("the worker waits for durable result acknowledgement before advancing the queue", async () => {
  const out = [],
    service = createQueueWorkerService({
      emit: (m) => out.push(m),
      schedule: (cb) => setTimeout(cb, 0),
      now: () => 0,
    });
  const send = (type, payload = {}, jobId) =>
    service.handle({
      protocolVersion: 1,
      requestId: type,
      type,
      payload,
      jobId,
    });
  const config = testConfig({
    entrants: testConfig().entrants.map((e) => ({
      ...e,
      strategyId: "random",
    })),
  });
  await send("enqueue", {
    jobs: [
      { jobId: "durable-one", config },
      { jobId: "durable-two", config },
    ],
  });
  const wait = async (predicate) => {
    for (let i = 0; i < 200 && !predicate(); i++)
      await new Promise((r) => setTimeout(r, 10));
    assert.ok(predicate());
  };
  await wait(() => out.some((m) => m.type === "result"));
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(out.filter((m) => m.type === "result").length, 1);
  await send("resultAck", {}, "durable-one");
  await wait(() => out.filter((m) => m.type === "result").length === 2);
  await send("resultAck", {}, "durable-two");
  service.dispose();
});
