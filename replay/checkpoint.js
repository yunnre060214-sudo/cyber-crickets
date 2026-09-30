import { verify } from "../engine/hash.js";
import { createMatchConfig } from "../engine/config.js";
import { decodeBoard, encodeBoard } from "./codec.js";
export function validateCheckpoint(data) {
  if (data?.schemaVersion !== 3) throw Error("UNSUPPORTED_SCHEMA");
  verify(data);
  createMatchConfig(data.config);
  if (data.kind === "classic") return data;
  decodeBoard(encodeBoard(data.board));
  if (
    !Number.isSafeInteger(data.tick) ||
    data.tick < 0 ||
    data.timeMs !== data.tick * 20 ||
    data.timeMs > data.config.durationMs
  )
    throw Error("INVALID_CHECKPOINT_TIME");
  return data;
}
