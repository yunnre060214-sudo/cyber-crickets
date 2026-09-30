# Cyber Crickets 2.0 总体 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已确认的设计交付为可在线使用的 2.0 算法竞技平台。

**Architecture:** 先构建与经典版本隔离的确定性引擎，再接入策略与竞技场；赛事、回放和实验通过版本化账本及统一任务协议连接。每个里程碑均有可运行结果，最后集中完成静态构建、浏览器验收和 Pages 发布。

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

## 一、执行顺序与工作成果

采用四份子计划，连续任务编号 1～20。它们共享下面的契约；执行者必须读总计划、当前子计划和设计。实施方式尚待用户选择，当前文件只形成实施任务，不表示产品代码已完成。

| 顺序 | 子计划 | 任务 | 可独立验证的成果 |
| --- | --- | --- | --- |
| 1 | [引擎基础](2026-09-30-cyber-crickets-v2-01-engine.md) | 1～6 | 基线兼容适配器和可运行的 v2 无界面引擎 |
| 2 | [策略与竞技场](2026-09-30-cyber-crickets-v2-02-arena.md) | 7～10 | 21 种策略、三种模式、四种新地图及完整单局界面 |
| 3 | [记录与赛事](2026-09-30-cyber-crickets-v2-03-records.md) | 11～15 | 可恢复存档、回放、导入导出及六种可变规模赛事 |
| 4 | [实验与发布](2026-09-30-cyber-crickets-v2-04-release.md) | 16～20 | 浏览器实验室、版本化产物、完整验收与线上发布 |

执行前使用 using-git-worktrees 确保隔离工作区；工作分支继续使用 `v2/platform-design-20260930`，不得覆盖其他工作。首次执行检查最新 main；如果 main 已变化，比较差异后合入，不以强制推送丢弃更新。发布按既有任务授权和完整流程执行。

## 二、文件归属

| 路径 | 责任 | 任务 |
| --- | --- | --- |
| `legacy/v1/{match,agents,rules}.js`、`legacy/adapter.js` | 冻结经典代码与统一接口 | 1 |
| `engine/hash.js` | 同步规范串与存档完整性摘要 | 1 |
| `engine/{config,clock,rng,types}.js` | 参数、整数时间、随机流、JSDoc 契约 | 2 |
| `engine/{maps,events,rules}.js` | 地图、公开事件和结算 | 3 |
| `engine/frontier.js`、`agents/{budget,context}.js` | 完整前沿、同等输入、计数预算 | 4 |
| `agents/{registry,state,base,reactive,spatial,adaptive,planning}.js` | 18 种策略适配与序列化 | 5 |
| `engine/{match,factory}.js` | 引擎协调、检查点和模式选择 | 6 |
| `agents/{pathfinder,boundary,ucb}.js` | 三个新算法 | 7 |
| `workers/{protocol,match-worker,queue-worker}.js`、`runtime/{match-client,job-queue}.js` | 后台运行、队列、控制协议 | 8 |
| `ui/{router,arena,settings,store}.js`、`css/{tokens,base,layout,arena,mobile}.css` | 工作区、设置、单局控件 | 9 |
| `ui/{map-renderer,chart,scoreboard,agent-book,decision-trace}.js` | 图层、曲线、图鉴与决策说明 | 10 |
| `replay/{ledger,codec,player,checkpoint}.js` | 增量回放与完整恢复数据 | 11 |
| `storage/{database,records,migrate}.js` | IndexedDB、原子写入、旧记录迁移 | 12 |
| `ui/{replay,export}.js`、`export/{model,html,markdown,download,import}.js` | 回放工作区、三种报告和导入 | 13 |
| `competition/{formats,fixture,tournament,standings}.js` | 六种赛制和多地图对阵 | 14 |
| `ui/competition.js`、`runtime/competition-jobs.js` | 赛事任务、进度、恢复和赛果回放 | 15 |
| `analysis/{experiment,statistics,rating}.js` | 实验任务、种子聚合、bootstrap 和 Elo | 16 |
| `analysis/contributions.js` | VP贡献、资源保有、领先与阶段分析 | 11 |
| `ui/experiment.js`、`runtime/experiment-jobs.js` | 实验室与数据保存 | 17 |
| `scripts/{build,verify-dist}.mjs`、工作流、README | 内容版本、仅运行产物与发布文档 | 18 |
| `test/browser/`、`scripts/acceptance.mjs` | 综合行为、尺寸和兼容验收 | 19 |
| `docs/releases/2.0.0.md`、发布恢复点 | 实际验证与上线结果 | 20 |

现有 `app.js`、`index.html`、`styles.css` 与 UI 模块逐步接入新入口；每次切换同时改实际引用。七个 `app-*.js` 副本仅在任务 18 的引用检查通过后删除。旧测试保留，确因新接口变化的测试更新其行为断言，不用删除测试隐藏回归。

## 三、共享契约

以下为 JSDoc 类型与运行时形状，名称必须一致；类型全部在任务 2 的 `engine/types.js` 定义。

```text
MatchConfig:
  schemaVersion:3, productVersion:"2.0.0", engineVersion:"2.0.0"
  ruleVersion:"v2-standard"|"v2-migration"|"v1-eff46735"
  seed:string, mode:"standard"|"migration"|"classic"
  mapPreset:"plain"|"basin"|"canyon"|"ring"|"legacy"
  teamCount:2|4, rotation:0..3, durationMs:integer 10000..1800000
  tickMs:20|35, decisionIntervalMs:100|85
  budgetProfile:"fast"|"standard"|"deep"
  entrants:[{participantId:string,strategyId:string,strategyVersion:string,parameters:PlainJSON}]

Board:
  width:64,height:64,owner:Int8Array,terrain:Uint8Array
  resources:Uint8Array,core:Int8Array,blocked:Uint8Array
  各数组长4096；owner/core为-1或有效阵营序号，terrain为1..3，resources为0|1|3
  blocked长4096且值0|1；核心格blocked=0
  playableCellCount:number,spawns:[x,y][]

PublicSnapshot:
  matchId:string,tick:number,timeMs:number,finished:boolean,boardRevision:number
  board:Board,teams:TeamSnapshot[],events:PublicEvent[],publicDecisionTrace:DecisionTrace[]

TeamSnapshot:
  participantId,strategyId,strategyVersion,seat,color,score,territory,resources,vpRate
  thought,thinkMs,budgetUsed
  score/vpRate为有限数；thinkMs仅性能信息，不进入规范结果摘要

Action:
  from:number,to:number,explain:DecisionTrace
DecisionTrace:
  method,features,chosenScore,alternatives,budgetUsed
  alternatives最多3项，仅包含已实际评估的公开候选

TickRecord:
  seq:number,tick:number,timeMs:number,elapsedMs:number,resourceChanges:Change[]
  proposals:Proposal[],results:ActionResult[],ownershipChanges:Change[]
  scoreDeltas:{participantId,areaVP,resourceVP}[],events:PublicEvent[]

AgentView:
  id:seat,participantId,time,duration,remaining,progress,width,height
  board:Board的只读副本,options:ActionOption[],opponents:TeamSnapshot[]
  score,vpRate,share,territory,resources,resourceShare,resourceTotal,cellCount
  rank,scoreGap,leadMargin,leaderScore,leaderVpRate,leaderShare,leaderResourceShare,localPressure
ActionOption:
  from,to,dir,owner,enemy,ownN,enemyN,terrain,resource
  distOwnCore,distRivalCore,nearestResourceDist,resourcePull,enemyPressure
  protectedResourceValue,continuations:ActionOption[]
ActionResult:
  participantId,seat,move:{from,to,dir},success,previousOwner,chance,reward

Checkpoint:
  schemaVersion:3,config:MatchConfig,tick,timeMs,board,scores
  rngStates,agentStates,eventState,ledgerCursor,integrityHash

CanonicalResult:
  config,finished:true,timeMs,board,teams,events,ledger,integrityHash
  不包含exportedAt、thinkMs、播放速度与其他机器相关数据

ReplayPackage:
  format:"cyber-crickets.replay",formatVersion:3
  config,initialBoard,tickRecords,boardCheckpoints,summary,integrityHash

StoredRecord:
  id,type:"match"|"competition"|"experiment",schemaVersion:3
  revision:number,updatedAt,index,payloadRefs
Job:
  jobId,kind:"fixture-leg"|"experiment-match",config:MatchConfig
  status:"pending"|"running"|"completed"|"cancelled",result?
WorkerMessage:
  protocolVersion:1,requestId,matchId?,jobId?,type,payload
  入站type:create|start|pause|resume|setSpeed|capture|dispose
  出站type:ack|snapshot|ledger|progress|result|error
```

公开快照与导出均复制数组或传递复制后的缓冲区，不能将引擎唯一缓冲区转移出去。算法输入不含 `rngStates`、未来事件位置或其他策略状态；迁移模式已公开的资源轮换计划除外。

裸引擎的matchId使用配置摘要，运行层为每次开始新局分配独立randomUUID，并在消息和记录元数据中使用它。运行ID不进入RNG派生或CanonicalResult；因此同配置重开仍有不同历史记录，也能拒绝上一局的迟到消息。

固定 API：

```text
createMatchConfig(input:Partial<MatchConfig>):MatchConfig
createRng(seed:string,stream:string,state?:RngState):Rng
randomFor(seed:string,key:{stream,tick,participantId?,target?}):number
canonicalSerialize(data):string
canonicalHash(data):string
generateMap(config:MatchConfig):{board:Board,eventPlan:EventPlan}
resolveActions(board:Board,proposals:Proposal[],options:{seed,tick,overclock}):ActionResult[]
createAgent(strategyId:string,context:{participantId,seat,rng,size,parameters,budgetProfile}):Agent
Agent.selectAction(view:AgentView,budget:Budget):Action|null
Agent.onResult(result:ActionResult):void
Agent.endMatch(finalView:AgentView):void
Agent.exportState():PlainJSON
Agent.importState(state:PlainJSON):void

createMatch(config:MatchConfig):MatchEngine
MatchEngine.tickMs:number
MatchEngine.advance(tickCount:number):TickRecord[]
MatchEngine.getSnapshot():PublicSnapshot
MatchEngine.getInitialBoard():Board
MatchEngine.getResult():CanonicalResult  // 未结束抛MATCH_NOT_FINISHED
MatchEngine.captureCheckpoint():Checkpoint
MatchEngine.restore(checkpoint:Checkpoint):void
MatchEngine.readLedger(cursor:number):{records:TickRecord[],nextCursor:number}

createMatchClient(config,options:{transport?}):MatchClient
MatchClient.start(),pause(),resume(),setSpeed(number),dispose():Promise<void>
MatchClient.snapshot():Promise<PublicSnapshot>
MatchClient.capture():Promise<{checkpoint,ledger,initialBoard}>
MatchClient.subscribe(listener):()=>void

RecordStore.put(record,{expectedRevision}):Promise<StoredRecord>
RecordStore.get(id):Promise<StoredRecord|null>
RecordStore.list({type,limit,cursor?}):Promise<{items,nextCursor}>
RecordStore.putTaskResult(recordId,jobId,result):Promise<{inserted:boolean}>
RecordStore.putLedgerChunk(matchId,cursor,records):Promise<void>

planExperiment(config):{orderedTasks:Job[],seedGroups:SeedGroup[]}
aggregateExperiment(results,config):ExperimentSummary
```

经典适配器仅变更加载路径及外围接口，原三份源码冻结。其 RNG 恢复可使用原始 seed 加构造完成后抽样次数作为精确状态表示，适配器包装实例 RNG 计数，不改原算法。所有原策略状态字段以显式白名单和 TypedArray 标签保存；恢复时新建同一基线引擎、推进相同 RNG 抽样次数并恢复实例数据。经典独立做完整恢复等价性测试。

### 经典基准值

`test/support/classic-digest.js` 将对象按如下顺序构造并对 JSON.stringify 的 UTF-8 求 SHA-256：
owner、terrain、resources、core、spawns、teams、timeline、events、decisions。棋盘数组展开；teams字段顺序为 id、strategy、score、captures、resources、territory、lastMove；decisions保留原顺序和字段，删除 thinkMs。这些预期值来自未修改的已核查基线，不能用新适配器重新生成来掩盖不兼容。

| 样本 | 配置 | 决策数 | SHA-256 |
| --- | --- | ---: | --- |
| four | seed=legacy-four-2.0, rotation=2, 10秒, aco/strongest/qlearn/voronoi | 380 | `72033b2121bec5439a738f11c3da7947a1aded3b0d3f3fa64c58a75735f5870a` |
| duel | seed=legacy-duel-2.0, rotation=0, 10秒, strongest/potential, agentKeys=entry-a/entry-b | 190 | `1bf01122fc2bd3bef921285abefcd347b80f717a30d9885f1c360738a5a2d5f5` |
| sixty | seed=20260927, rotation=2, 60秒, aco/mcts/qlearn/voronoi | 2288 | `c21877d6a3a4977ccf444383b12847b563adff52402daf6a641dfceff4eb7f95` |

## 四、检查与提交约定

每个任务都先运行其新行为测试，确认失败原因是缺少目标行为，再实现并运行同一测试；如果已有行为已经满足，记录通过证据并保留验证，不能伪造一次失败。相关旧测试通过后只提交该任务范围。

普通单元检查使用 `node --test --test-isolation=none test/<文件>.test.js`。当前环境对测试中嵌套 Node 子进程报 EPERM，语法检查从 shell 单独运行；在 GitHub Actions 仍完整执行 `npm test`。不得因为当前环境限制去删除原测试。

每个任务的提交步骤是：`git add` 本任务列出的实际文件，检查 staged diff，再使用列出的 commit message 提交。环境无法直接 git push 时，通过 GitHub Git Data API 创建基于当前树的提交并非强制更新分支；核查远端树包含所有运行模块，不用只推一个入口。

## 五、验收覆盖表

| 设计要求 | 任务 |
| --- | --- |
| 经典、旧 URL、旧赛事兼容 | 1、2、6、9、12、19 |
| 整数时钟、事件、成功率、VP和公平性 | 2～6、8、19 |
| 21个策略、图鉴与公开解释 | 5、7、10、16 |
| 地图、三模式与单挑/四方 | 3、6、9 |
| 存档、账本、回放、真实贡献分析 | 6、11～13 |
| 六赛制、可变人数、多地图换边与队列恢复 | 14、15 |
| 种子聚合、2000次bootstrap、本地Elo与实验恢复 | 16、17 |
| 手机、曲线、设置与信息层级 | 9、10、13、15、17、19 |
| 紧凑报告、一致导出、压缩回退与安全导入 | 11～13、19 |
| 版本资源、只运行产物、README与线上验收 | 18～20 |

当前没有为数据、存档或队列留下未指定的生产接口。实际实施发现接口必须变更时，同步修改类型、调用方、测试和此计划，继续保持已确认的产品范围。
