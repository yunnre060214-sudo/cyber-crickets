import { h } from "./dom.js";
export function renderAgentBook(root, registry) {
  root.replaceChildren(
    h(
      "div",
      { className: "workspace-head" },
      h(
        "div",
        {},
        h("h1", {}, "算法图鉴"),
        h("p", {}, "18 种经典策略与 3 种新算法，均使用同等公开信息。"),
      ),
      h("span", { className: "tag" }, registry.length + " STRATEGIES"),
    ),
    h(
      "div",
      { className: "agent-grid" },
      registry.map((a, i) =>
        h(
          "article",
          { className: "agent-entry" },
          h("small", {}, String(i + 1).padStart(2, "0") + " / " + a.id),
          h("h2", {}, a.name),
          h("p", {}, a.description),
          h("span", { className: "tag" }, a.family + " · v" + a.version),
          h("p", {}, "100 ms 一次决策 · 统一预算 · 可保存自身状态"),
        ),
      ),
    ),
  );
}
