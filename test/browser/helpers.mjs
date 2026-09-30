import { test as base, expect } from "@playwright/test";
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await use(page);
    expect(errors, "No uncaught product errors").toEqual([]);
  },
});
export { expect };
export const arenaURL =
  "/?mode=standard&map=plain&seed=browser-acceptance&duration=10&speed=20&agents=random,greedy,turtle,strongest";
export async function edit(page, name, value) {
  await page.locator(`[name="${name}"]`).fill(value);
  await page.locator(`[name="${name}"]`).blur();
}
export async function nav(page, route) {
  await page.locator(`[data-route="${route}"]`).click();
}
export async function persisted(page, callback, args) {
  return page.evaluate(
    async ({ source, args }) => {
      const info = await (await fetch("/build-info.json")).json();
      const base = "/assets/" + info.buildHash + "/";
      const { openDatabase } = await import(base + "storage/database.js");
      const { createRecordStore } = await import(base + "storage/records.js");
      return await Function(
        "store",
        "args",
        "return (" + source + ")(store,args)",
      )(createRecordStore({ backend: await openDatabase() }), args);
    },
    { source: callback.toString(), args },
  );
}
