import { createMatchWorkerService } from "../workers/match-worker.js";
export function createMatchClient(config, { transport, checkpoint } = {}) {
  const matchId = crypto.randomUUID(),
    listeners = new Set(),
    pending = new Map();
  let serial = 0,
    latest = null,
    disposed = false;
  const receive = (m) => {
    if (m.protocolVersion !== 1 || m.matchId !== matchId || disposed) return;
    const p = pending.get(m.requestId);
    if (p && (m.type === "ack" || m.type === "error")) {
      pending.delete(m.requestId);
      m.type === "error"
        ? p.reject(Error(m.payload.code))
        : p.resolve(m.payload);
    }
    if (m.type === "snapshot") latest = m.payload;
    if (["snapshot", "result", "ledger", "progress", "error"].includes(m.type))
      listeners.forEach((f) => f(m));
  };
  let service;
  if (transport) {
    transport.addEventListener("message", (e) => receive(e.data));
  } else if (typeof Worker !== "undefined") {
    transport = new Worker(
      new URL("../workers/match-worker.js", import.meta.url),
      { type: "module" },
    );
    transport.addEventListener("message", (e) => receive(e.data));
  } else
    service = createMatchWorkerService({
      emit: (m) => queueMicrotask(() => receive(m)),
    });
  const request = (type, payload = {}) =>
    new Promise((resolve, reject) => {
      if (disposed) {
        reject(Error("CLIENT_DISPOSED"));
        return;
      }
      const requestId = String(++serial);
      pending.set(requestId, { resolve, reject });
      const m = { protocolVersion: 1, requestId, matchId, type, payload };
      transport ? transport.postMessage(m) : service.handle(m);
    });
  const ready = request("create", { config, checkpoint });
  const after = (type, payload) => ready.then(() => request(type, payload));
  return {
    matchId,
    start: () => after("start"),
    pause: () => after("pause"),
    resume: () => after("resume"),
    setSpeed: (speed) => after("setSpeed", { speed }),
    snapshot: async () => {
      await ready;
      return structuredClone(latest);
    },
    capture: () => after("capture"),
    subscribe(f) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    async dispose() {
      await after("dispose");
      disposed = true;
      transport?.terminate();
      service?.dispose();
      pending.forEach((p) => p.reject(Error("CLIENT_DISPOSED")));
      pending.clear();
      listeners.clear();
    },
  };
}
