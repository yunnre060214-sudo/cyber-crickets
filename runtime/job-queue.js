export class JobQueue {
  constructor({
    execute,
    onProgress = () => {},
    onResult = () => {},
    concurrency = 1,
  }) {
    if (![1, 2].includes(concurrency)) throw Error("INVALID_CONCURRENCY");
    this.execute = execute;
    this.onProgress = onProgress;
    this.onResult = onResult;
    this.concurrency = concurrency;
    this.jobs = new Map();
    this.active = 0;
    this.paused = false;
    this.disposed = false;
  }
  enqueue(jobs) {
    for (const j of jobs) {
      const existing = this.jobs.get(j.jobId);
      if (!existing || existing.status === "cancelled")
        this.jobs.set(j.jobId, {
          ...j,
          status: j.status === "completed" ? "completed" : "pending",
        });
    }
    this.pump();
  }
  pause() {
    this.paused = true;
    this.onProgress([...this.jobs.values()]);
  }
  resume() {
    this.paused = false;
    this.pump();
  }
  cancel(id) {
    const j = this.jobs.get(id);
    if (j && j.status !== "completed") j.status = "cancelled";
    this.onProgress([...this.jobs.values()]);
  }
  dispose() {
    this.disposed = true;
    for (const j of this.jobs.values()) this.cancel(j.jobId);
  }
  pump() {
    if (this.paused || this.disposed) return;
    while (this.active < this.concurrency) {
      const job = [...this.jobs.values()].find((j) => j.status === "pending");
      if (!job) break;
      job.status = "running";
      this.active++;
      const queue = this;
      const controls = {
        get paused() {
          return queue.paused;
        },
        get cancelled() {
          return queue.disposed || job.status === "cancelled";
        },
        progress: (p) => {
          if (p?.observations) job.observations = p.observations;
          this.onProgress([...this.jobs.values()], job, p);
        },
      };
      Promise.resolve()
        .then(() => this.execute(job, controls))
        .then(
          async (result) => {
            if (controls.cancelled) return;
            await this.onResult(job, result);
            job.status = "completed";
            job.result = { integrityHash: result?.integrityHash ?? null };
          },
          (e) => {
            if (!controls.cancelled) {
              job.status = "pending";
              job.error = e.message;
              this.paused = true;
            }
          },
        )
        .catch((e) => {
          job.status = "pending";
          job.error = e.message;
          this.paused = true;
        })
        .finally(() => {
          this.active--;
          this.onProgress([...this.jobs.values()]);
          this.pump();
        });
    }
  }
}
