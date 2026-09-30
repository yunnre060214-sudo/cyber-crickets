import { test, expect, arenaURL, nav } from "./helpers.mjs";
test("an old pending capture cannot be saved under a newly started match", async ({
  page,
}) => {
  await page.goto(arenaURL);
  const ids = await page.evaluate(async () => {
    const info = await (
        await fetch(new URL("build-info.json", location.href))
      ).json(),
      base = new URL("assets/" + info.buildHash + "/", location.href).href;
    const { createArena } = await import(base + "ui/arena.js"),
      { ArenaStore } = await import(base + "ui/store.js"),
      { createMatch } = await import(base + "engine/factory.js");
    const root = document.createElement("div"),
      store = new ArenaStore({ durationMs: 10000 }),
      calls = [],
      clients = [];
    document.body.append(root);
    let resolveCapture;
    const arena = createArena({
      root,
      store,
      onCapture: (_cap, id) => calls.push(id),
      clientFactory: () => {
        const c = {
          matchId: "run-" + clients.length,
          subscribe(f) {
            this.notify = f;
          },
          async start() {},
          async dispose() {},
          async setSpeed() {},
          capture: () => new Promise((r) => (resolveCapture = r)),
        };
        clients.push(c);
        return c;
      },
    });
    await arena.run();
    const m = createMatch(store.activeConfig);
    m.advance(250);
    const pending = clients[0].notify({
      type: "snapshot",
      payload: m.getSnapshot(),
    });
    await arena.run();
    resolveCapture({
      snapshot: m.getSnapshot(),
      checkpoint: m.captureCheckpoint(),
    });
    await pending;
    root.remove();
    return calls;
  });
  expect(ids).not.toContain("run-1");
});
for (const [width, height] of [
  [360, 800],
  [390, 844],
  [768, 1024],
  [1440, 1000],
]) {
  test(`settings and workspaces fit ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(arenaURL);
    await page.getByRole("button", { name: "比赛设置", exact: true }).click();
    const close = page.getByRole("button", { name: "收起设置", exact: true });
    if (width <= 390) {
      const box = await close.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    await close.click();
    await expect(page.locator("#arena-settings")).toBeHidden();
    for (const route of [
      "arena",
      "competition",
      "replay",
      "experiment",
      "agents",
    ]) {
      await nav(page, route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
}
test("real worker finishes, pauses without advancing and respects next-game settings", async ({
  page,
}) => {
  await page.goto(arenaURL.replace("speed=20", "speed=1"));
  await page.getByRole("button", { name: "开始新局", exact: true }).click();
  await expect(page.locator("#arena .metrics")).toContainText("1.");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(page.getByRole("button", { name: "继续", exact: true })).toBeEnabled();
  const before = await page.locator("#arena .metrics").textContent();
  await page.waitForTimeout(250);
  expect(await page.locator("#arena .metrics").textContent()).toBe(before);
  await page.getByRole("button", { name: "比赛设置", exact: true }).click();
  await page.locator('[name="seed"]').fill("next-only");
  await page.locator('[name="seed"]').blur();
  expect(await page.locator("#arena .metrics").textContent()).toBe(before);
  await page.getByRole("button", { name: "收起设置", exact: true }).click();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.locator('[name="speed"]').fill("20");
  await page.locator('[name="speed"]').blur();
  await expect(
    page.getByRole("button", { name: "已结束", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("#arena .metrics")).toContainText("10.0 / 10");
});
