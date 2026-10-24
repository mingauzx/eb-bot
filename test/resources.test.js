import test from 'node:test';
import assert from 'node:assert/strict';
import {guildResources} from '../lib/resources.js';
test('recursos normalizados, emojis animados e falha parcial',async()=>{
 const original=globalThis.fetch;process.env.DISCORD_TOKEN='private-token';
 const guild='123456789012345678',id='223456789012345678';
 let fail=false;
 globalThis.fetch=async url=>{
  let value;
  if(url.endsWith('/channels'))value=[{id,name:'Geral',type:0},{id:guild,name:'Categoria',type:4}];
  if(url.endsWith('/roles')){if(fail)throw Error('private-details');value=[{id:guild,name:'@everyone'},{id,name:'ADM',permissions:'8'}];}
  if(url.endsWith('/emojis'))value=[{id,name:'alpha',animated:true,available:true,user:{token:'private-details'}},{id:'not-an-id',name:'invalid'},{id:guild,name:'offline',available:false}];
  return {ok:true,status:200,json:async()=>value};
 };
 try{
  const data=await guildResources(guild);
  assert.equal(data.channels.length,1);assert.equal(data.roles.length,1);assert.equal(data.emojis.length,1);
  assert.equal(data.emojis[0].mention,'<a:alpha:'+id+'>');
  assert.match(data.emojis[0].url,/\.gif/);
  assert.equal('permissions' in data.roles[0],false);
  assert.equal(JSON.stringify(data).includes('private-details'),false);
  fail=true;const partial=await guildResources(guild);
  assert.deepEqual(partial.warnings,['roles']);assert.equal(partial.emojis.length,1);assert.deepEqual(partial.roles,[]);
 }finally{globalThis.fetch=original;}
});
