const taskKey = (recordId, jobId) => JSON.stringify([recordId, jobId]);
export function createRecordStore({ backend }) {
  const store = {
    async put(record, { expectedRevision = 0 } = {}) {
      if (
        record.schemaVersion !== 3 ||
        !record.id ||
        !["match", "competition", "experiment"].includes(record.type)
      )
        throw Error("INVALID_RECORD");
      return backend.transaction(["records"], "readwrite", async (tx) => {
        const old = await tx.get("records", record.id);
        if ((old?.revision ?? 0) !== expectedRevision)
          throw Error("STALE_REVISION");
        const next = {
          ...record,
          revision: expectedRevision + 1,
          updatedAt: Date.now(),
        };
        await tx.put("records", next);
        return next;
      });
    },
    get: (id) =>
      backend.transaction(["records"], "readonly", (tx) =>
        tx.get("records", id),
      ),
    async list({ type, limit = 50, cursor } = {}) {
      return backend.transaction(["records"], "readonly", async (tx) => {
        const all = (await tx.list("records"))
            .filter((r) => !type || r.type === type)
            .sort(
              (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
            ),
          start = cursor
            ? Math.max(0, all.findIndex((r) => r.id === cursor) + 1)
            : 0,
          items = all.slice(start, start + limit);
        return {
          items,
          nextCursor:
            start + items.length < all.length ? items.at(-1).id : null,
        };
      });
    },
    async putTaskResult(recordId, jobId, result) {
      return backend.transaction(
        ["records", "taskResults"],
        "readwrite",
        async (tx) => {
          const id = taskKey(recordId, jobId);
          if (await tx.get("taskResults", id)) return { inserted: false };
          const record = await tx.get("records", recordId);
          if (!record) throw Error("RECORD_NOT_FOUND");
          await tx.put("taskResults", { id, recordId, jobId, result });
          record.revision++;
          record.updatedAt = Date.now();
          record.index = {
            ...record.index,
            completedTasks: (record.index?.completedTasks ?? 0) + 1,
          };
          await tx.put("records", record);
          return { inserted: true };
        },
      );
    },
    taskResults: (recordId) =>
      backend.transaction(["taskResults"], "readonly", async (tx) =>
        (await tx.list("taskResults")).filter((t) => t.recordId === recordId),
      ),
    putLedgerChunk: (matchId, cursor, records) => {
      if (!Number.isSafeInteger(cursor) || cursor < 0 || records.length > 1024)
        throw Error("INVALID_CHUNK");
      return backend.transaction(["ledgerChunks"], "readwrite", (tx) =>
        tx.put("ledgerChunks", {
          id: taskKey(matchId, cursor),
          matchId,
          cursor,
          records,
        }),
      );
    },
    async saveMatch(capture, id, { name } = {}) {
      const ledger = capture.ledger,
        cp = structuredClone(capture.checkpoint);
      delete cp.ledger;
      return backend.transaction(
        ["records", "ledgerChunks", "checkpoints"],
        "readwrite",
        async (tx) => {
          const old = await tx.get("records", id);
          if ((old?.index?.timeMs ?? -1) > capture.snapshot.timeMs) return old;
          for (let cursor = 0; cursor < ledger.length; cursor += 1024)
            await tx.put("ledgerChunks", {
              id: taskKey(id, cursor),
              matchId: id,
              cursor,
              records: ledger.slice(cursor, cursor + 1024),
            });
          await tx.put("checkpoints", {
            id,
            capture: {
              ...structuredClone(capture),
              ledger: undefined,
              checkpoint: cp,
            },
          });
          const record = {
            id,
            type: "match",
            schemaVersion: 3,
            revision: (old?.revision ?? 0) + 1,
            updatedAt: Date.now(),
            index: {
              name: name ?? old?.index?.name ?? capture.snapshot.config.seed,
              timeMs: capture.snapshot.timeMs,
              finished: capture.snapshot.finished,
              mode: capture.snapshot.config.mode,
              seed: capture.snapshot.config.seed,
            },
            payloadRefs: { checkpoint: id, ledgerCount: ledger.length },
          };
          await tx.put("records", record);
          return record;
        },
      );
    },
    async loadMatch(id) {
      return backend.transaction(
        ["records", "ledgerChunks", "checkpoints"],
        "readonly",
        async (tx) => {
          const record = await tx.get("records", id),
            saved = await tx.get("checkpoints", id);
          if (!saved) throw Error("MATCH_DATA_NOT_FOUND");
          const chunks = (await tx.list("ledgerChunks"))
            .filter((c) => c.matchId === id)
            .sort((a, b) => a.cursor - b.cursor);
          let cursor = 0;
          const ledger = [];
          for (const c of chunks) {
            if (c.cursor !== cursor) throw Error("LEDGER_GAP");
            ledger.push(...c.records);
            cursor += c.records.length;
          }
          if (cursor !== record.payloadRefs.ledgerCount)
            throw Error("LEDGER_GAP");
          return {
            ...saved.capture,
            ledger,
            checkpoint: { ...saved.capture.checkpoint, ledger },
          };
        },
      );
    },
    async putPackage(record, pkg) {
      return backend.transaction(
        ["records", "checkpoints"],
        "readwrite",
        async (tx) => {
          const old = await tx.get("records", record.id);
          if (old) return old;
          const next = {
            ...record,
            revision: 1,
            updatedAt: Date.now(),
            payloadRefs: { package: record.id },
          };
          await tx.put("checkpoints", { id: record.id, package: pkg });
          await tx.put("records", next);
          return next;
        },
      );
    },
    async putJobPackage(record, pkg) {
      return backend.transaction(
        ["records", "checkpoints", "taskResults"],
        "readwrite",
        async (tx) => {
          const old = await tx.get("records", record.id);
          if (old) return old;
          for (const item of pkg.results) {
            const replayId = record.id + ":match:" + item.jobId;
            await tx.put("checkpoints", { id: replayId, package: item.replay });
            await tx.put("records", {
              id: replayId,
              type: "match",
              schemaVersion: 3,
              revision: 1,
              updatedAt: Date.now(),
              index: {
                name: item.result.config.seed,
                seed: item.result.config.seed,
                timeMs: item.result.timeMs,
                finished: true,
              },
              payloadRefs: { package: replayId },
            });
            await tx.put("taskResults", {
              id: taskKey(record.id, item.jobId),
              recordId: record.id,
              jobId: item.jobId,
              result: { ...item.result, replayId },
            });
          }
          for (const saved of pkg.checkpoints ?? [])
            await tx.put("checkpoints", {
              id: taskKey(record.id, saved.jobId),
              checkpoint: saved.checkpoint,
            });
          const next = {
            ...record,
            state: pkg.state,
            sourceHash: pkg.sourceHash,
            revision: 1,
            updatedAt: Date.now(),
            index: { ...record.index, completedTasks: pkg.results.length },
            payloadRefs: { package: record.id },
          };
          await tx.put("checkpoints", { id: record.id, package: pkg });
          await tx.put("records", next);
          return next;
        },
      );
    },
    getPackage: (id) =>
      backend.transaction(
        ["checkpoints"],
        "readonly",
        async (tx) => (await tx.get("checkpoints", id))?.package ?? null,
      ),
    putJobCheckpoint: (recordId, jobId, checkpoint) =>
      backend.transaction(["checkpoints"], "readwrite", (tx) =>
        tx.put("checkpoints", { id: taskKey(recordId, jobId), checkpoint }),
      ),
    getJobCheckpoint: (recordId, jobId) =>
      backend.transaction(
        ["checkpoints"],
        "readonly",
        async (tx) =>
          (await tx.get("checkpoints", taskKey(recordId, jobId)))?.checkpoint ??
          null,
      ),
  };
  return store;
}
