# Cyber Crickets 2.0 记录与赛事 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付精确回放、可恢复记录、安全导入导出和六种可变规模赛事。

**Architecture:** 账本与检查点是记录的事实来源，IndexedDB按事务保存任务和分块数据，回放只应用增量。赛事先生成稳定单局任务再交给通用队列，赛果用唯一ID原子写入，使刷新或重复消息不会重复计分。

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

## Task 11: 回放数据、编解码与精确贡献

**Files:** Create `replay/ledger.js`、`replay/codec.js`、`replay/player.js`、`replay/checkpoint.js`、`analysis/contributions.js`、`test/replay.test.js`。
**Interfaces:** Consumes TickRecord、Checkpoint、CanonicalResult；Produces `encodeBoard(board):PlainJSON`、`decodeBoard(data):Board`、`buildReplayPackage(capture):ReplayPackage`、`ReplayPlayer(pkg).seek(timeMs):PublicSnapshot`、`summarizeMatch(pkg):MatchSummary`、`validateCheckpoint(data):Checkpoint`。MatchSummary包含areaVP/resourceVP、阶段增分、资源保有时长、翻色/反抢、领先易手及精选决策。

- [ ] **Step 1:** 写 `seek_matches_original_board_and_score`，对0/3280/3300/6200/8200/9980/10000ms与原引擎快照逐数组比较；`replay_does_not_call_agents_or_rng`用抛错代理验证；`contributions_sum_exactly`断言areaVP+resourceVP=score，事件前区间仍属旧阶段；保存/恢复检查点hash与版本错误必须拒绝。

```js
test('checkpoint_rejects_unknown_schema', () => {
  const m=createMatch(testConfig()); m.advance(165);
  const saved=m.captureCheckpoint();
  assert.throws(()=>validateCheckpoint({...saved,schemaVersion:999}),/UNSUPPORTED_SCHEMA/);
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/replay.test.js`，确认缺少数据编解码和回放行为。
- [ ] **Step 3:** 将TypedArray转换为带类型标签的有界数据；每10秒棋盘检查点与逐tick资源/owner/score增量组合，二分定位后应用。反抢定义为本方曾控制且被敌方翻色后重新取得；领先易手忽略零分平局，只记录唯一领先者变化，说明均依据实际账本。
- [ ] **Step 4:** 检查迁移节点消失时停止其保有计时，结束前后seek稳定，经典最后不足35ms区间使用实际elapsedMs，ReplayPlayer任意seek不会改变包或当前比赛。
- [ ] **Step 5:** 提交 `feat: add exact ledger replay and control-contribution analysis`。

## Task 12: 原子存储、分块记录与旧数据迁移

**Files:** Create `storage/database.js`、`storage/records.js`、`storage/migrate.js`、`test/storage.test.js`、`test/support/memory-backend.js`。
**Interfaces:** Produces `openDatabase({name="cyber-crickets-v2"}):Promise<RecordBackend>`、`createRecordStore({backend}):RecordStore`、`migrateLegacyTournaments(storage,store):Promise<MigrationSummary>`。RecordBackend有`transaction(storeNames,mode,callback)`、get/put/delete/list操作；MemoryBackend只供测试。旧记录保存rawLegacy，未完赛标记resumeMode=classic，由任务15继续。

- [ ] **Step 1:** 写 `duplicate_task_commit_is_idempotent`，同jobId第二次返回inserted=false且计分不增加；`stale_revision_does_not_overwrite`，两个写入者同revision只有一次成功；`migration_failure_keeps_old_records`，模拟写入失败仍保留旧localStorage字符串、再次迁移不重复创建。

```js
test('duplicate_task_commit_is_idempotent', async () => {
  const store=createRecordStore({backend:new MemoryBackend()});
  await store.put({id:'e',type:'experiment',schemaVersion:3,revision:0,updatedAt:0,index:{},payloadRefs:[]},{expectedRevision:0});
  assert.equal((await store.putTaskResult('e','j',{winner:'p0'})).inserted,true);
  assert.equal((await store.putTaskResult('e','j',{winner:'p0'})).inserted,false);
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/storage.test.js`，确认缺少事务与迁移行为。
- [ ] **Step 3:** 创建records/ledgerChunks/checkpoints/taskResults四object store，使用事务同时更新任务结果和索引revision。账本每1024条一块，最后不足一块也落盘；autosave每5模拟秒覆盖本局最新检查点。旧key为cyber-crickets-tournaments-v1，使用legacy:<原id>稳定ID，验证有效记录后迁移，完成赛事只读。
- [ ] **Step 4:** 检查中途失败事务回滚、额度错误显示未保存且可导出、chunks按cursor连续、list游标稳定；迁移成功后保留原key并写迁移标记，不自动删用户历史。
- [ ] **Step 5:** 提交 `feat: persist versioned records with atomic task deduplication`。

## Task 13: 回放工作区与三种报告

**Files:** Create `ui/replay.js`、`export/import.js`；Modify `ui/export.js`、`export/model.js`、`export/html.js`、`export/markdown.js`、`export/download.js`；Test `test/exports-v3.test.js`、`test/replay-ui.test.js`。
**Interfaces:** Consumes ReplayPlayer、RecordStore和summarizeMatch；Produces `createReplayWorkspace({root,store})`、`buildReportModel(pkg):ReportModel`、`createMatchExport(capture,format):Promise<ExportFile>`、`importPackage(file,{store}):Promise<ImportSummary>`。format为html/markdown/data；文件支持match/competition/experiment版本3及旧match-log格式版本2的有限迁移。

- [ ] **Step 1:** 写 `running_export_is_frozen_at_capture`，压缩等待期间比赛继续，导出只含捕获时点；`compressed_import_limits_and_rollback`验证截断gzip、未知版本、数组长4095、NaN、重复participantId和超限流均拒绝且无半记录；`old_logs_are_not_resumable`旧JSON仅迁移真实统计/终局棋盘，resume=false；`offline_html_needs_no_external_resource`断言报告没有外部脚本/样式/图片依赖。

```js
test('unknown_format_writes_no_record', async () => {
  let writes=0; const store={put(){writes++;throw new Error('unexpected write');}};
  const file=new File([JSON.stringify({format:'cyber-crickets.replay',formatVersion:999})],'bad.json',{type:'application/json'});
  await assert.rejects(()=>importPackage(file,{store}),/UNSUPPORTED_FORMAT/);
  assert.equal(writes,0);
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/exports-v3.test.js test/replay-ui.test.js`，确认新回放与导入行为失败。
- [ ] **Step 3:** 新增时间轴播放、逐tick、事件/领先跳转、图层与保存/导入入口。完整导出获取一次capture后不再读取live对象；gzip不可用或抛错时回退JSON。限制压缩输入32MiB、解压/普通JSON128MiB，流式计数超限取消；先验证整包再事务写入。
- [ ] **Step 4:** 检查seed/name/thought中的HTML被转义；Markdown开头包含目标、规则、VP/reward区别和策略输入；报告汇总全部动作，每算法最多6条精选、单个trace最多3备选；已结束与暂停的领先者措辞正确。
- [ ] **Step 5:** 提交 `feat: deliver replay workspace portable reports and validated imports`。

## Task 14: 通用赛事模型与多地图对阵

**Files:** Create `competition/formats.js`、`competition/fixture.js`、`competition/tournament.js`、`competition/standings.js`、`competition/legacy.js`、`legacy/v1/tournament.js`、`test/competition-v2.test.js`；Modify `engine/types.js`、`test/support/factories.js`。
**Interfaces:** Produces `createTournament(config):Tournament`、`fixtureJobs(fixture,config):Job[]`、`aggregateFixture(fixture,legResults):FixtureResult`、`Tournament.applyFixtureResult(id,result)`、`nextJobs()`、`standings(group?)`、`toJSON()`、`Tournament.fromJSON(data)`、`ClassicTournamentAdapter(rawLegacy)`。TournamentConfig定义format、seed、entrants（总计划Entrant对象数组）、mode、mapPreset、durationMs、mapCount=1|3|5、swissRounds和id/name；toJSON返回`{schemaVersion:3,config,rounds,status}`，rounds含fixtures。测试辅助`testTournamentConfig(overrides={})`默认四个bfs/dfs/greedy/random参赛者，单循环、10000ms、standard/plain、mapCount1、seed=test-tournament。

- [ ] **Step 1:** 写 `round_robin_counts_all_pairs`，4/8/16人单循环对阵6/28/120、双循环12/56/240；`fixture_swaps_each_map`断言3地图为6局，配对seed一致且身份随机流不变；`groups_and_knockout_have_correct_advancers`检查8/16人每组4、前二晋级；`swiss_prefers_no_repeat_lexicographically`断言存在无重复配对时优先选择它。

```js
test('four_player_round_robin_has_six_fixtures', () => {
  const t=createTournament(testTournamentConfig());
  assert.equal(t.toJSON().rounds.flatMap(r=>r.fixtures).length,6);
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/competition-v2.test.js`，确认固定八人模型无法满足。
- [ ] **Step 3:** 参数化六赛制；循环/淘汰/瑞士允许4/8/16，小组相关允许8/16；瑞士轮1..人数-1。配对采用位掩码DP，比较重复数、总积分差、种子距离、稳定ID的字典序，不能用非支配权重近似优先级。fixture+map+leg构成唯一jobId，map seed从赛事seed和稳定fixture/map索引派生。
- [ ] **Step 4:** 验证胜3平1负0、瑞士Buchholz、淘汰同分先加赛一张换边地图再使用公开决胜规则；apply相同结果幂等，冲突结果拒绝，JSON恢复不重排种子；旧赛事继续使用冻结旧模型、旧两局与旧平局决胜逻辑。
- [ ] **Step 5:** 提交 `feat: generalize six tournament formats and multi-map fixtures`。

## Task 15: 赛事工作区、进度与恢复

**Files:** Create `ui/competition.js`、`runtime/competition-jobs.js`、`test/competition-jobs.test.js`、`test/competition-ui-v2.test.js`；Modify `workers/queue-worker.js`、`css/tournament.css`。
**Interfaces:** Consumes Tournament、JobQueue、RecordStore；Produces `createCompetitionController({store,queue})`，方法`create(config),run(id),pause(id),resume(id),cancelPending(id),subscribe(listener)`；`createCompetitionWorkspace({root,controller,onOpenReplay})`。每完成单局立即保存ReplayPackage、结果和任务标识。

- [ ] **Step 1:** 写 `refresh_resumes_without_counting_twice`，完成两局后恢复，仅执行剩余job；`concurrent_message_updates_preserve_results`，重复/乱序回调不能重复计分；`legacy_unfinished_competition_continues_classic`，旧完整赛果保持且下轮使用v1；`fixture_opens_actual_replay`，赛程入口对应已保存matchId。

```js
test('legacy_jobs_preserve_classic_rule_version', () => {
  const t=new LegacyTournament({seed:'old',format:'round_robin',duration:10,entrants:['bfs','dfs','greedy','random','aco','voronoi','potential','pid']});
  const old=new ClassicTournamentAdapter(t.toJSON());
  assert.equal(old.nextJobs()[0].config.ruleVersion,'v1-eff46735');
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/competition-jobs.test.js test/competition-ui-v2.test.js`，确认新工作区和持久任务行为失败。
- [ ] **Step 3:** 创建赛事配置/总览/赛程/积分/报告，显示当前map/leg进度与预计总局数；单局结果先原子putTaskResult再推进赛程。暂停不丢已结算结果，取消只撤未运行任务；读取最新revision处理另一个标签页写入，不覆盖它的成果。
- [ ] **Step 4:** 检查关闭/重开工作区、刷新、存储失败、取消后继续、完赛冠军/小组无总冠军措辞；筛选算法及每局回放有效，手机不依赖遮挡战场的大抽屉。
- [ ] **Step 5:** 提交 `feat: add persistent tournament workspace with per-leg replay and progress`。
