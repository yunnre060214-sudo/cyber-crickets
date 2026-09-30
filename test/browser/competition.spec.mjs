import { test, expect, arenaURL, nav, edit, persisted } from "./helpers.mjs";
test("real tournament persists legs and resumes after refresh without double scoring", async ({
  page,
}) => {
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
  await page
    .getByRole("button", { name: /图 1 \/ 局 1/ })
    .first()
    .click();
  await expect(page.getByLabel("回放时间")).toBeVisible();
});
