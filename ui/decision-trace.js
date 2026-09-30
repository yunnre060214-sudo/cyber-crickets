import { h } from "./dom.js";
export function renderDecisionTrace(root, trace, team) {
  root.replaceChildren(
    h("h2", {}, "公开决策观察"),
    h("p", {}, trace?.method ?? team?.thought ?? "等待下一次决策"),
    h(
      "dl",
      {},
      h("dt", {}, "工作单位"),
      h("dd", {}, trace?.budgetUsed ?? team?.budgetUsed ?? 0),
      h("dt", {}, "计算耗时"),
      h("dd", {}, (team?.thinkMs ?? 0).toFixed(2) + " ms"),
    ),
    h(
      "div",
      { className: "muted", style: "font-size:11px" },
      "已评估备选：" +
        (trace?.alternatives
          ?.slice(0, 3)
          .map((a) => "#" + a.to + " " + a.score.toFixed(2))
          .join(" / ") || "此策略未记录候选评分"),
    ),
    h(
      "p",
      { className: "muted", style: "font-size:10px" },
      "解释来自实际公开特征与策略输出，不表示因果证明。",
    ),
  );
}
