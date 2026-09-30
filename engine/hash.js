const typed={Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array};
export function encode(value,seen=new Set()){
 if(value===null||typeof value!=='object'){if(typeof value==='number'&&!Number.isFinite(value))throw Error('NON_FINITE');if(['function','undefined','symbol','bigint'].includes(typeof value))throw Error('INVALID_VALUE');return value;}
 if(seen.has(value))throw Error('CYCLIC_DATA');seen.add(value);let out;
 if(ArrayBuffer.isView(value))out={$type:value.constructor.name,data:Array.from(value)};
 else if(value instanceof Set)out={$type:'Set',data:[...value].map(v=>encode(v,seen))};
 else if(value instanceof Map)out={$type:'Map',data:[...value].map(v=>encode(v,seen))};
 else if(Array.isArray(value))out=value.map(v=>encode(v,seen));
 else{out={};for(const k of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(k))throw Error('UNSAFE_KEY');out[k]=encode(value[k],seen);}}
 seen.delete(value);return out;
}
export function decode(v){
 if(!v||typeof v!=='object')return v;
 if(Array.isArray(v))return v.map(decode);
 if(v.$type){if(typed[v.$type])return new typed[v.$type](v.data);if(v.$type==='Set')return new Set(v.data.map(decode));if(v.$type==='Map')return new Map(v.data.map(decode));throw Error('INVALID_TYPE');}
 const out={};for(const k of Object.keys(v)){if(['__proto__','constructor','prototype'].includes(k))throw Error('UNSAFE_KEY');out[k]=decode(v[k]);}return out;
}
export const canonicalSerialize=data=>JSON.stringify(encode(data),(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function canonicalHash(data){let h=14695981039346656037n;for(const b of new TextEncoder().encode(canonicalSerialize(data)))h=BigInt.asUintN(64,(h^BigInt(b))*1099511628211n);return h.toString(16).padStart(16,'0');}
export function seal(data){return {...data,integrityHash:canonicalHash(data)};}
export function verify(data){const {integrityHash,...body}=data;if(canonicalHash(body)!==integrityHash)throw Error('INTEGRITY_MISMATCH');return body;}
