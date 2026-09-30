import { canonicalSerialize } from "./hash.js";
function seed32(value) {
  let s = 2166136261;
  for (const c of value) {
    s ^= c.codePointAt(0);
    s = Math.imul(s, 16777619);
  }
  return s >>> 0;
}
export function createRng(seed, stream, state) {
  let s = state?.state ?? seed32(canonicalSerialize([seed, stream]));
  if (!Number.isInteger(s) || s < 0 || s > 4294967295)
    throw Error("INVALID_RNG_STATE");
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let x = Math.imul(s ^ (s >>> 15), s | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    },
    int(max) {
      if (!Number.isSafeInteger(max) || max <= 0)
        throw Error("INVALID_RANDOM_RANGE");
      return Math.floor(this.next() * max);
    },
    exportState() {
      return { schemaVersion: 1, state: s };
    },
    importState(state) {
      if (
        state.schemaVersion !== 1 ||
        !Number.isInteger(state.state) ||
        state.state < 0 ||
        state.state > 4294967295
      )
        throw Error("INVALID_RNG_STATE");
      s = state.state;
    },
  };
}
export const randomFor = (seed, key) =>
  createRng(seed, canonicalSerialize(key)).next();
