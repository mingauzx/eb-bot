import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {defaults} from '../lib/config.js';
import {session,signed} from '../lib/auth.js';
import {allowedRoles} from '../lib/oauth.js';
process.env.DISCORD_GUILD_ID='123456789012345678';
process.env.APP_ORIGIN='https://admin.example.com';
process.env.SESSION_SECRET='test-session-secret-with-over-32-characters';
process.env.DISCORD_TOKEN='test-token';
process.env.DISCORD_CLIENT_ID='423456789012345678';
process.env.DISCORD_CLIENT_SECRET='test-client-secret';
process.env.DATABASE_URL='postgresql://mock';
const userId='323456789012345678';
let saved,queries=0,sent=0,roles=[allowedRoles[0]],memberStatus=200,roleChecks=0,exchanges=0,tokenStatus=200,tokenError='';
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
 const headers={};const res={statusCode:200,setHeader(k,v){headers[k]=v;},end(value){this.value=value?JSON.parse(value):null;}};
 await handler(req,res);return {status:res.statusCode,body:res.value,headers};
}
test('OAuth, quatro cargos, revogação de acesso, configuração e teste',async()=>{
 const realFetch=globalThis.fetch;
 globalThis.fetch=async(url,options={})=>{
  let value,status=200;
  if(url.endsWith('/oauth2/token')){exchanges++;status=tokenStatus;value=tokenStatus===200?{access_token:'private-access-token'}:{error:tokenError,error_description:'private-client-secret-never-expose'};}
  else if(url.endsWith('/oauth2/token/revoke'))value={};
  else if(url.includes('/members/')){roleChecks++;status=memberStatus;value={roles};}
  else if(url.includes('/channels/')&&options.method==='POST'){sent++;value={id:'message'};}
  else if(url.includes('/channels/'))value={id:'223456789012345678',guild_id:process.env.DISCORD_GUILD_ID,type:0};
  else if(url.endsWith('/users/@me'))value={id:userId,username:'Alpha'};
  else value={name:'EB do Alpha',approximate_member_count:67};
  return {ok:status===200,status,json:async()=>value};
 };
 const flow=async()=>{
  const login=await request('/api/auth/login');
  assert.equal(login.status,302);
  const url=new URL(login.headers.Location);
  assert.equal(url.origin,'https://discord.com');assert.equal(url.searchParams.get('scope'),'identify');
  assert.equal(url.searchParams.get('redirect_uri'),process.env.APP_ORIGIN+'/api/auth/callback');
  assert.match(login.headers['Set-Cookie'],/HttpOnly.*SameSite=Lax.*Secure/);
  return {state:url.searchParams.get('state'),cookie:login.headers['Set-Cookie'].split(';')[0]};
 };
 try {
  assert.equal((await request('/api/config')).status,401);assert.equal(queries,0);
  assert.equal((await request('/api/login','POST',{password:'anything'})).status,401);
  const old='eb_session='+signed({exp:Date.now()+10000,nonce:'old-password-session'});
  assert.equal((await request('/api/config','GET',undefined,old)).status,401);
  const f=await flow();
  assert.equal((await request('/api/auth/callback?code=test&state=wrong','GET',undefined,f.cookie)).headers.Location,'/?auth_error=state');assert.equal(exchanges,0);
  assert.equal((await request('/api/auth/callback?code=test&state='+f.state)).headers.Location,'/?auth_error=state');
  for(const role of allowedRoles){
   roles=[role];const f=await flow();
   const callback=await request('/api/auth/callback?code=test&state='+encodeURIComponent(f.state),'GET',undefined,f.cookie);
   assert.equal(callback.headers.Location,'/');
   assert.equal(callback.headers['Set-Cookie'].length,2);
   assert.match(callback.headers['Set-Cookie'][1],/HttpOnly.*SameSite=Strict.*Secure/);
   assert.equal(JSON.stringify(callback).includes('private-access-token'),false);
  }
  roles=[];
  const denied=await flow();
  assert.equal((await request('/api/auth/callback?code=test&state='+encodeURIComponent(denied.state),'GET',undefined,denied.cookie)).headers.Location,'/?auth_error=forbidden');
  for(const [status,error,expected] of [[401,'invalid_client','oauth_client'],[400,'invalid_grant','oauth_code'],[400,'invalid_request','oauth_code'],[503,'server_error','oauth_unavailable']]){
   tokenStatus=status;tokenError=error;
   const f=await flow();
   const result=await request('/api/auth/callback?code=test&state='+encodeURIComponent(f.state),'GET',undefined,f.cookie);
   assert.equal(result.headers.Location,'/?auth_error='+expected);
   assert.equal(result.headers['Set-Cookie'].includes('eb_session='),false);
   assert.equal(JSON.stringify(result).includes('private-client-secret'),false);
  }
  tokenStatus=200;roles=[allowedRoles[0]];
  for(const [status,expected] of [[401,'bot_token'],[403,'bot_access'],[404,'member_missing'],[429,'bot_rate_limit']]){
   memberStatus=status;const f=await flow();
   const result=await request('/api/auth/callback?code=test&state='+encodeURIComponent(f.state),'GET',undefined,f.cookie);
   assert.equal(result.headers.Location,'/?auth_error='+expected);
   assert.equal(result.headers['Set-Cookie'].includes('eb_session='),false);
  }
  memberStatus=200;roles=[];
  const cookie='eb_session='+session(userId);
  const before=queries;
  for(const [url,method,body] of [['/api/config','GET'],['/api/channels','GET'],['/api/config','PUT',defaults],['/api/test','POST',{}],['/api/session','GET']]){
   assert.equal((await request(url,method,body,cookie)).status,403);
  }
  assert.equal(queries,before);assert.equal(sent,0);
  memberStatus=404;
  assert.equal((await request('/api/config','GET',undefined,cookie)).status,403);
  memberStatus=500;
  assert.equal((await request('/api/config','GET',undefined,cookie)).status,502);
  memberStatus=200;roles=[allowedRoles[0]];
  assert.equal((await request('/api/session','GET',undefined,cookie)).status,200);
  assert.equal((await request('/api/config','PUT',defaults,cookie,'https://evil.example')).status,403);
  const c={...defaults,channelId:'223456789012345678',enabled:true};
  assert.equal((await request('/api/config','PUT',c,cookie)).status,200);
  assert.deepEqual((await request('/api/config','GET',undefined,cookie)).body,c);
  assert.equal((await request('/api/test','POST',{},cookie)).status,200);assert.equal(sent,1);
  roles=[];assert.equal((await request('/api/test','POST',{},cookie)).status,403);assert.equal(sent,1);
  assert.match((await request('/api/logout','POST',{},cookie)).headers['Set-Cookie'],/Max-Age=0/);
  assert.ok(roleChecks>=14);
 }finally{globalThis.fetch=realFetch;}
});
