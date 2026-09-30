import { BaseAgent, clamp, sampleOptions } from "./base.js";
export class SamplingAgent extends BaseAgent {
  selectAction(v) {
    const opts = sampleOptions(v.options, 28, this.rng);
    if (!this.budget.consume("score", opts.length))
      throw Error("BUDGET_EXHAUSTED");
    if (!opts.length) return null;
    const stats = opts.map((move) => ({ move, n: 0, w: 0 }));
    let k = 0;
    while (k < 224 && this.budget.consume("rollout", 3)) {
      const s = stats[k % stats.length];
      k++;
      let total = 0;
      for (let d = 0; d < 3; d++)
        total +=
          s.move.resource * 5 +
          (s.move.enemy ? 4 : 1) +
          s.move.ownN * 1.2 -
          s.move.enemyN * 0.9 -
          s.move.terrain * 0.6 +
          (this.rng.next() * 5 - 2.1);
      s.n++;
      s.w += total;
    }
    const best = stats.reduce((a, b) =>
      a.w / Math.max(1, a.n) > b.w / Math.max(1, b.n) ? a : b,
    );
    this.lastChoice = best.move.to;
    this.thought = "固定 " + k + " 次局部采样，选择平均回报最高落点";
    return best.move;
  }
}

export class StrongestAgent extends BaseAgent {
  constructor(id, size, rng) {
    super(id, size, rng);
    this.recentTargets = new Int32Array(14).fill(-1);
    this.recentCursor = 0;
    this.failures = new Map();
    this.peakShare = 0;
    this.lastShare = null;
    this.shareLossEMA = 0;
    this.pressureEMA = 0;
    this.rateDeficitEMA = 0;
    this.strategyState = {
      drawdown: 0,
      pressure: 0,
      rateDeficit: 0,
      collapse: 0,
      fortify: 0,
    };
  }

  observe(v) {
    const share = Number.isFinite(v.share) ? v.share : 0;
    if (this.lastShare == null) {
      this.lastShare = share;
      this.peakShare = share;
    }
    this.peakShare = Math.max(this.peakShare, share);
    const loss = Math.max(0, this.lastShare - share);
    const normalizedLoss = loss / Math.max(0.02, this.lastShare);
    this.shareLossEMA = this.shareLossEMA * 0.9 + normalizedLoss * 0.1;
    this.pressureEMA =
      this.pressureEMA * 0.92 + clamp(v.localPressure ?? 0, 0, 1) * 0.08;

    const leaderRate = this.scoreOutlook(v).rivalRate;
    const rateDeficit = clamp(
      (leaderRate - (v.vpRate ?? 0)) / leaderRate,
      0,
      1.5,
    );
    this.rateDeficitEMA = this.rateDeficitEMA * 0.9 + rateDeficit * 0.1;

    const drawdown =
      this.peakShare > 0
        ? clamp((this.peakShare - share) / this.peakShare, 0, 1)
        : 0;
    const pressure = Math.max(
      clamp(v.localPressure ?? 0, 0, 1),
      this.pressureEMA,
    );
    const deficit = Math.max(rateDeficit, this.rateDeficitEMA);
    const rivalShare = v.opponents?.length
      ? Math.max(...v.opponents.map((o) => o.territory / this.size))
      : (v.leaderShare ?? share);
    const leaderGap = Math.max(0, rivalShare - share);
    const collapse = clamp(
      drawdown * 0.95 +
        Math.max(0, pressure - 0.42) * 1.25 +
        deficit * 0.72 +
        leaderGap * 1.5 +
        this.shareLossEMA * 2.4,
      0,
      1.6,
    );
    const fortify = clamp((collapse - 0.38) / 0.72, 0, 1);

    this.strategyState = {
      drawdown,
      pressure,
      rateDeficit: deficit,
      collapse,
      fortify,
    };
    this.lastShare = share;
  }

  phase(v) {
    if (v.progress < 0.18) return "opening";
    if (v.progress < 0.48) return "expansion";
    if (v.progress < 0.82) return "contest";
    return "final";
  }

  scoreOutlook(v) {
    const remaining = Number.isFinite(v.remaining)
      ? Math.max(0, v.remaining)
      : Math.max(0, (v.duration ?? 90) * (1 - v.progress));
    const rate = Math.max(0, v.vpRate ?? 0),
      score = v.score ?? 0;
    const rivals = v.opponents || [];
    const rivalRate = rivals.length
      ? Math.max(0.12, ...rivals.map((o) => o.vpRate))
      : Math.max(0.12, v.leaderVpRate ?? rate);
    const rivalProjection = rivals.length
      ? Math.max(...rivals.map((o) => o.score + o.vpRate * remaining))
      : score +
        (v.rank === 1 ? -(v.leadMargin ?? 0) : (v.scoreGap ?? 0)) +
        rivalRate * remaining;
    return {
      remaining,
      rivalRate,
      projectedMargin: score + rate * remaining - rivalProjection,
    };
  }

  posture(v) {
    const outlook = this.scoreOutlook(v);
    const remaining = Math.max(1, outlook.remaining),
      baseline = outlook.rivalRate;
    const catchup = clamp(
      Math.max(v.scoreGap ?? 0, -outlook.projectedMargin) /
        (remaining * baseline + 1),
      0,
      1.6,
    );
    const cushion =
      v.rank === 1
        ? clamp(
            outlook.projectedMargin /
              (remaining * Math.max(0.12, v.vpRate ?? 0) + 1),
            0,
            1.4,
          )
        : 0;
    const liveDeficit = clamp(
      (baseline - Math.max(0, v.vpRate ?? 0)) / baseline,
      0,
      1.5,
    );
    const state = this.strategyState || {
      collapse: 0,
      fortify: 0,
      rateDeficit: 0,
    };
    const danger = state.collapse || 0;
    const fortify = state.fortify || 0;
    const productionDeficit = Math.max(liveDeficit, state.rateDeficit || 0);
    const urgency = clamp(catchup * 0.58 + productionDeficit * 0.72, 0, 1.4);
    const risk = clamp(
      0.5 + catchup * 0.38 + urgency * 0.18 - cushion * 0.3 - fortify * 0.42,
      0.16,
      1.18,
    );
    const mode =
      fortify > 0.42
        ? "fortify"
        : v.rank === 1 &&
            (cushion > 0.18 || danger > 0.28 || outlook.projectedMargin < 0)
          ? "control"
          : v.rank > 1 && (catchup > 0.12 || productionDeficit > 0.16)
            ? "chase"
            : "balanced";
    return {
      catchup,
      cushion,
      risk,
      danger,
      fortify,
      productionDeficit,
      mode,
      projectedMargin: outlook.projectedMargin,
    };
  }

  estimatedChance(o, overclock) {
    let p =
      o.owner < 0
        ? 0.93 - (o.terrain - 1) * 0.12
        : 0.39 + o.ownN * 0.105 - o.enemyN * 0.075 - (o.terrain - 1) * 0.05;
    if (overclock) p += 0.075;
    return clamp(p, 0.12, 0.93);
  }

  retryPenalty(o, final) {
    const failed = this.failures.get(o.to) || 0;
    let repeated = 0;
    for (let i = 0; i < this.recentTargets.length; i++)
      if (this.recentTargets[i] === o.to) repeated++;
    return failed * (final ? 0.3 : 1.15) + repeated * (final ? 0.08 : 0.2);
  }

  frontierQuality(o, v, phase, posture) {
    const branches = Math.min(4, o.continuations?.length || 0);
    const openness = Math.max(0, 2 - o.ownN);
    const reach = clamp(o.distOwnCore / 18, 0, 2.6);
    const forward = clamp((o.distOwnCore - o.distRivalCore) / 18, -1.2, 1.2);
    const neutral = o.owner < 0 ? 1 : 0;
    const fortify = posture.fortify;
    const growthHorizon = o.enemy ? 1 : clamp((v.remaining ?? 90) / 90, 1, 4);

    if (phase === "opening") {
      return (
        (neutral * (branches * 1.55 + openness * 1.35 + reach * 1.05) +
          (o.nearestResourceDist <= 4
            ? (4 - o.nearestResourceDist) * 1.05
            : 0)) *
        growthHorizon
      );
    }
    if (phase === "expansion") {
      return (
        (neutral * (branches * 1.12 + openness * 0.82 + reach * 0.68) +
          forward * 0.72 +
          (o.nearestResourceDist <= 3 ? (4 - o.nearestResourceDist) * 0.8 : 0) +
          fortify * (o.ownN * 1.25 - o.enemyPressure * 1.6)) *
        growthHorizon
      );
    }
    if (phase === "contest") {
      return (
        branches * 0.34 +
        forward * 0.48 +
        (o.enemy ? (1.4 + posture.catchup * 1.9) * (1 - fortify * 0.72) : 0) +
        fortify *
          (neutral * 1.2 +
            o.ownN * 1.7 -
            o.enemyN * 1.25 -
            o.enemyPressure * 2.4)
      );
    }
    return (
      branches * 0.08 +
      (o.enemy ? 1.6 * (1 - fortify * 0.78) : 0) +
      fortify *
        (neutral * 1.35 +
          o.ownN * 1.95 -
          o.enemyN * 1.45 -
          o.enemyPressure * 2.9)
    );
  }

  staticValue(o, v, { continuation = false, context } = {}) {
    if (!this.budget.consume(continuation ? "rollout" : "score"))
      throw Error("BUDGET_EXHAUSTED");
    const phase = context?.phase ?? this.phase(v),
      final = phase === "final";
    const posture = context?.posture ?? this.posture(v);
    const remaining = Math.max(0, 1 - v.progress);
    const p = this.estimatedChance(o, final);
    const horizon =
      (continuation ? 0.22 : 0.34) + remaining * (continuation ? 1.18 : 1.72);
    const fortify = posture.fortify;

    const fallbackResourceWeight = {
      opening: 6.9,
      expansion: 4.6,
      contest: 6.4,
      final: 8.2,
    }[phase];
    // In area-score units, one resource unit has the exact marginal VP ratio
    // 3.5 / resourceTotal : 6.5 / cellCount. Holding time remains a heuristic.
    const resourceWeight =
      v.resourceTotal > 0
        ? (3.5 * this.size) / v.resourceTotal
        : fallbackResourceWeight;
    const contacts = o.enemyPressure * 4;
    const holdHorizon = Math.min(
      18,
      Math.max(0.105, v.remaining ?? 90 * (1 - v.progress)),
    );
    const holdSeconds =
      contacts > 0
        ? (1.5 + o.ownN * 2.5) /
          (contacts * (0.5 + contacts * 0.5 + (final ? 0.3 : 0)))
        : holdHorizon;
    const retention = clamp(holdSeconds / holdHorizon, 0, 1);
    const area = 6.5;
    const resource =
      o.resource * resourceWeight * retention * (1 - fortify * 0.28);
    const denial = o.enemy
      ? ((phase === "final" ? 6.1 : phase === "contest" ? 4.9 : 3.7) +
          resource * 0.6) *
        (1 - fortify * 0.55)
      : 0;
    const direct = horizon * (area + resource + denial);

    const path =
      o.nearestResourceDist >= 99
        ? 0
        : { opening: 8.1, expansion: 6.4, contest: 5.1, final: 3.2 }[phase] /
          (1 + o.nearestResourceDist * 0.42);
    const pull =
      o.resourcePull *
      { opening: 1.58, expansion: 1.26, contest: 1.18, final: 0.92 }[phase] *
      (1 - fortify * 0.32);
    const cohesion =
      o.ownN *
        { opening: 0.72, expansion: 1.02, contest: 1.58, final: 1.9 }[phase] -
      o.enemyN *
        { opening: 0.34, expansion: 0.42, contest: 0.52, final: 0.42 }[phase] +
      fortify * (o.ownN * 2.65 - o.enemyN * 2.15);
    const quality = this.frontierQuality(o, v, phase, posture);
    const attack = o.enemy
      ? (2.5 +
          o.ownN * 1.38 -
          o.enemyN * 0.92 +
          (o.resource > 0 ? 6.2 : 0) +
          posture.catchup * 2.6) *
        (1 - fortify * 0.68)
      : 0;

    const friction =
      (o.terrain - 1) *
      { opening: 1.0, expansion: 0.92, contest: 0.72, final: 0.45 }[phase];
    const pressure =
      o.enemyPressure *
      ((o.enemy ? 0.48 : phase === "opening" ? 1.0 : 0.86) + fortify * 4.3);
    const retry = continuation ? 0 : this.retryPenalty(o, final);

    const leadControl =
      posture.cushion > 0
        ? posture.cushion *
          (o.ownN * 1.85 - o.enemyPressure * 2.1 + (o.owner < 0 ? 1.15 : 0))
        : 0;
    const comeback =
      posture.catchup > 0
        ? posture.catchup *
          ((o.enemy ? 2.25 : 0) +
            o.resource * 1.75 +
            (o.owner < 0 ? quality * 0.18 : 0)) *
          (1 - fortify * 0.6)
        : 0;
    const stability =
      fortify *
      (o.ownN * 3.15 -
        o.enemyN * 2.75 -
        o.enemyPressure * 4.6 +
        (o.owner < 0 ? 1.45 : 0) +
        (o.enemy && o.ownN >= 3 ? 1.2 : 0));
    const assetProtection =
      (o.protectedResourceValue || 0) *
      resourceWeight *
      0.075 *
      (2 + fortify * 2);
    // Under contact, multiple friendly edges both close holes and improve the
    // next countercapture. Keep this separate from open-frontier investment.
    const contact = clamp(((v.localPressure ?? 0) - 0.2) / 0.5, 0, 1);
    const boundaryControl = 8 * contact * o.ownN * (o.ownN - 1);

    const value = {
      p,
      utility:
        p *
          (direct +
            path +
            pull +
            cohesion +
            quality +
            attack +
            leadControl +
            comeback +
            stability +
            assetProtection +
            boundaryControl) -
        friction -
        pressure -
        retry,
    };
    if (!continuation) {
      this.evaluated.push({ to: o.to, score: value.utility });
      if (value.utility > this.bestScore) {
        this.bestScore = value.utility;
        this.best = o;
      }
    }
    return value;
  }

  continuationValue(o, v, context) {
    const next = o.continuations || [];
    if (!next.length) return 0;
    const scored = next
      .map(
        (n) => this.staticValue(n, v, { continuation: true, context }).utility,
      )
      .sort((x, y) => y - x)
      .slice(0, 3);
    const best = scored[0] || 0,
      second = scored[1] ?? best,
      third = scored[2] ?? second;
    return 0.66 * best + 0.23 * second + 0.11 * third;
  }

  opponentRisk(o, v, context) {
    const phase = context?.phase ?? this.phase(v),
      posture = context?.posture ?? this.posture(v);
    const pressure = clamp(
      (v.localPressure ?? 0) * 0.58 + o.enemyPressure * 0.42,
      0,
      1,
    );
    const contact = pressure * 3.15 + o.enemyN * 0.7;
    const exposure = Math.max(0, 2 - o.ownN) * (o.enemy ? 1.08 : 0.66);
    const stage =
      phase === "final"
        ? 1.3 + pressure * 0.55
        : phase === "contest"
          ? 1.0
          : 0.9;
    const strategic = 1 + posture.fortify * 1.2;
    return (contact + exposure) * stage * strategic;
  }

  selectAction(v) {
    if (!v.options.length) return null;
    this.observe(v);
    const phase = this.phase(v),
      posture = this.posture(v);
    const context = { phase, posture };
    // Multiple friendly origins do not create different capture outcomes.
    // Reserve beam slots and tie-break draws for unique targets.
    const targets = [...new Map(v.options.map((o) => [o.to, o])).values()];
    const ranked = targets
      .map((o) => {
        const now = this.staticValue(o, v, { context });
        return { o, now, pre: now.utility };
      })
      .sort((x, y) => y.pre - x.pre);

    const width =
      posture.fortify > 0.25
        ? 28
        : phase === "final"
          ? 18
          : phase === "contest"
            ? 22
            : 24;
    const beam = ranked.slice(0, Math.min(width, ranked.length));
    if (posture.fortify > 0.25) {
      const stable = [...ranked]
        .sort((a, b) => {
          const sa =
            a.o.ownN * 3.4 -
            a.o.enemyN * 2.25 -
            a.o.enemyPressure * 4.4 +
            (a.o.owner < 0 ? 2 : 0);
          const sb =
            b.o.ownN * 3.4 -
            b.o.enemyN * 2.25 -
            b.o.enemyPressure * 4.4 +
            (b.o.owner < 0 ? 2 : 0);
          return sb - sa;
        })
        .slice(0, 8);
      const seen = new Set(beam.map((item) => item.o.to));
      for (const item of stable)
        if (!seen.has(item.o.to)) {
          beam.push(item);
          seen.add(item.o.to);
        }
    }

    const lookaheadWeight = {
      opening: 0.46,
      expansion: 0.56,
      contest: 0.62,
      final: 0.34,
    }[phase];

    let best = null,
      bestScore = -Infinity,
      bestFuture = 0,
      bestP = 0;
    for (const item of beam) {
      const future = this.continuationValue(item.o, v, context);
      const risk = this.opponentRisk(item.o, v, context);
      const lookahead = item.now.p * future * lookaheadWeight;
      const riskAversion = clamp(
        1.22 - posture.risk + posture.fortify * 0.92,
        0.18,
        1.72,
      );
      const score =
        item.now.utility +
        lookahead -
        risk * riskAversion +
        this.rng.next() * 0.02;
      if (score > bestScore) {
        bestScore = score;
        best = item.o;
        bestFuture = lookahead;
        bestP = item.now.p;
      }
    }

    if (best) {
      this.lastChoice = best.to;
      this.recentTargets[this.recentCursor] = best.to;
      this.recentCursor = (this.recentCursor + 1) % this.recentTargets.length;
      const motive =
        posture.mode === "fortify" && best.owner < 0
          ? "收紧边界"
          : posture.mode === "fortify" && best.ownN >= 3
            ? "局部反推"
            : best.protectedResourceValue > 0
              ? "保护资源支点"
              : best.enemy && best.resource > 0
                ? "夺取敌方资源"
                : best.resource > 0
                  ? "高价值资源"
                  : best.enemy
                    ? "主动翻色"
                    : phase === "opening" && best.ownN <= 1
                      ? "抢占高质量前沿"
                      : best.nearestResourceDist <= 3
                        ? "资源通路"
                        : best.ownN >= 2
                          ? "连续阵型"
                          : "边界扩张";
      const stance = {
        fortify: "止损",
        control: "控场",
        chase: "追分",
        balanced: "均衡",
      }[posture.mode];
      this.thought =
        "阶段化 VP 规划：" +
        motive +
        "；" +
        stance +
        "；首步成功率 " +
        Math.round(bestP * 100) +
        "%；后续价值 " +
        bestFuture.toFixed(1) +
        "；崩盘风险 " +
        Math.round(clamp(posture.danger, 0, 1) * 100) +
        "%；静态终局差 " +
        posture.projectedMargin.toFixed(1) +
        " VP；阶段 " +
        phase;
    }
    return best;
  }

  onResult(r) {
    super.onResult(r);
    if (!r?.move) return;
    const key = r.move.to;
    if (r.success) this.failures.delete(key);
    else this.failures.set(key, Math.min(5, (this.failures.get(key) || 0) + 1));
    if (this.failures.size > 96)
      this.failures.delete(this.failures.keys().next().value);
  }

  reset() {
    this.recentTargets.fill(-1);
    this.recentCursor = 0;
    this.failures.clear();
    this.peakShare = 0;
    this.lastShare = null;
    this.shareLossEMA = 0;
    this.pressureEMA = 0;
    this.rateDeficitEMA = 0;
    this.strategyState = {
      drawdown: 0,
      pressure: 0,
      rateDeficit: 0,
      collapse: 0,
      fortify: 0,
    };
  }
}
