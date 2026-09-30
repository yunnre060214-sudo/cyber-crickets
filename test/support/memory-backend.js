export class MemoryBackend {
  constructor() {
    this.stores = new Map();
    this.serial = Promise.resolve();
  }
  transaction(names, mode, callback) {
    const run = async () => {
      const draft = new Map([...this.stores].map(([k, v]) => [k, new Map(v)]));
      const store = (name) => {
        if (!draft.has(name)) draft.set(name, new Map());
        return draft.get(name);
      };
      const tx = {
        get: async (n, k) => structuredClone(store(n).get(k) ?? null),
        put: async (n, v) => {
          store(n).set(v.id, structuredClone(v));
        },
        delete: async (n, k) => store(n).delete(k),
        list: async (n) =>
          [...store(n).values()].map((v) => structuredClone(v)),
      };
      const result = await callback(tx);
      if (mode === "readwrite") this.stores = draft;
      return result;
    };
    const p = this.serial.then(run);
    this.serial = p.catch(() => {});
    return p;
  }
}
