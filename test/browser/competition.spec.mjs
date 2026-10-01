import { test, expect, arenaURL, nav, edit, persisted } from "./helpers.mjs";
test("real tournament persists legs and resumes after refresh without double scoring", async ({
  page,
}, info) => {
  await page.goto(arenaURL);
  await nav(page, "competition");
  await edit(page, "competition-duration", "10");
  for (let i = 0; i < 4; i++)
    await page
      .locator(`[name="competition-agent-${i}"]`)
      .selectOption("random");
  await page.getByRole("button", { name: "创建赛事", exact: true }).click();
  await page.getByRole("button", { name: "运行 / 继续", exact: true }).click();
  await expect
    .poll(() =>
      persisted(
        page,
        async (s) =>
          (await s.list({ type: "competition" })).items[0]?.index
            .completedTasks ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "暂停队列", exact: true }).click();
  await page.reload();
  await nav(page, "competition");
  await page.locator("#competition .record-list button").first().click();
  await page.getByRole("button", { name: "运行 / 继续", exact: true }).click();
  await expect(page.locator("#competition .tag")).toHaveText("已结束");
  const data = await persisted(page, async (s) => {
    const r = (await s.list({ type: "competition" })).items[0];
    return { r, results: await s.taskResults(r.id) };
  });
  expect(new Set(data.results.map((r) => r.jobId)).size).toBe(
    data.results.length,
  );
  expect(data.r.index.completedTasks).toBe(data.results.length);
  expect(data.results.length).toBeGreaterThanOrEqual(8);
  const fixtures = data.r.state.rounds.flatMap((r) => r.fixtures);
  expect(Object.keys(data.r.state.fixtureReasons).sort()).toEqual(
    fixtures.map((f) => f.id).sort(),
  );
  await expect(page.locator("#competition [data-fixture-reason]")).toHaveCount(
    fixtures.length,
  );
  await page.reload();
  await nav(page, "competition");
  await page.locator("#competition .record-list button").first().click();
  await expect(page.locator("#competition [data-fixture-reason]")).toHaveCount(
    fixtures.length,
  );
  for (const name of ["HTML 报告", "Markdown", "完整赛事包"]) {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name, exact: true }).click(),
    ]);
    const path = info.outputPath(download.suggestedFilename());
    await download.saveAs(path);
    expect(await download.failure()).toBeNull();
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile(path);
    if (name === "完整赛事包") {
      const { gunzipSync } = await import("node:zlib");
      const pkg = JSON.parse(
        path.endsWith(".gz") ? gunzipSync(bytes).toString() : bytes.toString(),
      );
      expect(pkg.state.fixtureReasons).toEqual(data.r.state.fixtureReasons);
    } else expect(bytes.toString()).toContain("决胜依据");
  }
  await page
    .getByRole("button", { name: /图 1 \/ 局 1/ })
    .first()
    .click();
  await expect(page.getByLabel("回放时间")).toBeVisible();
});
