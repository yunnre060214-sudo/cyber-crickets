import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { test, expect, arenaURL } from "./helpers.mjs";

if (process.env.EXPECTED_DEPLOY_SHA) {
  test("live Pages serves the exact main manifest and every content-versioned asset", async ({
    page,
  }) => {
    const expected = JSON.parse(await readFile("dist/build-info.json", "utf8"));
    expect(expected.commitSha).toBe(process.env.EXPECTED_DEPLOY_SHA);
    let actual;
    await expect
      .poll(async () => {
        const response = await page.request.get(
          new URL("build-info.json", arenaURL).href,
        );
        if (!response.ok()) return "HTTP " + response.status();
        actual = await response.json();
        return actual.commitSha;
      })
      .toBe(expected.commitSha);
    expect(actual).toEqual(expected);
    for (let start = 0; start < actual.files.length; start += 8) {
      await Promise.all(
        actual.files.slice(start, start + 8).map(async (file) => {
          const response = await page.request.get(
            new URL(file.path, arenaURL).href,
          );
          expect(response.ok(), file.path).toBe(true);
          const body = await response.body();
          expect(body.length, file.path).toBe(file.bytes);
          expect(
            createHash("sha256").update(body).digest("hex"),
            file.path,
          ).toBe(file.sha256);
        }),
      );
    }
  });
}
