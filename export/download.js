import { buildHtmlReport } from "./html.js?v=20260928-export-v2";
import { buildMarkdownLog } from "./markdown.js?v=20260928-export-v2";
import { buildFullData } from "./model.js?v=20260928-export-v2";
import { buildReplayPackage } from "../replay/ledger.js";
import { encode } from "../engine/hash.js";
import { replayHtml, replayMarkdown } from "./v3.js";

export async function createMatchExport(context, format = "html") {
  if (context.checkpoint || context.format === "cyber-crickets.replay") {
    const pkg =
        context.format === "cyber-crickets.replay"
          ? structuredClone(context)
          : buildReplayPackage(context),
      stem =
        "cyber-crickets_2.0_" +
        String(pkg.config.seed)
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .slice(0, 32) +
        "_" +
        Math.round(pkg.summary.timeMs / 1000) +
        "s";
    if (format === "html" || format === "markdown") {
      const filename = stem + (format === "html" ? ".html" : ".md");
      return {
        filename,
        name: filename,
        label: format,
        blob: new Blob(
          [format === "html" ? replayHtml(pkg) : replayMarkdown(pkg)],
          { type: format === "html" ? "text/html" : "text/markdown" },
        ),
      };
    }
    if (format !== "data") throw Error("INVALID_EXPORT_FORMAT");
    const raw = new Blob([JSON.stringify(encode(pkg))], {
      type: "application/json",
    });
    if (typeof CompressionStream === "function")
      try {
        const buffer = await new Response(
            raw.stream().pipeThrough(new CompressionStream("gzip")),
          ).arrayBuffer(),
          filename = stem + ".json.gz";
        return {
          filename,
          name: filename,
          label: "完整数据",
          compressed: true,
          blob: new Blob([buffer], { type: "application/gzip" }),
        };
      } catch {}
    return {
      filename: stem + ".json",
      name: stem + ".json",
      label: "完整数据",
      compressed: false,
      blob: raw,
    };
  }
  const { match } = context;
  const safeSeed =
    String(match.seed)
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 32) || "match";
  const stem =
    "cyber-crickets_" + safeSeed + "_" + Math.round(match.time) + "s";
  if (format === "html")
    return {
      filename: stem + "_report.html",
      label: "可视化战报",
      blob: new Blob([buildHtmlReport(context)], {
        type: "text/html;charset=utf-8",
      }),
    };
  if (format === "markdown")
    return {
      filename: stem + "_summary.md",
      label: "精简摘要",
      blob: new Blob([buildMarkdownLog(context)], {
        type: "text/markdown;charset=utf-8",
      }),
    };
  if (format !== "data") throw new RangeError("Unsupported export format");
  // Serialize before awaiting compression: a running match may advance in the meantime.
  const raw = new Blob([JSON.stringify(buildFullData(context))], {
    type: "application/json",
  });
  if (typeof CompressionStream === "function") {
    try {
      const stream = raw.stream().pipeThrough(new CompressionStream("gzip"));
      const buffer = await new Response(stream).arrayBuffer();
      return {
        filename: stem + "_data.json.gz",
        label: "完整数据（压缩）",
        blob: new Blob([buffer], { type: "application/gzip" }),
        compressed: true,
      };
    } catch {
      /* A browser without working gzip still receives all records below. */
    }
  }
  return {
    filename: stem + "_data.json",
    label: "完整数据（未压缩）",
    blob: raw,
    compressed: false,
  };
}

export function formatBytes(bytes) {
  return bytes < 1024
    ? bytes + " B"
    : bytes < 1024 * 1024
      ? (bytes / 1024).toFixed(1) + " KB"
      : (bytes / 1024 / 1024).toFixed(2) + " MB";
}

export function saveMatchExport(file) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { ...file, sizeLabel: formatBytes(file.blob.size) };
}

export async function downloadMatchExport(context, format = "html") {
  return saveMatchExport(await createMatchExport(context, format));
}
