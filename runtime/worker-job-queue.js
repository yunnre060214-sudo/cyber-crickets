import { JobQueue } from "./job-queue.js";
import { executeMatchJob } from "../workers/queue-worker.js";
export function createWorkerJobQueue(callbacks) {
  if (typeof Worker === "undefined")
    return new JobQueue({ execute: executeMatchJob, ...callbacks });
  const worker = new Worker(
    new URL("../workers/queue-worker.js", import.meta.url),
    { type: "module" },
  );
  let serial = 0;
  const jobs = new Map(),
    q = {
      ...callbacks,
      enqueue(list) {
        const fresh = [];
        for (const j of list)
          if (!jobs.has(j.jobId) || jobs.get(j.jobId).status === "cancelled") {
            jobs.set(j.jobId, { ...j, status: "pending" });
            fresh.push(j);
          }
        send("enqueue", { jobs: fresh });
      },
      pause() {
        send("pause");
      },
      resume() {
        send("resume");
      },
      cancel(jobId) {
        const job = jobs.get(jobId);
        if (job && job.status !== "completed") job.status = "cancelled";
        send("cancel", {}, jobId);
      },
      dispose() {
        send("dispose");
        worker.terminate();
      },
      jobs,
    };
  function send(type, payload = {}, jobId) {
    worker.postMessage({
      protocolVersion: 1,
      requestId: String(++serial),
      type,
      payload,
      jobId,
    });
  }
  worker.onmessage = async (e) => {
    const m = e.data;
    if (m.protocolVersion !== 1) return;
    if (m.type === "result") {
      const job = jobs.get(m.jobId);
      if (job && !job.delivered) {
        job.delivered = true;
        try {
          await q.onResult?.(job, m.payload);
          job.status = "completed";
          send("resultAck", {}, m.jobId);
        } catch (err) {
          job.delivered = false;
          job.status = "pending";
          q.pause();
          send("resultAck", { error: err.message }, m.jobId);
          q.onProgress?.([...jobs.values()], job, { error: err.message });
        }
      }
    }
    if (m.type === "progress") {
      for (const j of m.payload.jobs) {
        const own = jobs.get(j.jobId);
        if (own) own.status = j.status;
      }
      q.onProgress?.(m.payload.jobs, jobs.get(m.jobId), m.payload.progress);
    }
  };
  worker.onerror = (e) =>
    q.onProgress?.([...jobs.values()], null, { error: e.message });
  return q;
}
