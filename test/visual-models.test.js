import test from "node:test";
import assert from "node:assert/strict";
test("VP axis expands beyond initial scale and never clips or shrinks", async () => {
  const { computeChartScale } = await import("../ui/chart.js");
  assert.equal(
    computeChartScale({
      durationMs: 120000,
      teamCount: 4,
      values: [0],
      previousMax: 0,
    }),
    300,
  );
  assert.equal(
    computeChartScale({
      durationMs: 120000,
      teamCount: 4,
      values: [350],
      previousMax: 300,
    }),
    500,
  );
  assert.equal(
    computeChartScale({
      durationMs: 120000,
      teamCount: 4,
      values: [200],
      previousMax: 500,
    }),
    500,
  );
  assert.equal(
    computeChartScale({ durationMs: 120000, teamCount: 2, values: [0] }),
    600,
  );
});
test("chart records accumulate by actual irregular simulated time", async () => {
  const { buildChartSeries } = await import("../ui/chart.js");
  const s = buildChartSeries(
    [
      {
        timeMs: 20,
        scoreDeltas: [{ participantId: "p", areaVP: 1, resourceVP: 2 }],
      },
      {
        timeMs: 100,
        scoreDeltas: [{ participantId: "p", areaVP: 3, resourceVP: 4 }],
      },
    ],
    "score",
  );
  assert.deepEqual(s.p, [
    { timeMs: 20, value: 3 },
    { timeMs: 100, value: 10 },
  ]);
});
