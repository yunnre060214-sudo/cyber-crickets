import test from "node:test";
import assert from "node:assert/strict";
test("estimated fixture leg counts reflect entrants maps and format", async () => {
  const { estimateTournamentGames } = await import("../ui/competition.js");
  assert.equal(
    estimateTournamentGames({
      format: "round_robin",
      entrantCount: 4,
      mapCount: 3,
    }),
    36,
  );
  assert.equal(
    estimateTournamentGames({
      format: "knockout",
      entrantCount: 8,
      mapCount: 1,
    }),
    16,
  );
  assert.equal(
    estimateTournamentGames({
      format: "groups",
      entrantCount: 16,
      mapCount: 1,
    }),
    48,
  );
});
