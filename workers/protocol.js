export const PROTOCOL_VERSION = 1;
export function validateMessage(m) {
  if (
    !m ||
    m.protocolVersion !== 1 ||
    typeof m.requestId !== "string" ||
    ![
      "create",
      "start",
      "pause",
      "resume",
      "setSpeed",
      "capture",
      "dispose",
      "enqueue",
      "cancel",
    ].includes(m.type)
  )
    throw Error("INVALID_WORKER_MESSAGE");
  return m;
}
