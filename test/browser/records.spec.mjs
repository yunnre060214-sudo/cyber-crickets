import { test, expect, arenaURL, nav, persisted } from "./helpers.mjs";
test("save, refresh, resume, seek and actual downloadable import", async ({
  page,
}, info) => {
  await page.goto(arenaURL.replace("speed=20", "speed=1"));
  await page.getByRole("button", { name: "开始新局", exact: true }).click();
  await expect(page.locator("#arena .metrics")).toContainText("1.");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("button", { name: "保存 / 导出", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "继续此存档", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.locator("#replay .record-row button").first().click();
  await page.getByRole("button", { name: "继续此存档", exact: true }).click();
  await page.locator('[name="speed"]').fill("20");
  await page.locator('[name="speed"]').blur();
  await expect(
    page.getByRole("button", { name: "已结束", exact: true }),
  ).toBeDisabled();
  await nav(page, "replay");
  await page.locator("#replay .record-row button").first().click();
  const slider = page.getByLabel("回放时间");
  await slider.fill("5000");
  await slider.dispatchEvent("input");
  await expect(page.locator("#replay .tag")).toHaveText("5.00 秒");
  await page.getByRole("button", { name: "下一 tick", exact: true }).click();
  await expect(page.locator("#replay .tag")).toHaveText("5.02 秒");
  for (const name of ["HTML 战报", "Markdown 摘要", "完整 JSON.gz"]) {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name, exact: true }).click(),
    ]);
    const file = info.outputPath(download.suggestedFilename());
    await download.saveAs(file);
    expect(await download.failure()).toBeNull();
    if (name === "完整 JSON.gz") {
      await page.getByLabel("导入比赛数据").setInputFiles(file);
      await expect(page.locator('#replay [role="status"]')).toContainText(
        "导入成功",
      );
    }
  }
});
test("two actual IndexedDB connections reject stale revisions and deduplicate results", async ({
  page,
  context,
}) => {
  await page.goto(arenaURL);
  const other = await context.newPage();
  await other.goto(arenaURL);
  const record = {
    id: "two-tabs",
    type: "experiment",
    schemaVersion: 3,
    index: { name: "two tabs", completedTasks: 0 },
    payloadRefs: [],
  };
  await persisted(page, (s, r) => s.put(r), record);
  const a = await persisted(page, (s) => s.get("two-tabs"));
  const b = await persisted(other, (s) => s.get("two-tabs"));
  await persisted(
    page,
    (s, r) =>
      s.put(
        { ...r, index: { ...r.index, name: "updated" } },
        { expectedRevision: r.revision },
      ),
    a,
  );
  expect(
    await persisted(
      other,
      async (s, r) => {
        try {
          await s.put(r, { expectedRevision: r.revision });
          return "unexpected";
        } catch (e) {
          return e.message;
        }
      },
      b,
    ),
  ).toBe("STALE_REVISION");
  await Promise.all([
    persisted(page, (s) => s.putTaskResult("two-tabs", "one", { value: 1 })),
    persisted(other, (s) => s.putTaskResult("two-tabs", "one", { value: 1 })),
  ]);
  const final = await persisted(page, (s) => s.get("two-tabs"));
  expect(final.index.completedTasks).toBe(1);
  expect(
    (await persisted(other, (s) => s.taskResults("two-tabs"))).length,
  ).toBe(1);
  await other.close();
});
test("hidden page pauses and requires an explicit return", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === "webkit",
    "WebKit headless visibility does not follow tab focus; Chromium verifies actual visibility events.",
  );
  await page.goto(arenaURL.replace("speed=20", "speed=1"));
  await page.getByRole("button", { name: "开始新局", exact: true }).click();
  await expect(page.locator("#arena .metrics")).toContainText("1.");
  const other = await context.newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  await expect(page.locator("#arena .tag").first()).toHaveText("后台已暂停");
  const before = await page.locator("#arena .metrics").textContent();
  await page.waitForTimeout(200);
  await page.bringToFront();
  expect(await page.locator("#arena .metrics").textContent()).toBe(before);
  await expect(
    page.getByRole("button", { name: "继续", exact: true }),
  ).toBeEnabled();
  await other.close();
});
