import { test, expect, arenaURL, nav, edit, persisted } from "./helpers.mjs";
test("experiment preview, cancellation, continuation and export/import use actual results", async ({
  page,
}, info) => {
  await page.goto(arenaURL);
  await nav(page, "experiment");
  await edit(page, "experiment-durations", "10");
  await edit(page, "experiment-seeds", "browser-seed-one");
  for (let i = 0; i < 4; i++)
    await page.locator(`[name="experiment-agent-${i}"]`).selectOption("random");
  await expect(page.locator("#experiment")).toContainText(
    "计划 4 局 / 1 个独立种子",
  );
  await page.getByRole("button", { name: "创建实验", exact: true }).click();
  await page.getByRole("button", { name: "运行 / 继续", exact: true }).click();
  await expect
    .poll(() =>
      persisted(
        page,
        async (s) =>
          (await s.list({ type: "experiment" })).items[0]?.index
            .completedTasks ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "取消待运行", exact: true }).click();
  await page.getByRole("button", { name: "暂停队列", exact: true }).click();
  await page.getByRole("button", { name: "运行 / 继续", exact: true }).click();
  await expect(page.locator("#experiment")).toContainText("4 / 4 局");
  await expect(page.locator("#experiment")).toContainText("仅显示描述统计");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "完整实验包", exact: true }).click(),
  ]);
  const file = info.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  await nav(page, "replay");
  await page.getByLabel("导入比赛数据").setInputFiles(file);
  await expect(page.locator('#replay [role="status"]')).toContainText(
    "导入成功",
  );
  await nav(page, "experiment");
  await page.locator("#experiment .record-list button").first().click();
  await expect(page.locator("#experiment")).toContainText("4 / 4 局");
});
