import { Worker } from "node:worker_threads";

export async function runAcceptanceJobs(jobs, { concurrency = 4, onComplete }) {
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw Error("INVALID_CONCURRENCY");
  let next = 0;
  const workers = [];
  try {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
        const worker = new Worker(
          new URL("./acceptance-game.mjs", import.meta.url),
        );
        workers.push(worker);
        let pending = null,
          terminalError = null;
        const fail = (error) => {
          terminalError = error;
          if (pending) {
            const { reject } = pending;
            pending = null;
            reject(error);
          }
        };
        worker.on("error", fail);
        worker.on("exit", (code) =>
          fail(Error("ACCEPTANCE_WORKER_EXIT_" + code)),
        );
        worker.on("message", (result) => {
          if (pending) {
            const { resolve } = pending;
            pending = null;
            resolve(result);
          }
        });
        while (next < jobs.length) {
          if (terminalError) throw terminalError;
          const job = jobs[next++];
          const result = await new Promise((resolve, reject) => {
            pending = { resolve, reject };
            worker.postMessage(job);
          });
          await onComplete(result);
        }
      }),
    );
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
}
