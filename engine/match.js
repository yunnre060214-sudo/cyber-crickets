import { FixedClock } from "./clock.js";
import { createRng } from "./rng.js";
import { canonicalHash, seal, verify } from "./hash.js";
import { generateMap } from "./maps.js";
import { applyDueEvents } from "./events.js";
import { resolveActions, vpRate } from "./rules.js";
import { FrontierIndex } from "./frontier.js";
import { createAgent } from "../agents/registry.js";
import { createBudget } from "../agents/budget.js";
import { buildAgentView } from "../agents/context.js";
export const TEAM_COLORS = ["#247858", "#b54b49", "#3473b2", "#9a7729"];
export class MatchEngine {
  constructor(config) {
    this.config = config;
    this.matchId = canonicalHash(config);
    this.tickMs = 20;
    this.clock = new FixedClock(config);
    const { board, eventPlan } = generateMap(config);
    this.board = board;
    this.initialBoard = structuredClone(board);
    this.eventPlan = eventPlan;
    this.eventState = new Set();
    this.events = [];
    this.ledger = [];
    this.boardCheckpoints = [];
    this.latestCheckpoint = null;
    this.finished = false;
    this.observations = config.entrants.map((e) => ({
      participantId: e.participantId,
      samples: 0,
      thinkMs: 0,
      budgetUsed: 0,
    }));
    this.frontier = new FrontierIndex(board);
    this.agents = config.entrants.map((e, seat) =>
      createAgent(e.strategyId, {
        participantId: e.participantId,
        seat,
        rng: createRng(
          config.seed,
          "agent:" + e.participantId + ":" + e.strategyId,
        ),
        size: 4096,
        parameters: e.parameters,
        budgetProfile: config.budgetProfile,
      }),
    );
    this.teams = config.entrants.map((e, seat) => ({
      ...e,
      seat,
      color: TEAM_COLORS[seat],
      score: 0,
      territory: 9,
      resources: 0,
      captures: 0,
      vpRate: 0,
      thought: "等待决策",
      thinkMs: 0,
      budgetUsed: 0,
      lastMove: null,
    }));
    this.updateStats();
  }
  updateStats() {
    const b = this.board,
      areas = this.teams.map(() => 0),
      values = this.teams.map(() => 0);
    let total = 0;
    for (let i = 0; i < 4096; i++) {
      total += b.resources[i];
      if (b.owner[i] >= 0) {
        areas[b.owner[i]]++;
        values[b.owner[i]] += b.resources[i];
      }
    }
    this.resourceTotal = total;
    this.teams.forEach((t, i) => {
      t.territory = areas[i];
      t.resources = values[i];
      t.vpRate = vpRate({
        area: t.territory,
        playableCellCount: b.playableCellCount,
        resourceValue: t.resources,
        resourceTotal: total,
      });
    });
  }
  getInitialBoard() {
    return structuredClone(this.initialBoard);
  }
  getSnapshot() {
    return {
      config: this.config,
      matchId: this.matchId,
      tick: this.clock.tick,
      timeMs: this.clock.timeMs,
      finished: this.finished,
      boardRevision: this.clock.tick,
      board: structuredClone(this.board),
      teams: structuredClone(this.teams),
      events: structuredClone(this.events),
      publicDecisionTrace: this.teams.map((t) => t.lastMove?.explain ?? null),
      ...(this.config.mode === "migration"
        ? {
            publicRotationPlan: structuredClone(
              this.eventPlan.publicRotationPlan,
            ),
          }
        : {}),
    };
  }
  advance(count) {
    if (!Number.isSafeInteger(count) || count < 0)
      throw Error("INVALID_TICK_COUNT");
    const records = [];
    for (let n = 0; n < count && !this.finished; n++) {
      const scoreDeltas = this.teams.map((t) => ({
        participantId: t.participantId,
        areaVP: ((6.5 * t.territory) / this.board.playableCellCount) * 0.02,
        resourceVP: this.resourceTotal
          ? ((3.5 * t.resources) / this.resourceTotal) * 0.02
          : 0,
      }));
      scoreDeltas.forEach(
        (d, i) => (this.teams[i].score += d.areaVP + d.resourceVP),
      );
      const [{ tick, timeMs, ended }] = this.clock.advance(1);
      const events = applyDueEvents(
        this.board,
        this.eventPlan,
        timeMs,
        this.eventState,
      );
      this.events.push(...events);
      if (events.length) this.updateStats();
      const proposals = [];
      if (timeMs % 100 === 0 && !ended) {
        const snapshot = this.getSnapshot();
        for (let seat = 0; seat < this.teams.length; seat++) {
          const options = this.frontier.options(seat),
            view = buildAgentView(snapshot, seat, options),
            budget = createBudget(this.config.budgetProfile),
            start = performance.now(),
            move = this.agents[seat].selectAction(view, budget),
            team = this.teams[seat];
          team.thinkMs = performance.now() - start;
          team.budgetUsed = budget.used;
          const observation = this.observations[seat];
          observation.samples++;
          observation.thinkMs += team.thinkMs;
          observation.budgetUsed += budget.used;
          team.thought = this.agents[seat].thought;
          if (move)
            proposals.push({ participantId: team.participantId, seat, move });
        }
      }
      const results = resolveActions(this.board, proposals, {
          seed: this.config.seed,
          tick,
          overclock: this.eventState.has("overclock"),
        }),
        ownershipChanges = [];
      for (const r of results) {
        const team = this.teams[r.seat];
        if (r.success) {
          ownershipChanges.push({
            index: r.move.to,
            previousOwner: r.previousOwner,
            owner: r.seat,
          });
          if (r.previousOwner >= 0) team.captures++;
        }
        team.lastMove = r.move;
        this.agents[r.seat].onResult(r);
      }
      this.frontier.applyChanges(ownershipChanges);
      if (ownershipChanges.length) this.updateStats();
      const record = {
        seq: this.ledger.length,
        tick,
        timeMs,
        elapsedMs: 20,
        resourceChanges: events.flatMap((e) => e.changes),
        proposals,
        results,
        ownershipChanges,
        scoreDeltas,
        events,
      };
      this.ledger.push(record);
      records.push(record);
      if (ended) {
        this.finished = true;
        const s = this.getSnapshot();
        this.agents.forEach((a, seat) =>
          a.endMatch(buildAgentView(s, seat, [])),
        );
      }
      if (timeMs % 10000 === 0)
        this.boardCheckpoints.push({
          tick,
          timeMs,
          board: structuredClone(this.board),
          scores: this.teams.map((t) => t.score),
        });
      if (timeMs % 5000 === 0) this.latestCheckpoint = this.captureCheckpoint();
    }
    return structuredClone(records);
  }
  captureCheckpoint() {
    return seal({
      schemaVersion: 3,
      config: this.config,
      tick: this.clock.tick,
      timeMs: this.clock.timeMs,
      finished: this.finished,
      board: structuredClone(this.board),
      scores: this.teams.map((t) => t.score),
      teams: this.teams.map(({ thinkMs, ...t }) => structuredClone(t)),
      rngStates: this.agents.map((a) => a.rng.exportState()),
      agentStates: this.agents.map((a) => a.exportState()),
      eventState: [...this.eventState],
      events: structuredClone(this.events),
      ledgerCursor: this.ledger.length,
      ledger: structuredClone(this.ledger),
      boardCheckpoints: structuredClone(this.boardCheckpoints),
    });
  }
  restore(cp) {
    verify(cp);
    if (
      cp.schemaVersion !== 3 ||
      canonicalHash(cp.config) !== canonicalHash(this.config) ||
      cp.timeMs !== cp.tick * 20 ||
      cp.tick < 0 ||
      cp.timeMs > this.config.durationMs ||
      cp.ledgerCursor !== cp.ledger.length
    )
      throw Error("CHECKPOINT_CONFIG_MISMATCH");
    this.clock.tick = cp.tick;
    this.clock.timeMs = cp.timeMs;
    this.finished = cp.finished;
    this.board = structuredClone(cp.board);
    this.teams = structuredClone(cp.teams).map((t) => ({ ...t, thinkMs: 0 }));
    this.frontier = new FrontierIndex(this.board);
    cp.agentStates.forEach((s, i) => this.agents[i].importState(s));
    this.eventState = new Set(cp.eventState);
    this.events = structuredClone(cp.events);
    this.ledger = structuredClone(cp.ledger);
    this.boardCheckpoints = structuredClone(cp.boardCheckpoints);
    this.updateStats();
  }
  readLedger(cursor = 0) {
    if (
      !Number.isSafeInteger(cursor) ||
      cursor < 0 ||
      cursor > this.ledger.length
    )
      throw Error("INVALID_LEDGER_CURSOR");
    return {
      records: structuredClone(this.ledger.slice(cursor)),
      nextCursor: this.ledger.length,
    };
  }
  getResult() {
    if (!this.finished) throw Error("MATCH_NOT_FINISHED");
    return seal({
      config: this.config,
      finished: true,
      timeMs: this.clock.timeMs,
      board: structuredClone(this.board),
      teams: this.teams.map(({ thinkMs, ...t }) => structuredClone(t)),
      events: structuredClone(this.events),
      ledger: structuredClone(this.ledger),
    });
  }
  getObservations() {
    return this.observations.map((o) => ({
      participantId: o.participantId,
      samples: o.samples,
      meanThinkMs: o.samples ? o.thinkMs / o.samples : null,
      meanBudgetUsed: o.samples ? o.budgetUsed / o.samples : 0,
    }));
  }
}
