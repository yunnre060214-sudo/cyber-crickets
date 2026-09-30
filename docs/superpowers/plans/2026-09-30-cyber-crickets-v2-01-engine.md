# Cyber Crickets 2.0 引擎基础 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可复现的经典兼容适配器和具有完整状态恢复能力的 v2 引擎。

**Architecture:** 依次冻结旧引擎，建立类型、整数时钟、分离 RNG、对称地图和完整前沿，再适配策略并组合新引擎。无 DOM 的测试直接运行真实引擎；所有后续模块消费总计划中的同一数据契约。

**Tech Stack:** 原生 JavaScript ES modules、Node.js 24、Canvas/SVG、Web Worker、IndexedDB、CompressionStream；构建无前端框架。

**Spec:** [已确认的 2.0 设计](../specs/2026-09-30-cyber-crickets-v2-design.md)

## Global Constraints

1. 先阅读总计划中的共享契约和完整设计；本计划使用同一套接口名称与版本字段。
2. 默认浅色界面，直角、细分隔线、扁平、小字号；主要功能适配手机。
3. 保留 60/90/120/180 秒、10～1800 秒整数时长、0.25×～20×播放速度；播放速度不进入引擎结果。
4. v2 使用 20 毫秒整数 tick、100 毫秒同步决策；经典 1.0 保留基线 .035 步进语义。
5. 公共工作预算：快速 4096、标准 8192、深入 16384；全场统一，墙钟耗时不影响决策次数。
6. 标准地图 64×64；开局 24 个价值 1 和 8 个价值 3 的永久节点；模式事件遵循设计中的确切值。
7. 各方共享公开信息、同步结算、核心保护；即时 reward、VP、局势估计和样本胜率分别展示。
8. 保存/导入/任务消息均有版本和标识校验；线上实际版本是发布验收标准。

## Review Focus

1. 暂停恰逢事件或结束边界，恢复后不得重复事件、漏计 VP 或额外决策：任务 6、8、11 验证。
2. 四方选择重复策略时，各参赛者随机流、颜色和日志不能混为同一人：任务 2、5、8 验证。
3. 刷新、重复 Worker 消息或另一个标签页写入时，已经结算的任务不得重复计分：任务 12、15、17 验证。
4. 大文件、损坏压缩包、未知版本或异常数值导入时，不能半写记录或执行输入文本：任务 13 验证。
5. 手机设置展开、后台返回与高分曲线同时出现时，操作按钮必须可达，比赛时间与真实分差不丢失：任务 9、10、19 验证。

---

## Task 1: 冻结经典并建立适配器

**Files:** Create `legacy/v1/match.js`、`legacy/v1/agents.js`、`legacy/v1/rules.js`、`legacy/adapter.js`、`engine/hash.js`、`test/legacy.test.js`、`test/support/classic-digest.js`。
**Interfaces:** Consumes 已核查基线三文件；Produces `LegacyMatchAdapter(config)` 的 MatchEngine 接口、`classicDigest(rawMatch):string`、`canonicalSerialize(data):string`及`canonicalHash(data):string`。适配器同时可接收旧式 seed/rotation/duration/strategies/agentKeys 配置，供黄金测试直接使用；`rawMatch` 仅为经典测试与适配器内部访问。

- [ ] **Step 1:** 写 `classic_matches_frozen_golden`：逐个运行总计划三样本，断言决策数为380/190/2288及对应三个准确SHA；写 `classic_resume_preserves_rng_and_agent_state`，中间保存后恢复与不断运行的digest相同。

```js
test('classic_four_golden', () => {
  const m = new LegacyMatchAdapter({seed:'legacy-four-2.0',rotation:2,duration:10,strategies:['aco','strongest','qlearn','voronoi']});
  while (!m.getSnapshot().finished) m.advance(1);
  assert.equal(m.rawMatch.decisionLog.length, 380);
  assert.equal(classicDigest(m.rawMatch), '72033b2121bec5439a738f11c3da7947a1aded3b0d3f3fa64c58a75735f5870a');
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/legacy.test.js`；初次应因缺少适配器或恢复行为失败，黄金值不得更改。
- [ ] **Step 3:** 逐字复制三文件，外围适配器包装RNG计数和状态白名单，复制棋盘快照；保存time、nextSnapshot、flags、teams、resourceCells、timeline及日志游标，恢复完整实例。规范串排序对象键、保留数组顺序、编码TypedArray标签并拒绝循环；同步完整性摘要采用FNV-1a64的16位十六进制值，经典黄金值与发布源码继续使用SHA-256。
- [ ] **Step 4:** 重跑同一文件，所有黄金与恢复断言通过；对复制源码使用Git blob SHA核对基线。
- [ ] **Step 5:** 检查变更并提交 `feat: preserve classic engine and deterministic checkpoints`。

## Task 2: 类型、配置、整数时钟与随机接口

**Files:** Create `engine/types.js`、`engine/config.js`、`engine/clock.js`、`engine/rng.js`、`test/config-clock.test.js`、`test/support/factories.js`。
**Interfaces:** Consumes任务1规范摘要；Produces总计划类型、`createMatchConfig(input)`、`STRATEGY_IDS`（21个设计ID）、`FixedClock({durationMs,tickMs})`、`createRng(seed,stream,state?)`、`randomFor(seed,key)`；Clock的`advance(count)`返回`{tick,timeMs,ended}[]`，只推进未结束tick。测试辅助`testConfig(overrides={})`固定seed=test-default、10000ms、standard/plain、p0..p3使用random/greedy/turtle/strongest，`resultDigest(result)`排除墙钟数据。

- [ ] **Step 1:** 写 `clock_is_batch_invariant`，一次advance(500)与五次advance(100)末状态均为timeMs=10000；`config_rejects_invalid_identity`断言重复participantId、NaN、10001毫秒及单挑rotation>1无效；`duplicate_strategy_keeps_distinct_participants`断言两个random允许且随机身份不同。

```js
test('clock_is_batch_invariant', () => {
  const a = new FixedClock({durationMs:10000,tickMs:20});
  const b = new FixedClock({durationMs:10000,tickMs:20});
  const whole = a.advance(500), chunks = Array.from({length:5}, () => b.advance(100)).flat();
  assert.deepEqual(chunks, whole);
  assert.equal(whole.at(-1).timeMs, 10000);
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/config-clock.test.js`，确认缺少目标接口的失败。
- [ ] **Step 3:** v2 tick固定20，时长必须为1000毫秒的整数倍且在10000..1800000；v2决策固定100，classic固定35/85及legacy地图。单挑rotation规范为0或1，四方为0..3；策略参数为无原型污染的有限PlainJSON。RNG使用32位整数算术，并提供`next(),int(max),exportState()`；键值规范化避免字符串拼接歧义。参数校验使用此任务的静态STRATEGY_IDS，避免依赖任务5才存在的行为注册表；classic仅允许其中原18个ID。
- [ ] **Step 4:** 验证同seed/stream/state序列相同，不同stream独立；暂停不推进Clock，结束后advance返回空数组；所有非法参数有稳定错误代码。
- [ ] **Step 5:** 提交 `feat: define versioned configs and integer simulation clock`。

## Task 3: 对称地图、事件与结算

**Files:** Create `engine/maps.js`、`engine/events.js`、`engine/rules.js`、`test/maps-rules-v2.test.js`。
**Interfaces:** Consumes MatchConfig、RNG；Produces `generateMap(config)`、`applyDueEvents(board,eventPlan,timeMs,appliedIds):PublicEvent[]`、`vpRate({area,playableCellCount,resourceValue,resourceTotal})`、总计划`resolveActions`。事件返回具体资源增删记录，owner修改仅在全部成功判定之后。

- [ ] **Step 1:** 写 `maps_are_symmetric_and_connected`，四模板各20种子检查所有资源可从各核心到达，旋转/镜像地形资源一致；`events_have_exact_values`断言standard资源价值总量48→60→96，migration为72且轮换仍72；`simultaneous_capture_preserves_old_snapshot`断言调换提案顺序结果相同、核心及blocked目标不可占。

```js
test('standard_resource_values_are_exact', () => {
  const {board,eventPlan} = generateMap(testConfig()); const ids = new Set();
  assert.equal([...board.resources].reduce((a,b)=>a+b,0), 48);
  applyDueEvents(board,eventPlan,3300,ids);
  assert.equal([...board.resources].reduce((a,b)=>a+b,0), 60);
  applyDueEvents(board,eventPlan,6200,ids);
  assert.equal([...board.resources].reduce((a,b)=>a+b,0), 96);
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/maps-rules-v2.test.js`，确认未实现行为失败。
- [ ] **Step 3:** 四方核心用(5,5)/(58,5)/(5,58)/(58,58)，单挑用(5,32)/(58,32)，3×3核心；生成对称通行模板和连通资源。事件阈值分别是duration×.33/.62/.82或迁移.25/.5/.75，在第一个到达阈值的20ms边界执行一次。保留基线概率公式、.12～.93限制及超频+.075。
- [ ] **Step 4:** 精确检查攻击机会计数不消费地图/事件RNG；同格冲突唯一胜者；VP公式在全图归一阵营时为10，资源总量0时只计面积，blocked不进入分母。
- [ ] **Step 5:** 提交 `feat: add symmetric maps and deterministic resource modes`。

## Task 4: 公共前沿、特征与预算

**Files:** Create `engine/frontier.js`、`agents/budget.js`、`agents/context.js`、`test/frontier-budget.test.js`。
**Interfaces:** Produces `FrontierIndex(board).applyChanges(changes)`、`FrontierIndex.options(seat):ActionOption[]`、`createBudget(profile):Budget`、`buildAgentView(snapshot,seat,options):AgentView`；Budget有`remaining,used,consume(kind,count=1):boolean`，kind=score/path/rollout，对应1/1/4单位。选项保留旧公共字段并增加通路距离、合法continuations，虚拟视图只覆盖假设占领。

- [ ] **Step 1:** 写 `incremental_frontier_equals_brute_force`，随机合法控制权变化后与穷举全部目标一致且无重复；`frontier_generation_does_not_consume_world_rng`检查RNG状态不变；`budget_costs_are_exact`断言standard初始8192，消费score(2)+rollout(3)后used=14。

```js
test('budget_costs_are_exact', () => {
  const b = createBudget('standard');
  assert.equal(b.remaining, 8192);
  b.consume('score',2); b.consume('rollout',3);
  assert.equal(b.used, 14); assert.equal(b.remaining, 8178);
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/frontier-budget.test.js`，确认失败原因对应未实现接口。
- [ ] **Step 3:** 增量更新变化格及四邻格；同目标来源按规范索引确定，候选稳定排序；资源路径采用真实可通行距离。所有策略同等获得公共比分和特征，标准模式不暴露未来资源位置。
- [ ] **Step 4:** 检查所有预算预设4096/8192/16384、耗尽不负数、未评分回退首个合法目标、空前沿返回null；虚拟占领不修改原棋盘。
- [ ] **Step 5:** 提交 `feat: expose complete public frontiers and deterministic budgets`。

## Task 5: 适配十八种策略与状态注册表

**Files:** Create `agents/base.js`、`agents/reactive.js`、`agents/spatial.js`、`agents/adaptive.js`、`agents/planning.js`、`agents/registry.js`、`agents/state.js`、`test/agents-v2.test.js`。
**Interfaces:** Consumes AgentView、Budget、RNG；Produces `createAgent(strategyId,context)`、`AGENT_REGISTRY`、Agent决策/反馈/终局/导出/导入五方法契约；注册条目含id/name/version/family/description/parameterSchema。统一`exportAgentState(agent,strategyId)`和`importAgentState(agent,state,strategyId)`拒绝不匹配版本及非法TypedArray长度。

- [ ] **Step 1:** 写 `all_eighteen_agents_use_public_inputs`，每个策略的输入和自身RNG相同就返回相同动作；`agent_state_round_trip`对ACO信息素、PID积分、Q表与pending、最强规划状态保存后下一次动作和RNG序列相同；`budget_exhaustion_is_deterministic`断言所有策略均采用已评分最优或首合法回退。

```js
test('ACO_state_round_trip_preserves_successful_path', () => {
  const ctx = () => ({participantId:'p0',seat:0,rng:createRng('state','p0'),size:4096,parameters:{},budgetProfile:'standard'});
  const a = createAgent('aco',ctx()), b = createAgent('aco',ctx());
  a.onResult({participantId:'p0',seat:0,move:{from:0,to:1,dir:[1,0]},success:true,previousOwner:-1,chance:.93,reward:5});
  b.importState(a.exportState());
  assert.deepEqual(b.exportState(), a.exportState());
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/agents-v2.test.js`，确认缺少新协议行为。
- [ ] **Step 3:** 按家族拆分并适配现有18策略，保留诚实命名和基本策略差异；所有打分/路径/虚拟行动通过公共Budget计数。经典版本不修改；v2版本分别标注2.0.0，state含schema、id、version和字段白名单。
- [ ] **Step 4:** 检查重复策略但不同participantId的自身RNG互不干扰，真实CPU耗时与Math.random不可参与选择；状态导入不得赋值函数、原型或未知字段。
- [ ] **Step 5:** 提交 `feat: adapt built-in strategies to the public v2 agent protocol`。

## Task 6: 组装引擎、计分账本与恢复

**Files:** Create `engine/match.js`、`engine/factory.js`、`test/engine-v2.test.js`。
**Interfaces:** Consumes前五任务接口；Produces总计划`createMatch(config)`与MatchEngine。通过`getInitialBoard()`提供初始棋盘副本；保存ledger顺序游标、每5秒最新运行检查点和每10秒棋盘检查点。captureCheckpoint同步调用任务2的规范摘要，hash输入去掉integrityHash本身；规范结果与存档状态均排除墙钟耗时，避免异步hash破坏同步接口。

- [ ] **Step 1:** 写 `advance_batch_does_not_change_result`，同配置advance(1)、advance(7)、advance(100)完整结果digest相同；`event_boundary_resume_is_exact`在3300/6200/8200/9980/10000ms附近保存恢复与连续运行一致；`vp_ledger_matches_score`断言每队areaVP+resourceVP之和与score误差≤1e-9。

```js
test('advance_batch_does_not_change_result', () => {
  const a = createMatch(testConfig()), b = createMatch(testConfig());
  a.advance(500); for (let i=0;i<5;i++) b.advance(100);
  assert.equal(resultDigest(a.getResult()), resultDigest(b.getResult()));
  assert.equal(a.getResult().timeMs, 10000);
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/engine-v2.test.js`，确认缺失引擎行为失败。
- [ ] **Step 3:** 严格按设计tick顺序积分、事件、同步选择、结算、统计、终局；10000ms新机会不发放，首次决策在100ms。`createMatch`按模式选择经典适配器或v2，完整前沿与策略状态保持独立。
- [ ] **Step 4:** 检查结束后不再增分、无非法动作、恢复校验版本与hash、读取ledger不会消费数据；随机化多种批大小结果仍相同。组合运行任务1～6所有测试，产生可独立使用的无界面引擎。
- [ ] **Step 5:** 提交 `feat: run deterministic v2 matches with exact checkpoints and VP ledgers`。
