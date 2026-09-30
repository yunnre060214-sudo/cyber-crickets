import { seal, encode } from "../engine/hash.js";
import { escape } from "./v3.js";
export async function createJobExport(id, store, format = "data") {
  const record = await store.get(id),
    items = await store.taskResults(id),
    results = [];
  for (const item of items)
    results.push({
      ...item,
      replay: await store.getPackage(item.result.replayId),
    });
  const checkpoints = [];
  const jobs = record.state.orderedTasks ?? [];
  for (const job of jobs) {
    const cp = await store.getJobCheckpoint(id, job.jobId);
    if (cp && !items.some((i) => i.jobId === job.jobId))
      checkpoints.push({ jobId: job.jobId, checkpoint: cp });
  }
  const pkg = seal({
    format: "cyber-crickets." + record.type,
    formatVersion: 3,
    config: record.state.config ?? record.state.rawLegacy?.config,
    state: record.state,
    sourceHash: record.sourceHash ?? "development",
    results,
    checkpoints,
  });
  const title = record.index.name,
    stem =
      "cyber-crickets_" +
      record.type +
      "_" +
      id.replace(/[^\w-]/g, "_").slice(0, 40);
  if (format === "data") {
    const raw = new Blob([JSON.stringify(encode(pkg))], {
      type: "application/json",
    });
    if (typeof CompressionStream === "function")
      try {
        const data = await new Response(
          raw.stream().pipeThrough(new CompressionStream("gzip")),
        ).arrayBuffer();
        return {
          filename: stem + ".json.gz",
          label: "完整数据",
          blob: new Blob([data], { type: "application/gzip" }),
        };
      } catch {}
    return { filename: stem + ".json", label: "完整数据", blob: raw };
  }
  const rows = results.map((r) => ({ jobId: r.jobId, teams: r.result.teams })),
    text =
      "# " +
      title +
      "\n\n规则与配置：\n\n" +
      JSON.stringify(pkg.config, null, 2) +
      "\n\n逐局实测结果：\n\n" +
      rows
        .map(
          (r) =>
            "- " +
            r.jobId +
            "：" +
            r.teams
              .map(
                (t) =>
                  t.participantId +
                  " " +
                  t.strategyId +
                  " " +
                  t.score.toFixed(3) +
                  " VP",
              )
              .join(" / "),
        )
        .join("\n") +
      "\n\n源码摘要：" +
      pkg.sourceHash +
      "\n积分与 reward 分开，胜率是本实验样本统计。\n";
  if (format === "markdown")
    return {
      filename: stem + ".md",
      label: "摘要",
      blob: new Blob([text], { type: "text/markdown" }),
    };
  return {
    filename: stem + ".html",
    label: "战报",
    blob: new Blob(
      [
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
          escape(title) +
          "</title><style>body{font:13px/1.6 Arial;background:#f5f4ef;margin:0}main{max-width:1100px;margin:auto;padding:24px}h1{font-size:20px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><main><h1>" +
          escape(title) +
          "</h1><pre>" +
          escape(text) +
          "</pre></main>",
      ],
      { type: "text/html" },
    ),
  };
}
