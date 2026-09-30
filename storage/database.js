export function openDatabase({ name = "cyber-crickets-v2" } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(Error("STORAGE_UNAVAILABLE"));
      return;
    }
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      for (const s of ["records", "ledgerChunks", "checkpoints", "taskResults"])
        request.result.createObjectStore(s, { keyPath: "id" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve({
        transaction(names, mode, callback) {
          return new Promise((res, rej) => {
            const tx = db.transaction(names, mode);
            let result, error;
            const request = (r) =>
              new Promise((yes, no) => {
                r.onsuccess = () => yes(r.result ?? null);
                r.onerror = () => no(r.error);
              });
            const api = {
              get: (n, k) => request(tx.objectStore(n).get(k)),
              put: (n, v) => request(tx.objectStore(n).put(v)),
              delete: (n, k) => request(tx.objectStore(n).delete(k)),
              list: (n) => request(tx.objectStore(n).getAll()),
            };
            tx.oncomplete = () => res(result);
            tx.onabort = () =>
              rej(error ?? tx.error ?? Error("STORAGE_ABORTED"));
            tx.onerror = () => {};
            Promise.resolve()
              .then(() => callback(api))
              .then(
                (v) => {
                  result = v;
                },
                (e) => {
                  error = e;
                  try {
                    tx.abort();
                  } catch {
                    rej(e);
                  }
                },
              );
          });
        },
        close: () => db.close(),
      });
    };
  });
}
