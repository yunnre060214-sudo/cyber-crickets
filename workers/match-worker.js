import { createMatch } from "../engine/factory.js";
import { validateMessage } from "./protocol.js";
export function createMatchWorkerService({
  emit,
  schedule = (cb, ms) => setTimeout(cb, ms),
  now = () => performance.now(),
}) {
  let engine,
    matchId,
    running = false,
    disposed = false,
    speed = 1,
    last = 0,
    credit = 0,
    generation = 0,
    lastSnapshot = 0,
    cursor = 0;
  const message = (type, payload, requestId = "event") =>
    emit({ protocolVersion: 1, requestId, matchId, type, payload });
  function snapshot() {
    const s = engine.getSnapshot();
    s.matchId = matchId;
    message("snapshot", s);
  }
  function loop(gen) {
    if (gen !== generation || disposed || !running) return;
    const wall = now();
    credit += Math.max(0, Math.min(500, wall - last)) * speed;
    last = wall;
    const start = now();
    while (credit >= engine.tickMs && now() - start < 8) {
      engine.advance(1);
      credit -= engine.tickMs;
      if (engine.getSnapshot().finished) break;
    }
    if (wall - lastSnapshot >= 50 || engine.getSnapshot().finished) {
      snapshot();
      const ledger = engine.readLedger(cursor);
      cursor = ledger.nextCursor;
      if (ledger.records.length) message("ledger", ledger);
      lastSnapshot = wall;
    }
    if (engine.getSnapshot().finished) {
      running = false;
      message("result", engine.getResult());
      return;
    }
    schedule(() => loop(gen), 16);
  }
  return {
    async handle(m) {
      try {
        validateMessage(m);
        if (disposed) return;
        if (m.type === "create") {
          generation++;
          running = false;
          engine = createMatch(m.payload.config);
          if (m.payload.checkpoint) engine.restore(m.payload.checkpoint);
          matchId = m.matchId;
          cursor = 0;
          credit = 0;
          snapshot();
        } else if (m.matchId !== matchId) return;
        else if (m.type === "start" || m.type === "resume") {
          if (!running && !engine.getSnapshot().finished) {
            running = true;
            last = now();
            const gen = ++generation;
            schedule(() => loop(gen), 0);
          }
        } else if (m.type === "pause") {
          running = false;
          generation++;
          snapshot();
        } else if (m.type === "setSpeed") {
          const v = m.payload.speed;
          if (!Number.isFinite(v) || v < 0.25 || v > 20 || (v * 4) % 1)
            throw Error("INVALID_SPEED");
          speed = v;
        } else if (m.type === "capture") {
          message(
            "ack",
            {
              checkpoint: engine.captureCheckpoint(),
              ledger: engine.readLedger().records,
              initialBoard: engine.getInitialBoard(),
              snapshot: { ...engine.getSnapshot(), matchId },
              boardCheckpoints: structuredClone(engine.boardCheckpoints ?? []),
            },
            m.requestId,
          );
          return;
        } else if (m.type === "dispose") {
          running = false;
          generation++;
          disposed = true;
        }
        message("ack", {}, m.requestId);
      } catch (e) {
        message("error", { code: e.message }, m.requestId);
      }
    },
    dispose() {
      running = false;
      generation++;
      disposed = true;
    },
  };
}
if (
  typeof WorkerGlobalScope !== "undefined" &&
  self instanceof WorkerGlobalScope
) {
  const service = createMatchWorkerService({
    emit: (m) => self.postMessage(m),
  });
  self.onmessage = (e) => service.handle(e.data);
}
