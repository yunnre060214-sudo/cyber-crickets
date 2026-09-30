import { encode, decode } from "../engine/hash.js";
export const encodeBoard = encode;
export function decodeBoard(data) {
  const b = decode(data);
  if (b.width !== 64 || b.height !== 64) throw Error("INVALID_BOARD");
  for (const [key, C, max, min] of [
    ["owner", Int8Array, 3, -1],
    ["core", Int8Array, 3, -1],
    ["terrain", Uint8Array, 3, 1],
    ["resources", Uint8Array, 3, 0],
    ["blocked", Uint8Array, 1, 0],
  ]) {
    const source = data[key];
    if (
      source?.$type !== C.name ||
      source.data?.length !== 4096 ||
      source.data.some(
        (v) =>
          !Number.isInteger(v) ||
          v < min ||
          v > max ||
          (key === "resources" && v === 2),
      )
    )
      throw Error("INVALID_BOARD");
    if (!(b[key] instanceof C) || b[key].length !== 4096)
      throw Error("INVALID_BOARD");
  }
  return b;
}
