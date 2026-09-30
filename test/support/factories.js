import {createMatchConfig} from '../../engine/config.js';import {canonicalHash} from '../../engine/hash.js';
export const testConfig=(overrides={})=>createMatchConfig({seed:'test-default',durationMs:10000,mode:'standard',mapPreset:'plain',entrants:['random','greedy','turtle','strongest'].map((strategyId,i)=>({participantId:'p'+i,strategyId})),...overrides});
export const resultDigest=canonicalHash;
