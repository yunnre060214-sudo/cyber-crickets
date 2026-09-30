import test from "node:test";
import assert from "node:assert/strict";
import { Tournament } from "../tournament.js";

test("worker entry advances one round and returns serializable results", async () => {
  const previous = globalThis.self;
  const messages = [];
  globalThis.self = { postMessage: (message) => messages.push(message) };
  try {
    await import("../tournament-worker.js");
    const tournament = new Tournament({
      id: "worker",
      name: "后台比赛",
      format: "knockout",
      seed: "worker-seed",
      duration: 1,
      entrants: [
        "aco",
        "minimax",
        "qlearn",
        "voronoi",
        "bfs",
        "dfs",
        "greedy",
        "random",
      ],
    });
    globalThis.self.onmessage({ data: tournament.toJSON() });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ok, true);
    const resumed = Tournament.fromJSON(messages[0].tournament);
    assert.equal(resumed.rounds[0].completed, true);
    assert.equal(resumed.rounds[1].label, "半决赛");
  } finally {
    globalThis.self = previous;
  }
});
