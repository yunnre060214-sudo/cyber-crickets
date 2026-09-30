# Cyber Crickets 2.0 策略与竞技场 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付21种可观察策略和手机、桌面均可用的完整竞技场。

**Architecture:** 新策略通过同一公开视图与预算接口注册，单局和后台队列通过版本化消息调用真实引擎。工作区只持有公开快照与UI状态，设置和播放参数分别管理，绘图按数据变化更新。

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

## Task 7: 三个新算法与图鉴元数据

**Files:** Create `agents/pathfinder.js`、`agents/boundary.js`、`agents/ucb.js`、`test/new-agents.test.js`；Modify `agents/registry.js`。
**Interfaces:** Consumes AgentView、Budget及Agent状态协议；Produces注册ID `pathfinder`、`boundary`、`ucb`，使总数为21；路径模块提供`findPath(board,from,to,{seat,budget}):{path:number[],cost:number,expanded:number}|null`。策略实现都能export/importState并接受相同公开输入。

- [ ] **Step 1:** 写 `astar_uses_reachable_detour`：直线路径有blocked格时选真实绕行路径的第一步，展开计数>0；`boundary_prefers_supported_countercapture`：资源收益相近时补洞与护点优于孤立前沿；`ucb_initializes_then_uses_real_counts`：四宏观臂按expand/attack/resource/fortify依次首次采样，之后断言UCB1公式和n/mean更新。

```js
test('astar_uses_reachable_detour', () => {
  const {board} = generateMap(testConfig());
  board.terrain.fill(1); board.blocked.fill(0); board.owner.fill(-1); board.core.fill(-1);
  board.blocked[326] = 1;
  const r = findPath(board,325,327,{seat:0,budget:createBudget('standard')});
  assert.equal(r.cost,4); assert.equal(r.path.length,5);
  assert.equal(r.path.includes(326),false); assert.ok(r.expanded>0);
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/new-agents.test.js`，确认缺少实际算法行为失败。
- [ ] **Step 3:** A*在view.board四邻通行图执行，边成本=目标地形+(敌占格?2:0)，启发式为曼哈顿距离；预算限制展开量。边界调度器使用公开边界变化、支援和资源保有收益，避免复制最强两步Beam。UCB1用mean+sqrt(2*ln(total)/count)，下一次公开vpRate与上次之差作宏观反馈；终局反馈结清pending。
- [ ] **Step 4:** 检查每种算法在同输入下动作与state相同，保存恢复等价，无路径或预算耗尽有合法回退；21注册名/version/family/description均完整。
- [ ] **Step 5:** 提交 `feat: add A-star routing boundary scheduling and UCB strategies`。

## Task 8: 单局Worker与通用任务队列

**Files:** Create `workers/protocol.js`、`workers/match-worker.js`、`workers/queue-worker.js`、`runtime/match-client.js`、`runtime/job-queue.js`、`test/runtime.test.js`。
**Interfaces:** Consumes createMatch；Produces总计划MatchClient、WorkerMessage和`JobQueue({execute,onProgress,onResult,concurrency=1})`，方法`enqueue(jobs),pause(),resume(),cancel(jobId),dispose()`；`execute(job,controls):Promise<CanonicalResult>`。Worker导出`createMatchWorkerService({emit,schedule,now})`和`createQueueWorkerService({emit,schedule,now})`，返回`{handle(message):Promise<void>,dispose():void}`供无DOM测试，浏览器入口再绑定self。

- [ ] **Step 1:** 写 `speed_and_pause_do_not_change_result`，0.25/1/2/20倍与暂停后恢复的CanonicalResult相同；`stale_match_message_is_ignored`，旧matchId/requestId不能替换新快照；`queue_pause_cancel_and_duplicate_delivery`，暂停不开始下一Job，取消待处理Job不执行，单个Job只交付一次。

```js
test('paused_queue_does_not_start_pending_job', async () => {
  const calls=[]; const q=new JobQueue({execute:async j=>{calls.push(j.jobId);return {};},onProgress:()=>{},onResult:()=>{}});
  q.pause(); q.enqueue([{jobId:'one',kind:'experiment-match',config:testConfig(),status:'pending'}]);
  await Promise.resolve(); assert.equal(calls.length,0); q.dispose();
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/runtime.test.js`，确认当前不存在控制协议行为。
- [ ] **Step 3:** 真实模拟按完整tick分批处理，单批以约8ms墙钟为让出目标，墙钟只影响批大小；暂停在tick边界应答。实例缓冲区不转移出去，Worker只发送复制快照、进度及账本块；无Worker时协作式运行同引擎，队列默认并发1，桌面可选2。
- [ ] **Step 4:** 用可注入调度器改变批大小和墙钟轨迹，验证结果不变；同策略不同participantId不会合并；队列暂停与页面隐藏后恢复保留任务和游标。隐藏页面时单局自动暂停，返回显示已暂停并可手动继续，批量任务由独立队列状态控制。
- [ ] **Step 5:** 提交 `feat: run matches and resumable jobs through versioned worker clients`。

## Task 9: 工作区、设置与单局流程

**Files:** Create `ui/router.js`、`ui/arena.js`、`ui/store.js`、`css/tokens.css`、`css/base.css`、`css/arena.css`；Modify `app.js`、`index.html`、`styles.css`、`ui/settings.js`、`css/layout.css`、`css/mobile.css`；Test `test/arena-ui.test.js`。
**Interfaces:** Consumes MatchClient；Produces `createRouter({root,routes}).navigate(route)`、`createArena({root,clientFactory,store})`、`decodeMatchQuery(search):{configInput,speed,route}`、`encodeMatchQuery(config,speed):string`、`ArenaStore`的activeConfig/nextConfig/status/snapshot。routes固定arena/competition/replay/experiment/agents。

- [ ] **Step 1:** 写 `old_config_urls_select_classic`：带旧agents/duration/rotation且没有mode/map的URL进入classic，空URL默认standard/plain；`editing_next_config_preserves_active_match`断言运行中改时长/地图/阵容不改变已冻结config；`settings_expand_in_document_flow`用DOM行为断言展开/收起状态和按钮仍可访问。

```js
test('old_config_urls_select_classic', () => {
  const old=decodeMatchQuery('?seed=A&agents=aco,minimax,qlearn,voronoi&duration=120&rotation=1');
  assert.equal(old.configInput.mode,'classic');
  assert.equal(decodeMatchQuery('').configInput.mode,'standard');
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/arena-ui.test.js`，确认目标工作区与设置流程失败。
- [ ] **Step 3:** 创建五工作区导航、单挑/四方、三模式、四新模板、时长和倍速控件；classic锁定legacy地图与18策略。设置控制的可访问名称固定为“比赛设置”和“收起设置”。快捷时长60/90/120/180，自定义10..1800整数，速度0.25..20且步进0.25；非法输入显示原因并保留上次有效设置。下局配置显式开新局时生效，分享URL记录该局冻结配置。
- [ ] **Step 4:** 检查开始、暂停、继续、同种子再开、生成新地图、结算及工作区返回；设置展开推开下面内容，44px触摸高度，焦点返回正确；旧默认阵容链接的经典黄金结果不变。
- [ ] **Step 5:** 提交 `feat: add the v2 arena workspace and immutable next-match settings`。

## Task 10: 地图图层、真实曲线与算法说明

**Files:** Create `ui/agent-book.js`、`ui/decision-trace.js`；Modify `ui/map-renderer.js`、`ui/chart.js`、`ui/scoreboard.js`、`ui/report.js`；Test `test/visual-models.test.js`。
**Interfaces:** Consumes PublicSnapshot、TickRecord及注册元数据；Produces `renderArenaMap({canvas,snapshot,layers,selectedParticipant})`、`computeChartScale({durationMs,teamCount,values,previousMax}):number`、`buildChartSeries(records,metric)`、`renderAgentBook(root,registry,examples)`、`renderDecisionTrace(root,trace)`。图层包括territory/resources/terrain/path/targets。

- [ ] **Step 1:** 写 `vp_axis_never_clips`：120秒四方初始300，出现350时升至500，之后值下降仍500；单挑初始600；`chart_uses_actual_time`断言不等间隔采样按timeMs定位；`trace_is_observation_not_fabricated_causality`断言只渲染实际评分的最多3备选，输入文本不变成HTML。

```js
test('vp_axis_never_clips', () => {
  assert.equal(computeChartScale({durationMs:120000,teamCount:4,values:[0],previousMax:0}),300);
  assert.equal(computeChartScale({durationMs:120000,teamCount:4,values:[350],previousMax:300}),500);
  assert.equal(computeChartScale({durationMs:120000,teamCount:4,values:[200],previousMax:500}),500);
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/visual-models.test.js`，确认旧曲线裁剪及新图层行为不能满足。
- [ ] **Step 3:** 实现缓存地形和脏格更新，按快照revision刷新；曲线初始上限保留2.5×秒数/5×秒数，超过后用1/2/5刻度向上扩展且不回缩。图例是阵营·算法名，预算/耗时/公开策略说明分别列出，局势估计保持明确标签。
- [ ] **Step 4:** 检查三模式下资源、blocked、核心和阵营可区分，路径确为所选策略实际产生；只有快照变化才更新榜单DOM，图鉴数量21且经典18范围正确。
- [ ] **Step 5:** 提交 `feat: add accurate charts map layers and inspectable agent decisions`。
