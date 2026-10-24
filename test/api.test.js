import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {defaults} from '../lib/config.js';
process.env.DISCORD_GUILD_ID='123456789012345678';
process.env.APP_ORIGIN='https://admin.example.com';
process.env.ADMIN_PASSWORD='strong-test-password-123';
process.env.SESSION_SECRET='test-session-secret-with-over-32-characters';
process.env.DISCORD_TOKEN='test-token';
process.env.DATABASE_URL='postgresql://mock';
let saved,queries=0,sent=0;
globalThis.__testPool=class {
 async query(sql,args){
  queries++;
  if(sql.startsWith('SELECT config'))return {rows:saved?[{config:saved}]:[]};
  if(sql.startsWith('INSERT INTO welcome_settings')){saved=args[1];return {rows:[]};}
  if(sql.startsWith('INSERT INTO request_limits'))return {rows:[{hits:1}]};
  throw Error('Unexpected query');
 }
};
const hook=registerHooks({resolve(spec,context,next){
 if(spec==='pg')return {url:'data:text/javascript,export default {Pool:globalThis.__testPool}',shortCircuit:true};
 return next(spec,context);
}});
const {default:handler}=await import('../api/index.js');
hook.deregister();
async function request(url,method='GET',body,cookie,origin=process.env.APP_ORIGIN) {
 const req={url,method,body,headers:{origin,cookie},socket:{remoteAddress:'test-ip'}};
 const headers={};const res={statusCode:200,setHeader(k,v){headers[k]=v;},end(value){this.value=JSON.parse(value);}};
 await handler(req,res);return {status:res.statusCode,body:res.value,headers};
}
test('API protege configuração, origem, login, salvamento e teste',async()=>{
 const realFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  let value;
  if(url.includes('/channels/')&&options.method==='POST'){sent++;value={id:'message'};}
  else if(url.includes('/channels/'))value={id:'223456789012345678',guild_id:process.env.DISCORD_GUILD_ID,type:0};
  else if(url.endsWith('/users/@me'))value={id:'323456789012345678',username:'Alpha'};
  else value={name:'EB do Alpha',approximate_member_count:67};
  return {ok:true,status:200,json:async()=>value};
 };
 try {
  assert.equal((await request('/api/config')).status,401);
  assert.equal(queries,0);
  assert.equal((await request('/api/login','POST',{password:process.env.ADMIN_PASSWORD},undefined,'https://evil.example')).status,403);
  assert.equal((await request('/api/login','POST',{password:'wrong'})).status,401);
  const login=await request('/api/login','POST',{password:process.env.ADMIN_PASSWORD});
  assert.equal(login.status,200);assert.match(login.headers['Set-Cookie'],/HttpOnly.*SameSite=Strict.*Secure/);
  const cookie=login.headers['Set-Cookie'].split(';')[0];
  assert.equal((await request('/api/session','GET',undefined,cookie)).status,200);
  assert.equal((await request('/api/config','GET',undefined,cookie)).body.enabled,false);
  const c={...defaults,channelId:'223456789012345678',enabled:true};
  assert.equal((await request('/api/config','PUT',{...c,buttons:Array(6).fill({})},cookie)).status,400);
  assert.equal((await request('/api/config','PUT',c,cookie)).status,200);
  assert.deepEqual((await request('/api/config','GET',undefined,cookie)).body,c);
  const result=await request('/api/test','POST',{},cookie);
  assert.equal(result.status,200);assert.equal(sent,1);
  assert.equal(JSON.stringify(result).includes(process.env.DISCORD_TOKEN),false);
  const logout=await request('/api/logout','POST',{},cookie);
  assert.match(logout.headers['Set-Cookie'],/Max-Age=0/);
 }finally{globalThis.fetch=realFetch;}
});
