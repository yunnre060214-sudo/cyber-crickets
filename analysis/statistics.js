import { createRng } from "../engine/rng.js";
export const mean = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
export function bootstrapInterval(
  values,
  { iterations = 2000, seed = "bootstrap" } = {},
) {
  if (values.length < 8) return null;
  if (iterations !== 2000 || values.some((v) => !Number.isFinite(v)))
    throw Error("INVALID_BOOTSTRAP");
  const rng = createRng(seed, "bootstrap"),
    samples = [];
  for (let n = 0; n < iterations; n++) {
    let sum = 0;
    for (let i = 0; i < values.length; i++)
      sum += values[rng.int(values.length)];
    samples.push(sum / values.length);
  }
  samples.sort((a, b) => a - b);
  return {
    low: samples[Math.floor(0.025 * (iterations - 1))],
    high: samples[Math.ceil(0.975 * (iterations - 1))],
    iterations,
  };
}
