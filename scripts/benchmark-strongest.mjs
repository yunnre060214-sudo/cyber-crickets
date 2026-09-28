import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {Match} from '../match.js';
import {AGENT_META} from '../agents.js';

const args=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const split=arg.indexOf('=');
  if(!arg.startsWith('--')||split<0)throw new Error('Use --name=value arguments');
  return [arg.slice(2,split),arg.slice(split+1)];
}));
const profile=args.profile||'validation';
if(!['validation','regression','duel','smoke'].includes(profile))throw new Error('Unknown benchmark profile');
const baseline=args.baseline||'5c4aad40bbe7edf0932e51d342a538bcf9cde9ca';
const root=path.resolve(import.meta.dirname,'..');
const sourceHashes=()=>Object.fromEntries(['agents.js','match.js','rules.js'].map(file=>
  [file,execFileSync('git',['hash-object',file],{cwd:root,encoding:'utf8'}).trim()]));
const candidateSourceHashes=sourceHashes();
const baseSha=execFileSync('git',['rev-parse','--verify',baseline+'^{commit}'],{cwd:root,encoding:'utf8'}).trim();
const scratchRoot=args.scratch?path.resolve(args.scratch):os.tmpdir();
fs.mkdirSync(scratchRoot,{recursive:true});
const scratch=fs.mkdtempSync(path.join(scratchRoot,'cyber-crickets-baseline-'));

const lineups=[['qlearn','strongest','minimax','random'],['strongest','potential','mst','denial']];
const configs=[];
if(profile==='validation'){
  // These seeds were held out from the two tuning seeds and RW2GG2 regression.
  for(const seed of ['strongest-v6-eval-a','strongest-v6-eval-b','strongest-v6-eval-c'])
    for(const rotation of [0,1,2,3])for(const duration of [90,180,400])
      for(const strategies of lineups)configs.push({seed,rotation,duration,strategies});
}else if(profile==='regression'){
  for(const rotation of [0,1,2,3])configs.push({seed:'RW2GG2',rotation,duration:400,strategies:lineups[0]});
}else if(profile==='duel'){
  for(const rival of Object.keys(AGENT_META).filter(key=>key!=='strongest'))
    for(const strategies of [['strongest',rival],[rival,'strongest']])
      configs.push({seed:'strongest-v6-duel-eval',rotation:0,duration:180,strategies,agentKeys:strategies});
}else{
  configs.push({seed:'benchmark-smoke',rotation:0,duration:3,strategies:lineups[0]});
}

function run(Ctor,config){
  const match=new Ctor(config);
  while(!match.finished)match.step(.035);
  const id=config.strategies.indexOf('strongest'),mine=match.teams[id];
  const margin=mine.score-Math.max(...match.teams.filter(team=>team.id!==id).map(team=>team.score));
  const decisions=match.decisionLog.filter(item=>item.teamId===id);
  const timings=decisions.map(item=>item.thinkMs).sort((a,b)=>a-b);
  if(decisions.some(item=>!item.result||item.thought.includes('决策异常')))
    throw new Error('Invalid decision in '+JSON.stringify(config));
  return {
    rank:1+match.teams.filter(team=>team.score>mine.score+1e-9).length,
    vp:mine.score,margin,territory:mine.territory,resources:mine.resources,
    peakTerritory:Math.max(...match.timeline.map(item=>item.teams[id].territory)),
    meanThinkMs:timings.reduce((sum,value)=>sum+value,0)/timings.length,
    p95ThinkMs:timings[Math.floor(timings.length*.95)],
    teams:match.teams.map(team=>({strategy:team.strategy,vp:team.score,
      territory:team.territory,resources:team.resources}))
  };
}

function summarize(rows,version){
  const outcomes=rows.map(row=>row[version]);
  return {games:outcomes.length,wins:outcomes.filter(row=>row.margin>1e-9).length,
    ties:outcomes.filter(row=>Math.abs(row.margin)<=1e-9).length,
    meanRank:outcomes.reduce((sum,row)=>sum+row.rank,0)/outcomes.length,
    meanVP:outcomes.reduce((sum,row)=>sum+row.vp,0)/outcomes.length,
    meanMargin:outcomes.reduce((sum,row)=>sum+row.margin,0)/outcomes.length,
    meanTerritory:outcomes.reduce((sum,row)=>sum+row.territory,0)/outcomes.length,
    meanThinkMs:outcomes.reduce((sum,row)=>sum+row.meanThinkMs,0)/outcomes.length,
    meanP95ThinkMs:outcomes.reduce((sum,row)=>sum+row.p95ThinkMs,0)/outcomes.length};
}

try{
  for(const file of ['package.json','agents.js','match.js','rules.js']){
    const content=execFileSync('git',['show',baseSha+':'+file],{cwd:root,encoding:'utf8'});
    fs.writeFileSync(path.join(scratch,file),content);
  }
  const {Match:BaselineMatch}=await import(pathToFileURL(path.join(scratch,'match.js')));
  const results=[];
  for(const config of configs){
    // Alternate execution order to reduce systematic warm-up and timing bias.
    const row={config};
    for(const version of results.length%2?['candidate','baseline']:['baseline','candidate'])
      row[version]=run(version==='baseline'?BaselineMatch:Match,config);
    results.push(row);
    console.log(JSON.stringify({done:results.length,total:configs.length,profile,
      seed:config.seed,rotation:config.rotation,duration:config.duration,
      baselineRank:row.baseline.rank,candidateRank:row.candidate.rank}));
  }
  const summary={baseline:summarize(results,'baseline'),candidate:summarize(results,'candidate'),
    byDuration:Object.fromEntries([...new Set(configs.map(config=>config.duration))].map(duration=>{
      const rows=results.filter(row=>row.config.duration===duration);
      return [duration,{baseline:summarize(rows,'baseline'),candidate:summarize(rows,'candidate')}];
    }))};
  if(profile==='duel'){
    summary.fixtures={baseline:{wins:0,ties:0},candidate:{wins:0,ties:0}};
    for(let i=0;i<results.length;i+=2)for(const version of ['baseline','candidate']){
      const margin=results[i][version].margin+results[i+1][version].margin;
      if(margin>1e-9)summary.fixtures[version].wins++;
      else if(Math.abs(margin)<=1e-9)summary.fixtures[version].ties++;
    }
    summary.fixtures.total=results.length/2;
  }
  if(JSON.stringify(sourceHashes())!==JSON.stringify(candidateSourceHashes))
    throw new Error('Candidate sources changed during the benchmark; rerun against fixed sources');
  const report={profile,baselineCommit:baseSha,step:.035,candidateSourceHashes,
    note:'Fixed-seed sample; seeds, durations and rotations are correlated. Timing is local wall-clock data.',summary,results};
  if(args.output){
    const output=path.resolve(args.output);fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  }
  console.log(JSON.stringify(summary));
}finally{
  fs.rmSync(scratch,{recursive:true,force:true});
}
