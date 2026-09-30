import test from "node:test";
import assert from "node:assert/strict";
import { createRecordStore } from "../storage/records.js";
import { MemoryBackend } from "./support/memory-backend.js";
import { testExperimentConfig } from "./support/factories.js";
test("preview is read-only and refresh skips completed jobs without increasing samples", async () => {
  const { createExperimentController } =
    await import("../runtime/experiment-jobs.js");
  const store = createRecordStore({ backend: new MemoryBackend() }),
    jobs = [],
    queue = {
      enqueue: (list) => jobs.push(...list),
      pause() {},
      resume() {},
      cancel() {},
    };
  const c = createExperimentController({ store, queue }),
    config = testExperimentConfig();
  assert.equal(c.preview(config).totalMatches, 32);
  assert.equal((await store.list()).items.length, 0);
  const id = await c.create(config);
  await c.run(id);
  const j = jobs[0],
    r = {
      config: j.config,
      finished: true,
      timeMs: 10000,
      ledger: [],
      teams: j.config.entrants.map((e, i) => ({
        ...e,
        score: 4 - i,
        territory: 1,
      })),
    };
  await queue.onResult(j, r);
  await queue.onResult(j, r);
  const state = await c.load(id);
  assert.equal(state.summary.completedMatches, 1);
  assert.equal(state.summary.independentSeeds, 0);
  const next = [],
    d = createExperimentController({
      store,
      queue: {
        enqueue: (list) => next.push(...list),
        pause() {},
        resume() {},
        cancel() {},
      },
    });
  await d.run(id);
  assert.equal(next.length, 31);
});
