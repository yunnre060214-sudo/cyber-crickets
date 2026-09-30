import test from "node:test";
import assert from "node:assert/strict";
import { MemoryBackend } from "./support/memory-backend.js";
import { createRecordStore } from "../storage/records.js";
import { testTournamentConfig } from "./support/factories.js";
test("refresh runs only unfinished legs and duplicate results never count twice", async () => {
  const { createCompetitionController } =
    await import("../runtime/competition-jobs.js");
  const store = createRecordStore({ backend: new MemoryBackend() }),
    jobs = [],
    queue = {
      enqueue: (j) => jobs.push(...j),
      pause() {},
      resume() {},
      cancel() {},
    };
  const c = createCompetitionController({ store, queue });
  const id = await c.create(testTournamentConfig());
  await c.run(id);
  const first = jobs[0],
    result = {
      config: first.config,
      teams: first.config.entrants.map((e, i) => ({
        ...e,
        score: i ? 1 : 2,
        territory: 1,
        captures: 0,
      })),
      timeMs: 10000,
      finished: true,
      ledger: [],
      integrityHash: "test",
    };
  await queue.onResult(first, result);
  await queue.onResult(first, result);
  assert.equal((await store.get(id)).index.completedTasks, 1);
  const pending = [],
    q2 = {
      enqueue: (j) => pending.push(...j),
      pause() {},
      resume() {},
      cancel() {},
    };
  const d = createCompetitionController({ store, queue: q2 });
  await d.run(id);
  assert.equal(
    pending.some((j) => j.jobId === first.jobId),
    false,
  );
  assert.equal(pending.length, 3);
});
