import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
test('classic goldens and full mid-match state survive restoration',async()=>{
 const {LegacyMatchAdapter}=await import('../legacy/adapter.js');
 const {classicDigest}=await import('./support/classic-digest.js');
 const cases=[
  [{seed:'legacy-four-2.0',rotation:2,duration:10,strategies:['aco','strongest','qlearn','voronoi']},380,'72033b2121bec5439a738f11c3da7947a1aded3b0d3f3fa64c58a75735f5870a'],
  [{seed:'legacy-duel-2.0',rotation:0,duration:10,strategies:['strongest','potential'],agentKeys:['entry-a','entry-b']},190,'1bf01122fc2bd3bef921285abefcd347b80f717a30d9885f1c360738a5a2d5f5'],
  [{seed:'20260927',rotation:2,duration:60,strategies:['aco','mcts','qlearn','voronoi']},2288,'c21877d6a3a4977ccf444383b12847b563adff52402daf6a641dfceff4eb7f95']];
 for(const [cfg,count,hash] of cases){
  const a=new LegacyMatchAdapter(cfg);a.advance(93);
  const b=new LegacyMatchAdapter(cfg);b.restore(a.captureCheckpoint());
  while(!a.getSnapshot().finished)a.advance(64);
  while(!b.getSnapshot().finished)b.advance(17);
  assert.equal(a.rawMatch.decisionLog.length,count);assert.equal(classicDigest(a.rawMatch),hash);assert.equal(classicDigest(b.rawMatch),hash);
 }
 for(const path of ['match.js','agents.js','rules.js'])assert.deepEqual(readFileSync(new URL('../'+path,import.meta.url)),readFileSync(new URL('../legacy/v1/'+path,import.meta.url)));
});
test('canonical hash is deterministic, handles typed arrays and rejects cycles',async()=>{
 const {canonicalHash,canonicalSerialize}=await import('../engine/hash.js');
 assert.equal(canonicalHash({a:1,b:2}),canonicalHash({b:2,a:1}));
 assert.notEqual(canonicalHash(new Int8Array([1])),canonicalHash(new Uint8Array([1])));
 const x={};x.x=x;assert.throws(()=>canonicalSerialize(x));assert.match(canonicalHash({a:1}),/^[a-f0-9]{16}$/);
});
