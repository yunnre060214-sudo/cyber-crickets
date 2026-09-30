import { createMatch } from "../engine/factory.js";
import { JobQueue } from "../runtime/job-queue.js";
import { validateMessage } from "./protocol.js";
export async function executeMatchJob(
  job,
  controls,
  { schedule = (cb) => setTimeout(cb, 0), now = () => performance.now() } = {},
) {
  const match = createMatch(job.config);
  if (job.checkpoint) match.restore(job.checkpoint);
  let nextSave = match.getSnapshot().timeMs + 5000;
  while (!match.getSnapshot().finished) {
    if (controls.cancelled) throw Error("JOB_CANCELLED");
    if (controls.paused) {
      await new Promise((r) => schedule(r));
      continue;
    }
    const start = now();
    do {
      match.advance(1);
    } while (!match.getSnapshot().finished && now() - start < 8);
    const s = match.getSnapshot();
    if (s.timeMs >= nextSave) {
      controls.progress?.({
        timeMs: s.timeMs,
        checkpoint: match.captureCheckpoint(),
      });
      nextSave += 5000;
    }
    await new Promise((r) => schedule(r));
  }
  return match.getResult();
}
export function createQueueWorkerService({ emit, schedule, now }) {
  const q = new JobQueue({
    execute: (j, c) => executeMatchJob(j, c, { schedule, now }),
    onProgress: (jobs, j, progress) =>
      emit({
        protocolVersion: 1,
        requestId: "event",
        jobId: j?.jobId,
        type: "progress",
        payload: { jobs: jobs.map(({ result, ...x }) => x), progress },
      }),
    onResult: (j, result) =>
      emit({
        protocolVersion: 1,
        requestId: "event",
        jobId: j.jobId,
        type: "result",
        payload: result,
      }),
  });
  return {
    async handle(m) {
      validateMessage(m);
      if (m.type === "enqueue") q.enqueue(m.payload.jobs);
      else if (m.type === "pause") q.pause();
      else if (m.type === "resume" || m.type === "start") q.resume();
      else if (m.type === "cancel") q.cancel(m.jobId);
      else if (m.type === "dispose") q.dispose();
    },
    dispose: () => q.dispose(),
  };
}
if (
  typeof WorkerGlobalScope !== "undefined" &&
  self instanceof WorkerGlobalScope
) {
  const s = createQueueWorkerService({ emit: (m) => self.postMessage(m) });
  self.onmessage = (e) => s.handle(e.data);
}
