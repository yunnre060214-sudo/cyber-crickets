import { Tournament, createTournament } from "../competition/tournament.js";
import { ClassicTournamentAdapter } from "../competition/legacy.js";
import { aggregateFixture, fixtureJobs } from "../competition/fixture.js";
import { createWorkerJobQueue } from "./worker-job-queue.js";
import { resultReplay, compactResult } from "./result-replay.js";
const model = (r) =>
  r.state?.legacy
    ? new ClassicTournamentAdapter(r.state.rawLegacy)
    : r.rawLegacy
      ? new ClassicTournamentAdapter(r.rawLegacy)
      : Tournament.fromJSON(r.state);
export function createCompetitionController({ store, queue } = {}) {
  const listeners = new Set(),
    runs = new Map();
  const getStore = () => Promise.resolve(store);
  const notify = (event) => listeners.forEach((f) => f(event));
  async function synchronize(id) {
    const s = await getStore();
    for (let attempt = 0; attempt < 10; attempt++) {
      const r = await s.get(id),
        t = model(r),
        results = await s.taskResults(id),
        byId = new Map(results.map((x) => [x.jobId, x.result]));
      let changed = true;
      while (changed) {
        changed = false;
        const round = t.rounds.find((r) => !r.completed);
        if (!round) break;
        for (const f of round.fixtures.filter((f) => !f.result)) {
          const jobs =
            t instanceof ClassicTournamentAdapter
              ? t.nextJobs().filter((j) => j.fixtureId === f.id)
              : fixtureJobs(f, t.config);
          if (!jobs.every((j) => byId.has(j.jobId))) continue;
          const legs = jobs.map((j) => byId.get(j.jobId)),
            result =
              t instanceof ClassicTournamentAdapter
                ? t.aggregate(f, legs)
                : aggregateFixture(f, legs);
          if (result.needsExtraMap) {
            f.extraMap = true;
            changed = true;
            continue;
          }
          t.applyFixtureResult(f.id, result);
          changed = true;
        }
      }
      try {
        const saved = await s.put(
          {
            ...r,
            state: t.toJSON(),
            index: {
              ...r.index,
              status: t.status,
              complete: t.status === "completed",
              champion: t.champion(),
            },
          },
          { expectedRevision: r.revision },
        );
        notify({ id, record: saved, tournament: t, results });
        return {
          record: saved,
          tournament: t,
          completed: new Set(byId.keys()),
        };
      } catch (e) {
        if (e.message !== "STALE_REVISION") throw e;
      }
    }
    throw Error("CONCURRENT_UPDATE_LIMIT");
  }
  async function enqueue(id) {
    const state = await synchronize(id),
      run = runs.get(id);
    if (!run || run.cancelled) return;
    const s = await getStore(),
      jobs = state.tournament
        .nextJobs()
        .filter((j) => !state.completed.has(j.jobId));
    for (const j of jobs) {
      j.recordId = id;
      const cp = await s.getJobCheckpoint(id, j.jobId);
      if (cp) j.checkpoint = cp;
    }
    run.queue.enqueue(jobs);
  }
  async function completed(job, result) {
    const s = await getStore(),
      id = job.recordId,
      replayId = id + ":match:" + job.jobId,
      pkg = resultReplay(job, result);
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
      pkg,
    );
    await s.putTaskResult(id, job.jobId, {
      ...compactResult(result, job.observations),
      replayId,
    });
    await enqueue(id);
  }
  function callbacks(id) {
    return {
      onResult: completed,
      onProgress: (jobs, job, progress) => {
        notify({ id, jobs, progress });
        if (progress?.checkpoint)
          getStore()
            .then((s) => s.putJobCheckpoint(id, job.jobId, progress.checkpoint))
            .catch((e) => {
              runs.get(id)?.queue.pause();
              notify({ id, error: "保存失败：" + e.message });
            });
      },
    };
  }
  const controller = {
    async create(config) {
      const s = await getStore(),
        t = createTournament(config);
      await s.put(
        {
          id: t.config.id,
          type: "competition",
          schemaVersion: 3,
          index: {
            name: t.config.name,
            format: t.config.format,
            status: "ready",
            completedTasks: 0,
          },
          payloadRefs: [],
          state: t.toJSON(),
        },
        { expectedRevision: 0 },
      );
      return t.config.id;
    },
    async run(id) {
      if (!runs.has(id)) {
        const cb = callbacks(id),
          q = queue ?? createWorkerJobQueue(cb);
        Object.assign(q, cb);
        runs.set(id, { queue: q, cancelled: false });
      }
      runs.get(id).cancelled = false;
      await enqueue(id);
      runs.get(id).queue.resume();
    },
    pause(id) {
      runs.get(id)?.queue.pause();
      notify({ id, status: "paused" });
    },
    resume(id) {
      return controller.run(id);
    },
    cancelPending(id) {
      const run = runs.get(id);
      if (!run) return;
      run.cancelled = true;
      const jobs =
        run.queue.jobs instanceof Map ? [...run.queue.jobs.values()] : [];
      for (const j of jobs)
        if (j.status === "pending") run.queue.cancel(j.jobId);
      notify({ id, status: "cancelled" });
    },
    subscribe(f) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    load: synchronize,
    list: async () =>
      (await (await getStore()).list({ type: "competition" })).items,
  };
  return controller;
}
