# Cyber Crickets 2.0 实验与发布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可复现的浏览器实验室和经过完整线上验收的2.0发布。

**Architecture:** 统计以独立地图种子为单位聚合，实验任务复用同一引擎与持久队列。构建将完整运行模块放入同一内容版本目录，CI检查后发布到既有Pages路径，最后核对真实线上产物与实际使用流程。

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

## Task 16: 实验计划与统计模型

**Files:** Create `analysis/experiment.js`、`analysis/statistics.js`、`analysis/rating.js`、`test/experiment-model.test.js`；Modify `engine/types.js`、`test/support/factories.js`。
**Interfaces:** Produces `planExperiment(config)`、`aggregateExperiment(results,config)`、`bootstrapInterval(seedValues,{iterations=2000,seed}):{low,high,iterations}|null`（少于8种子返回null）、`calculateElo(pairedResults,{initial=1000,k=24})`。ExperimentConfig定义mode、mapPresets、durationsMs、rosters（每个为Entrant数组）、seedList、teamCount、budgetProfile及id/name；任务ID与种子分组由配置规范串确定。测试辅助`testExperimentConfig(overrides={})`默认8个独立seed、standard/plain、10000ms、四方单阵容random/greedy/turtle/strongest、standard预算。

- [ ] **Step 1:** 写 `task_counts_include_all_rotations`，单挑8种子×4地图×2时长为128局，四方8种子×1地图×1时长×2阵容为64局；`confidence_uses_seed_groups`同seed四轮换只计1独立样本，7种子无CI、8种子可用；`bootstrap_and_elo_are_order_stable`断言重排回调后结果相同，bootstrap固定2000次，Elo总分守恒。

```js
test('confidence_uses_at_least_eight_seed_groups', () => {
  assert.equal(bootstrapInterval(Array(7).fill(1),{iterations:2000,seed:'ci'}),null);
  const ci=bootstrapInterval(Array(8).fill(1),{iterations:2000,seed:'ci'});
  assert.equal(ci.low,1); assert.equal(ci.high,1); assert.equal(ci.iterations,2000);
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/experiment-model.test.js`，确认批量聚合与评分行为缺失。
- [ ] **Step 3:** 按独立seed先聚合同地图换边/轮换，再bootstrap均值；区间取排序后2.5%/97.5%经验分位。少于8种子只显示描述统计，不能把局数当种子数。Elo只对单挑的同地图换边双局聚合结果更新，初值1000、K24；按计划稳定比较ID顺序，四方和局势估计不参与。
- [ ] **Step 4:** 检查空结果、部分完成、全平局、同策略不同版本、未知jobId和混合规则；规则/预算/版本不同的结果不混为一个评分范围。每包保留源码摘要、所有配置和逐局数据。
- [ ] **Step 5:** 提交 `feat: add seed-clustered experiment statistics and local duel ratings`。

## Task 17: 实验工作区与可恢复运行

**Files:** Create `ui/experiment.js`、`runtime/experiment-jobs.js`、`test/experiment-jobs.test.js`、`test/experiment-ui.test.js`；Modify `workers/queue-worker.js`、`export/import.js`。
**Interfaces:** ConsumesplanExperiment、统计、JobQueue及RecordStore；Produces `createExperimentController({store,queue})`的preview/create/run/pause/resume/cancelPending/subscribe方法；`preview(config)`返回冻结的`{config,totalMatches,independentSeeds}`，不写入或运行任务；`createExperimentWorkspace({root,controller})`展示总体、分地图、分时长、对阵和性能数据。

- [ ] **Step 1:** 写 `experiment_preview_matches_real_task_count`，显示预计局数与实际任务数相同；`partial_results_resume_idempotently`，刷新/重复回调后不重跑完成job或增加样本量；`live_estimate_is_separate_from_sample_rate`，两个指标各自标签和计算来源明确。

```js
test('experiment_preview_matches_real_task_count', () => {
  const store=createRecordStore({backend:new MemoryBackend()});
  const queue=new JobQueue({execute:async()=>{throw new Error('preview must not execute');},onProgress:()=>{},onResult:()=>{}});
  const c=createExperimentController({store,queue}); const p=c.preview(testExperimentConfig());
  assert.equal(p.totalMatches,32); assert.equal(p.independentSeeds,8); queue.dispose();
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/experiment-jobs.test.js test/experiment-ui.test.js`，确认缺少工作区与恢复行为。
- [ ] **Step 3:** 提供种子输入或4/8/16/64种子快捷生成，地图/时长/策略/预算选择，先显示实际计划再运行；保存completedTaskIds和结果，统计按真实已完成seed groups刷新，取消后保留已有数据。支持实验包导入导出和某局回放。
- [ ] **Step 4:** 检查CI不足样本状态、纯描述结果、本地Elo范围、只显示真实耗时、quota/worker异常可重试；UI不宣称样本外必胜，推荐与克制仅来自本实验数据。
- [ ] **Step 5:** 提交 `feat: deliver a resumable in-browser strategy experiment workspace`。

## Task 18: 内容版本构建与CI

**Files:** Create `scripts/build.mjs`、`scripts/verify-dist.mjs`、`test/build.test.js`、`.github/workflows/test.yml`；Modify `package.json`、`.gitignore`、`.github/workflows/deploy-pages.yml`、`README.md`、`test/ui-structure.test.js`；Delete七个未引用的历史app入口，仅在引用检查通过后。
**Interfaces:** Produces `buildSite({sourceRoot,outDir,commitSha,version}):Promise<BuildManifest>`、`verifyDist({outDir}):Promise<{ok:boolean,missing:string[],unexpected:string[]}>`；BuildManifest含productVersion/commitSha/buildHash/files，build-info使用同样字段。命令`npm run build`、`npm run verify:dist`。

- [ ] **Step 1:** 写 `build_is_complete_and_content_versioned`，改任一实际模块则buildHash及整套运行路径改变；`worker_and_css_references_exist`断言递归imports、new URL(worker,import.meta.url)、CSS引用全部存在；`pages_subpath_is_supported`断言入口资源为相对路径；`dist_excludes_repository_only_files`断言无test/docs/历史app副本。

```js
test('built_assets_have_no_missing_references', async () => {
  const outDir=await mkdtemp(path.join(tmpdir(),'cc-v2-'));
  await buildSite({sourceRoot:path.resolve(import.meta.dirname,'..'),outDir,commitSha:'a'.repeat(40),version:'2.0.0'});
  const report=await verifyDist({outDir});
  assert.equal(report.ok,true); assert.deepEqual(report.missing,[]);
});
```

- [ ] **Step 2:** 运行 `node --test --test-isolation=none test/build.test.js`，确认当前整仓上传不能满足目标产物。
- [ ] **Step 3:** Node内置API生成dist/index.html、dist/build-info.json及assets/<源码SHA256摘要前12位>/完整运行依赖图。所有模块和Worker在同一目录树，legacy源码的旧query仍继承新版本目录。入口HTML改相对资源路径，manifest逐文件记录摘要；README同步真实功能、规则、算法、设置及标准在线地址。
- [ ] **Step 4:** 测试workflow覆盖PR/升级分支，main发布workflow依次测试、构建、verify、上传dist、部署；设置合理的取消旧任务策略，不留下阻塞锁。更新旧结构测试为新入口实际模块完整性检查，保留行为测试；完整npm test在CI通过。
- [ ] **Step 5:** 提交 `build: publish complete content-versioned v2 assets through Pages`。

## Task 19: 综合验收、浏览器行为与实测评测

**Files:** Create `scripts/acceptance.mjs`、`test/browser/arena.spec.mjs`、`test/browser/records.spec.mjs`、`test/browser/competition.spec.mjs`、`test/browser/experiment.spec.mjs`、`playwright.config.mjs`、`docs/benchmarks/v2-acceptance.json`、`docs/benchmarks/v2-acceptance.md`；Modify `package.json`、`package-lock.json`及测试工作流。
**Interfaces:** Produces `npm run acceptance`和`npm run test:browser`；验收报告记录实际源码哈希、版本、运行环境、逐局结果与失败。浏览器测试使用开发依赖@playwright/test，以save-exact和lockfile固定实际解析版本，运行时不增加框架或后端。

- [ ] **Step 1:** 写浏览器行为场景：360×800/390×844/768×1024/1440×1000无横向溢出且设置能关；实际跑单局、暂停/隐藏返回、保存刷新继续、回放跳转、下载并导入、赛事恢复和实验取消。另用同browser两页面写同记录，验证revision冲突和任务去重。

```js
test('mobile_settings_close_without_horizontal_overflow', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?mode=standard&map=plain');
  await page.getByRole('button',{name:'比赛设置',exact:true}).click();
  await page.getByRole('button',{name:'收起设置',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
```

- [ ] **Step 2:** 首次运行 `npm run test:browser`，对发现的真实问题保留失败记录；缺少浏览器环境属于环境问题，先使用允许的浏览器工具执行同一场景，不将其写成产品通过。
- [ ] **Step 3:** Node单元入口固定为`node --test test/*.test.js`，浏览器入口固定为`playwright test`，避免Node把Playwright文件作为自身测试运行；浏览器webServer使用构建后的dist，配置Chromium/WebKit项目。运行冻结后矩阵：8独立种子×4地图×4出生位×60秒，阵容strongest/pathfinder/boundary/ucb，共128局；补标准平原180/400秒各四轮换8局；三个新策略对最强各两seed换边，共12局。调试seed与这8验证seed分开，版本冻结后再运行，不以调整后的同样本冒充留出验证。
- [ ] **Step 4:** 完整执行npm test、build、verify:dist和浏览器流程；以实际结果形成148局报告，列出败局和行为差异，不捏造算法提升百分比。验收每项设计要求，对新问题只运行相关回归及被影响的综合流程；完成整分支代码审查并修复重要问题。
- [ ] **Step 5:** 提交 `test: verify v2 behavior compatibility and release acceptance`。

## Task 20: 发布与线上核对

**Files:** Create `docs/releases/2.0.0.md`；修改仅限最终发布说明或验收发现的实际问题文件。
**Interfaces:** Consumes经验证的分支、manifest与验收报告；Produces真实main提交、成功Pages deployment和在线build-info对应的2.0版本，恢复点指向eff46735基线。

- [ ] **Step 1:** 核查分支与当前main差异、全部文件树、实际测试/构建结果、经典黄金值、README和报告；确认工作树无混入其他任务，保留v1.0.0恢复tag与基线SHA。

```js
// 使用线上已读取的build-info、实际main提交和产物manifest核对。
assert.equal(info.productVersion,'2.0.0');
assert.equal(info.commitSha,publishedMainSha);
assert.equal(info.buildHash,manifest.buildHash);
```

- [ ] **Step 2:** 按选定实施方式完成所需最终审查；记录审查结论与重要问题修复证据，再整合到main并触发已有Pages流程。正常快进或合并，禁止强推覆盖main更新。
- [ ] **Step 3:** 检查这一main SHA的Actions测试/构建/上传/部署全success，在线标准地址的build-info commitSha/buildHash/version一致，并确认运行模块、Worker、CSS请求均成功。
- [ ] **Step 4:** 在线桌面与手机分别跑单局、设置展开/收起、赛事、回放和真实战报下载；若旧缓存，用版本参数核对同一产物，再验证README标准链接。发现问题先修复并重验受影响流程，不能把“文件已推送”当发布成功。
- [ ] **Step 5:** 在发布说明填写真实提交、deployment URL、实测结果与仍存在的具体限制，提交文档并确认最终部署；向用户提供标准在线地址、升级成果与实际验证。发生发布错误时恢复完整已验证版本，不只退入口文件。
