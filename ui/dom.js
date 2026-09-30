export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const child of children.flat(Infinity)) {
    if (child == null) continue;
    el.append(
      typeof child === "string" || typeof child === "number"
        ? document.createTextNode(String(child))
        : child,
    );
  }
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && !k.startsWith("aria")) el[k] = v;
    else if (v !== false && v != null) el.setAttribute(k, String(v));
  }
  return el;
}
export const button = (text, handler, attrs = {}) =>
  h("button", { type: "button", onclick: handler, ...attrs }, text);
export const label = (text, input) =>
  h("label", {}, h("span", {}, text), input);
export function select(items, value, change, attrs = {}) {
  return h(
    "select",
    { ...attrs, value, onchange: (e) => change(e.target.value) },
    items.map(([id, text]) => h("option", { value: id }, text)),
  );
}
export const status = (el, text, error = false) => {
  el.textContent = text;
  el.classList.toggle("error", error);
};
