import { ReplayPlayer } from "../replay/player.js";
import { AGENT_REGISTRY } from "../agents/registry.js";
export const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function buildReplayReportModel(pkg) {
  return {
    ...pkg.summary,
    config: pkg.config,
    board: new ReplayPlayer(pkg).seek(pkg.summary.timeMs).board,
    events: pkg.tickRecords.flatMap((r) => r.events),
    packageHash: pkg.integrityHash,
  };
}
const name = (id) => AGENT_REGISTRY.find((a) => a.id === id)?.name ?? id;
export function replayMarkdown(pkg) {
  const r = buildReplayReportModel(pkg);
  return (
    "# Cyber Crickets 2.0 比赛摘要\n\n目标：控制领地与资源，按模拟时间累计 VP。\n\n规则：" +
    r.config.ruleVersion +
    "；引擎 " +
    r.config.engineVersion +
    "；种子 " +
    JSON.stringify(r.config.seed) +
    "；地图 " +
    r.config.mapPreset +
    "；" +
    r.timeMs / 1000 +
    " / " +
    r.config.durationMs / 1000 +
    " 秒。\n\nVP = 6.5 × 面积占比 + 3.5 × 资源价值占比的时间积分。reward 是动作反馈，不加入 VP。各策略只读取相同公开棋盘、比分、前沿与自身状态，每 100 ms 同步选择行动；经典模式采用原调度。\n\n状态：" +
    (r.finished ? "已结束" : "捕获时点，尚未结束") +
    "。\n\n| 参赛者 | 算法 | VP | 面积贡献 | 资源贡献 | 成功 / 决策 | 反抢 |\n| --- | --- | ---: | ---: | ---: | ---: | ---: |\n" +
    r.teams
      .map(
        (t) =>
          "| " +
          t.participantId +
          " | " +
          name(t.strategyId) +
          " | " +
          t.score.toFixed(3) +
          " | " +
          t.areaVP.toFixed(3) +
          " | " +
          t.resourceVP.toFixed(3) +
          " | " +
          t.successes +
          " / " +
          t.decisions +
          " | " +
          t.recaptures +
          " |",
      )
      .join("\n") +
    "\n\n资源保有（价值·秒）：" +
    r.teams
      .map((t) => t.participantId + "=" + t.resourceValueSeconds.toFixed(2))
      .join("，") +
    "。\n\n公开精选决策：\n" +
    r.teams
      .flatMap((t) =>
        t.selectedDecisions
          .slice(0, 6)
          .map(
            (d) =>
              "- " +
              t.participantId +
              " " +
              (d.timeMs / 1000).toFixed(2) +
              "s：" +
              JSON.stringify(
                d.action.move?.explain?.method ??
                  d.action.thought ??
                  "实际资源行动",
              ),
          ),
      )
      .join("\n") +
    "\n\n解释属于公开观察，不是因果证明；实时局势估计不是实验样本胜率。\n\n完整性摘要：" +
    r.packageHash +
    "\n"
  );
}
export function replayHtml(pkg) {
  const r = buildReplayReportModel(pkg),
    colors = ["#247858", "#b54b49", "#3473b2", "#9a7729"],
    paths = colors.map(() => []);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; ) {
      const seat = r.board.owner[y * 64 + x];
      let end = x + 1;
      while (end < 64 && r.board.owner[y * 64 + end] === seat) end++;
      if (seat >= 0)
        paths[seat].push(
          "M" + x + " " + y + "h" + (end - x) + "v1h-" + (end - x) + "z",
        );
      x = end;
    }
  return (
    '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cyber Crickets 2.0 战报</title><style>body{background:#f5f4ef;color:#252d30;font:13px/1.6 Arial,sans-serif;margin:0}main{max-width:1100px;margin:auto;padding:24px}h1{font-size:22px}h2{font-size:15px}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #d8ddda;text-align:left}section{background:white;border:1px solid #d8ddda;padding:16px;margin-top:16px}svg{max-width:440px;width:100%;background:#edf0eb}p{overflow-wrap:anywhere}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:650px){main{padding:16px}.grid{grid-template-columns:1fr}table{font-size:11px}td,th{padding:6px}}</style><main><h1>Cyber Crickets 2.0 · ' +
    (r.finished ? "结算战报" : "捕获快照") +
    "</h1><p>种子 " +
    escape(r.config.seed) +
    " · " +
    escape(r.config.ruleVersion) +
    " · " +
    escape(r.config.mapPreset) +
    " · " +
    r.timeMs / 1000 +
    " / " +
    r.config.durationMs / 1000 +
    ' 秒</p><div class="grid"><section><h2>捕获时点棋盘</h2><svg viewBox="0 0 64 64" role="img" aria-label="控制地图">' +
    paths
      .map((p, i) => '<path d="' + p.join("") + '" fill="' + colors[i] + '"/>')
      .join("") +
    "</svg></section><section><h2>实际积分与贡献</h2><table><tr><th>算法</th><th>VP</th><th>面积</th><th>资源</th></tr>" +
    r.teams
      .map(
        (t) =>
          "<tr><td>" +
          escape(name(t.strategyId)) +
          "</td><td>" +
          t.score.toFixed(2) +
          "</td><td>" +
          t.areaVP.toFixed(2) +
          "</td><td>" +
          t.resourceVP.toFixed(2) +
          "</td></tr>",
      )
      .join("") +
    "</table><p>VP 按时间累积：面积 65%，资源价值 35%。reward 仅反馈动作，独立于 VP。</p><p>各策略只使用同等公开信息与工作预算。</p></section></div><section><h2>行动与资源保有</h2><table><tr><th>参赛者</th><th>成功 / 行动</th><th>翻色 / 反抢</th><th>价值·秒</th></tr>" +
    r.teams
      .map(
        (t) =>
          "<tr><td>" +
          escape(t.participantId) +
          "</td><td>" +
          t.successes +
          " / " +
          t.decisions +
          "</td><td>" +
          t.captures +
          " / " +
          t.recaptures +
          "</td><td>" +
          t.resourceValueSeconds.toFixed(2) +
          "</td></tr>",
      )
      .join("") +
    "</table></section><section><h2>阶段事件与领先易手</h2>" +
    r.events
      .map(
        (e) =>
          "<p>" +
          ((e.timeMs ?? 0) / 1000).toFixed(2) +
          "s · " +
          escape(e.label ?? e.banner) +
          "</p>",
      )
      .join("") +
    "<p>领先易手 " +
    r.leadChanges.length +
    " 次。</p></section><section><h2>精选公开决策</h2>" +
    r.teams
      .map(
        (t) =>
          "<h3>" +
          escape(name(t.strategyId)) +
          "</h3>" +
          t.selectedDecisions
            .slice(0, 6)
            .map(
              (d) =>
                "<p>" +
                d.timeMs / 1000 +
                "s · " +
                escape(
                  d.action.move?.explain?.method ??
                    d.action.thought ??
                    "实际资源行动",
                ) +
                "</p>",
            )
            .join(""),
      )
      .join("") +
    "<p>观察说明不表示因果证明；局势估计与实验样本胜率分别定义。</p></section><p>版本 " +
    escape(r.config.engineVersion) +
    " · 数据摘要 " +
    escape(r.packageHash) +
    "</p></main></html>"
  );
}
