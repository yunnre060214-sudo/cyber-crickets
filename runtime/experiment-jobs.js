import { planExperiment, aggregateExperiment } from "../analysis/experiment.js";
import { createWorkerJobQueue } from "./worker-job-queue.js";
import { resultReplay, compactResult } from "./result-replay.js";
export function createExperimentController({ store, queue } = {}) {
  const listeners = new Set(),
    runs = new Map(),
    getStore = () => Promise.resolve(store),
    notify = (e) => listeners.forEach((f) => f(e));
  async function load(id) {
    const s = await getStore(),
      record = await s.get(id),
      results = await s.taskResults(id),
      summary = aggregateExperiment(results, record.state.config),
      data = { id, record, results, summary };
    notify(data);
    return data;
  }
  async function completed(job, result) {
    const s = await getStore(),
      id = job.recordId,
      replayId = id + ":match:" + job.jobId;
    await s.putPackage(
      {
        id: replayId,
        type: "match",
        schemaVersion: 3,
        index: {
          name: job.config.seed,
          seed: job.config.seed,
          finished: true,
          timeMs: result.timeMs,
        },
        payloadRefs: [],
      },
      resultReplay(job, result),
    );
    await s.putTaskResult(id, job.jobId, {
      ...compactResult(result, job.observations),
      replayId,
    });
    const data = await load(id);
    if (data.summary.completedMatches === data.summary.totalMatches) {
      const r = await s.get(id);
      await s.put(
        { ...r, index: { ...r.index, status: "completed" } },
        { expectedRevision: r.revision },
      );
    }
  }
  const c = {
    preview(config) {
      const plan = planExperiment(config);
      return Object.freeze({
        config: Object.freeze(plan.config),
        totalMatches: plan.orderedTasks.length,
        independentSeeds: plan.config.seedList.length,
      });
    },
    async create(config) {
      const s = await getStore(),
        plan = planExperiment(config);
      await s.put(
        {
          id: plan.config.id,
          type: "experiment",
          schemaVersion: 3,
          index: { name: plan.config.name, status: "ready", completedTasks: 0 },
          payloadRefs: [],
          state: plan,
          sourceHash:
            new URL(import.meta.url).pathname.match(
              /assets\/([a-f0-9]{12})\//,
            )?.[1] ?? "development",
        },
        { expectedRevision: 0 },
      );
      return plan.config.id;
    },
    async run(id) {
      const s = await getStore(),
        data = await load(id),
        done = new Set(data.results.map((r) => r.jobId));
      if (!runs.has(id)) {
        const callbacks = {
            onResult: completed,
            onProgress: (jobs, job, progress) => {
              notify({ id, jobs, progress });
              if (progress?.checkpoint)
                s.putJobCheckpoint(id, job.jobId, progress.checkpoint).catch(
                  (e) => {
                    runs.get(id)?.pause();
                    notify({ id, error: "保存失败：" + e.message });
                  },
                );
            },
          },
          q = queue ?? createWorkerJobQueue(callbacks);
        Object.assign(q, callbacks);
        runs.set(id, q);
      }
      const q = runs.get(id),
        jobs = data.record.state.orderedTasks
          .filter((j) => !done.has(j.jobId))
          .map((j) => ({ ...j, recordId: id }));
      for (const j of jobs) {
        const cp = await s.getJobCheckpoint(id, j.jobId);
        if (cp) j.checkpoint = cp;
      }
      q.enqueue(jobs);
      q.resume();
    },
    pause(id) {
      runs.get(id)?.pause();
      notify({ id, status: "paused" });
    },
    resume(id) {
      return c.run(id);
    },
    cancelPending(id) {
      const q = runs.get(id);
      if (q) {
        for (const j of q.jobs?.values?.() ?? [])
          if (j.status === "pending") q.cancel(j.jobId);
      }
      notify({ id, status: "cancelled" });
    },
    subscribe(f) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    load,
    list: async () =>
      (await (await getStore()).list({ type: "experiment" })).items,
  };
  return c;
}
