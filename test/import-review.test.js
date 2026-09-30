import test from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../engine/factory.js";
import { encode, seal } from "../engine/hash.js";
import { buildReplayPackage } from "../replay/ledger.js";
import { resultReplay, compactResult } from "../runtime/result-replay.js";
import { importPackage } from "../export/import.js";
import { createJobExport } from "../export/jobs.js";
import { planExperiment } from "../analysis/experiment.js";
import { createRecordStore } from "../storage/records.js";
import { MemoryBackend } from "./support/memory-backend.js";
import { createCompetitionController } from "../runtime/competition-jobs.js";
import { migrateLegacyTournaments } from "../storage/migrate.js";
import { Tournament } from "../competition/tournament.js";
import { Tournament as OldTournament } from "../legacy/v1/tournament.js";
import { testConfig, testExperimentConfig, testTournamentConfig } from "./support/factories.js";
const reseal = ({ integrityHash, ...body }) => seal(body);
const file = (pkg) => new File([JSON.stringify(encode(pkg))], "review.json");
const capture = (m) => ({
  checkpoint: m.captureCheckpoint(), initialBoard: m.getInitialBoard(),
  ledger: m.readLedger().records, snapshot: m.getSnapshot(),
  boardCheckpoints: m.boardCheckpoints ?? [],
});
function replay(mode = "standard", ticks = 500) {
  const m = createMatch(testConfig({mode, entrants: ["random", "greedy"].map((strategyId,i)=>({participantId:"p"+i,strategyId}))}));
  m.advance(ticks);
  return buildReplayPackage(capture(m));
}
async function rejectsWithoutWrites(pkg, raw = false) {
  let writes = 0;
  await assert.rejects(() => importPackage(raw ? new File([JSON.stringify(pkg)], "bad.json") : file(pkg), {
    store: {putPackage: async()=>writes++, putJobPackage: async()=>writes++},
  }));
  assert.equal(writes, 0);
}
test("raw numeric typed arrays cannot coerce corrupted data into a valid hash", async () => {
  const raw = encode(replay());
  raw.initialBoard.owner.data[0] += 256;
  await rejectsWithoutWrites(raw, true);
});
test("sealed invalid typed arrays reject wrapping, fractions, strings and allocation arguments", async () => {
  for (const mutate of [
    b=>b.owner.data[0]=255, b=>b.owner.data[0]=0.5,
    b=>b.owner.data[0]="1", b=>b.owner.data=4096,
    b=>b.resources.data[0]=-256,
  ]) {
    const raw = encode(replay());
    mutate(raw.initialBoard);
    await rejectsWithoutWrites(reseal(raw), true);
  }
});
test("board checkpoints and summaries must agree with the actual tick ledger", async () => {
  const original = replay();
  for (const mutate of [
    p=>p.boardCheckpoints[0].scores[0]=9999,
    p=>p.boardCheckpoints[0].timeMs=9980,
    p=>p.boardCheckpoints[0].board.owner[0]=0,
    p=>p.summary.teams[0].score+=100,
    p=>p.summary.finished=false,
  ]) {
    const p=structuredClone(original); mutate(p);
    await rejectsWithoutWrites(reseal(p));
  }
});
test("resume checkpoints must agree with ledger scores, identity, cursors and agent states", async () => {
  const original = replay();
  for (const mutate of [
    cp=>cp.teams[0].score+=100,
    cp=>cp.scores[0]+=100,
    cp=>cp.ledgerCursor--,
    cp=>cp.agentStates.pop(),
    cp=>cp.rngStates[0].state=-1,
    cp=>cp.agentStates[0].rng.state=-1,
    cp=>cp.eventState=[],
    cp=>cp.teams[0].participantId="unknown",
  ]) {
    const p=structuredClone(original); mutate(p.checkpoint);
    p.checkpoint=reseal(p.checkpoint);
    await rejectsWithoutWrites(reseal(p));
  }
});
test("all modes import their own unfinished data and resume to the same complete result", async () => {
  for (const mode of ["standard","migration","classic"]) {
    const m=createMatch(testConfig({mode}));
    m.advance(100);
    const imported=await importPackage(file(buildReplayPackage(capture(m))));
    const restored=createMatch(m.config); restored.restore(imported.package.checkpoint);
    m.advance(1000); restored.advance(1000);
    assert.deepEqual(restored.getResult(),m.getResult(),mode);
  }
});
test("experiment results must match their attached finished replay and identities", async () => {
  const plan=planExperiment(testExperimentConfig({seedList:["one"],teamCount:2,rosters:[testConfig().entrants.slice(0,2)]}));
  const job=plan.orderedTasks[0], m=createMatch(job.config); m.advance(500);
  const item={jobId:job.jobId,result:compactResult(m.getResult()),replay:resultReplay(job,m.getResult())};
  for(const mutate of [
    r=>r.result.teams[0].score=9999,
    r=>r.result.timeMs=9980,
    r=>r.result.teams[1]={...r.result.teams[0]},
    r=>r.result.teams[0].territory+=1,
  ]) {
    const changed=structuredClone(item); mutate(changed);
    await rejectsWithoutWrites(seal({format:"cyber-crickets.experiment",formatVersion:3,config:plan.config,state:plan,results:[changed],checkpoints:[],sourceHash:"test"}));
  }
});
test("competition completion cannot invent a champion without finished fixtures and legs", async () => {
  const t=new Tournament(testTournamentConfig()), state=t.toJSON();
  state.rounds.forEach(r=>r.completed=true); state.status="completed";
  await rejectsWithoutWrites(seal({format:"cyber-crickets.competition",formatVersion:3,config:state.config,state,results:[],checkpoints:[],sourceHash:"test"}));
});
test("competition fixture scores cannot override the saved actual legs", async () => {
  const t=new Tournament(testTournamentConfig());
  const state=t.toJSON(), f=state.rounds[0].fixtures[0];
  f.result={winner:f.entrants[0],aggregates:Object.fromEntries(f.entrants.map(id=>[id,{vp:9999,captures:0,territory:1}])),legs:[]};
  state.status="running";
  await rejectsWithoutWrites(seal({format:"cyber-crickets.competition",formatVersion:3,config:state.config,state,results:[],checkpoints:[],sourceHash:"test"}));
});
const memoryStore=()=>createRecordStore({backend:new MemoryBackend()});
async function migrated(complete=false) {
  const old=new OldTournament({id:"portable-old",name:"Old",seed:"portable-old",format:"round_robin",duration:10,entrants:["bfs","dfs","greedy","random","aco","voronoi","potential","pid"]});
  if(complete) for(const r of old.rounds) {
    for(const f of r.fixtures) f.result={winner:f.entrants[0],aggregates:Object.fromEntries(f.entrants.map((id,i)=>[id,{vp:i?2:4,captures:0,territory:2}])),legs:[{seats:f.entrants,vp:[2,1],captures:[0,0],territory:[1,1]},{seats:[...f.entrants].reverse(),vp:[1,2],captures:[0,0],territory:[1,1]}]};
    r.completed=true;
  }
  const s=memoryStore();
  await migrateLegacyTournaments({getItem:()=>JSON.stringify([old.toJSON()]),setItem(){}},s);
  await createCompetitionController({store:s}).load("legacy:portable-old");
  return s;
}
test("unfinished and completed migrated classic tournaments roundtrip through their own packages", async()=>{
  for(const complete of [false,true]){
    const s=await migrated(complete), output=await createJobExport("legacy:portable-old",s), target=memoryStore();
    const imported=await importPackage(new File([output.blob],output.filename),{store:target});
    const restored=await createCompetitionController({store:target}).load(imported.id);
    assert.equal(restored.tournament.status==="completed",complete);
    assert.equal(imported.resume,!complete);
    assert.deepEqual(restored.tournament.toJSON().rawLegacy,(await s.get("legacy:portable-old")).state.rawLegacy);
  }
});
test("migrated classic packages preserve completed new legs across a partial round", async()=>{
  const s=await migrated(), jobs=[], q={enqueue:list=>jobs.push(...list),resume(){},pause(){}};
  const c=createCompetitionController({store:s,queue:q}); await c.run("legacy:portable-old");
  const firstFixture=jobs[0].fixtureId;
  for(const job of jobs.filter(j=>j.fixtureId===firstFixture).slice(0,2)){
    const m=createMatch(job.config); m.advance(1000); await q.onResult(job,m.getResult());
  }
  const output=await createJobExport("legacy:portable-old",s), target=memoryStore();
  const imported=await importPackage(new File([output.blob],output.filename),{store:target});
  const pending=[], resumed=createCompetitionController({store:target,queue:{enqueue:list=>pending.push(...list),resume(){},pause(){}}});
  await resumed.run(imported.id);
  assert.equal((await target.taskResults(imported.id)).length,2);
  assert.ok(pending.length>0);
  assert.ok(pending.every(j=>j.fixtureId!==firstFixture));
});
