const typed = {
  Int8Array,
  Uint8Array,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
};
export function encode(value, seen = new Set()) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value))
      throw Error("NON_FINITE");
    if (["function", "undefined", "symbol", "bigint"].includes(typeof value))
      throw Error("INVALID_VALUE");
    return value;
  }
  if (seen.has(value)) throw Error("CYCLIC_DATA");
  seen.add(value);
  let out;
  if (ArrayBuffer.isView(value))
    out = { $type: value.constructor.name, data: Array.from(value) };
  else if (value instanceof Set)
    out = { $type: "Set", data: [...value].map((v) => encode(v, seen)) };
  else if (value instanceof Map)
    out = { $type: "Map", data: [...value].map((v) => encode(v, seen)) };
  else if (Array.isArray(value)) out = value.map((v) => encode(v, seen));
  else {
    out = {};
    for (const k of Object.keys(value)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        throw Error("UNSAFE_KEY");
      out[k] = encode(value[k], seen);
    }
  }
  seen.delete(value);
  return out;
}
export function decode(v) {
  if (typeof v === "number" && !Number.isFinite(v)) throw Error("NON_FINITE");
  if (!v || typeof v !== "object") return v;
  // Checkpoints contain both encoded fields and already decoded values.
  if (ArrayBuffer.isView(v)) return v.slice();
  if (v instanceof Set) return new Set([...v].map(decode));
  if (v instanceof Map) return new Map([...v].map(([k,x])=>[decode(k),decode(x)]));
  if (Array.isArray(v)) return v.map(decode);
  if (v.$type) {
    if (Object.keys(v).some(k=>k!=="$type" && k!=="data") ||
        !Array.isArray(v.data) || v.data.length > 1000000) throw Error("INVALID_TYPE_DATA");
    if (typed[v.$type]) {
      const ranges = {
        Int8Array: [-128,127], Uint8Array:[0,255],
        Int16Array:[-32768,32767], Uint16Array:[0,65535],
        Int32Array:[-2147483648,2147483647], Uint32Array:[0,4294967295],
      };
      const range=ranges[v.$type];
      for(const x of v.data) {
        if(typeof x!=="number" || !Number.isFinite(x) ||
          (range && (!Number.isInteger(x) || x<range[0] || x>range[1])) ||
          (v.$type==="Float32Array" && Math.fround(x)!==x)) throw Error("INVALID_TYPE_DATA");
      }
      return new typed[v.$type](v.data);
    }
    if (v.$type === "Set") return new Set(v.data.map(decode));
    if (v.$type === "Map") {
      if(v.data.some(x=>!Array.isArray(x)||x.length!==2)) throw Error("INVALID_TYPE_DATA");
      return new Map(v.data.map(([k,x])=>[decode(k),decode(x)]));
    }
    throw Error("INVALID_TYPE");
  }
  const out = {};
  for (const k of Object.keys(v)) {
    if (["__proto__", "constructor", "prototype"].includes(k)) throw Error("UNSAFE_KEY");
    out[k] = decode(v[k]);
  }
  return out;
}
export const canonicalSerialize = (data) =>
  JSON.stringify(encode(data), (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
export function canonicalHash(data) {
  // FNV-1a 64-bit multiplication using two exact 32-bit limbs. The largest
  // intermediate is under 2^53; this preserves every existing archive hash.
  let high = 0xcbf29ce4,
    low = 0x84222325;
  for (const byte of new TextEncoder().encode(canonicalSerialize(data))) {
    low = (low ^ byte) >>> 0;
    const product = low * 435;
    high = (high * 435 + Math.floor(product / 4294967296) + (low << 8)) >>> 0;
    low = product >>> 0;
  }
  return high.toString(16).padStart(8, "0") + low.toString(16).padStart(8, "0");
}
export function seal(data) {
  return { ...data, integrityHash: canonicalHash(data) };
}
export function verify(data) {
  const { integrityHash, ...body } = data;
  if (canonicalHash(body) !== integrityHash) throw Error("INTEGRITY_MISMATCH");
  return body;
}
