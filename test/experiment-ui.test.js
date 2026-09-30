import test from "node:test";
import assert from "node:assert/strict";
test("experiment data labels describe samples and insufficient independent seeds", async () => {
  const { describeExperimentConfidence } = await import("../ui/experiment.js");
  assert.match(
    describeExperimentConfidence({ independentSeeds: 1 }),
    /1.*种子.*描述/,
  );
  assert.match(describeExperimentConfidence({ independentSeeds: 8 }), /2000/);
});
