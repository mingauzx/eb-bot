import {defaults,validate,guildId,message} from '../lib/config.js';
import {getConfig,saveConfig,limit} from '../lib/db.js';
import {equal,session,authenticated,cookie} from '../lib/auth.js';
import {discord,channel} from '../lib/discord.js';
export default async function handler(req,res) {
 const reply=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 try {
  const path=new URL(req.url,'http://localhost').pathname.replace(/\/$/,'');
  if(!['GET','POST','PUT'].includes(req.method))return reply(405,{error:'Método não permitido.'});
  if(req.method!=='GET') {
   if(!process.env.APP_ORIGIN||req.headers.origin!==new URL(process.env.APP_ORIGIN).origin)return reply(403,{error:'Origem não autorizada.'});
  }
  let body=req.body;
  if(req.method!=='GET'&&!body) {
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>24000)return reply(413,{error:'Dados muito grandes.'});}
   try{body=JSON.parse(raw||'{}');}catch{return reply(400,{error:'JSON inválido.'});}
  } else if(typeof body==='string') {try{body=JSON.parse(body);}catch{return reply(400,{error:'JSON inválido.'});}}
  if(path==='/api/login'&&req.method==='POST') {
   const ip=req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown';
   if(!await limit('login:'+ip,10,900))return reply(429,{error:'Muitas tentativas. Aguarde 15 minutos.'});
   if(!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<16)throw new Error('Configure uma senha administrativa com pelo menos 16 caracteres.');
   if(!equal(body?.password||'',process.env.ADMIN_PASSWORD))return reply(401,{error:'Senha incorreta.'});
   res.setHeader('Set-Cookie',cookie(session()));return reply(200,{ok:true});
  }
  if(!authenticated(req))return reply(401,{error:'Entre para continuar.'});
  if(path==='/api/session'&&req.method==='GET')return reply(200,{ok:true});
  if(path==='/api/logout'&&req.method==='POST'){res.setHeader('Set-Cookie',cookie('',true));return reply(200,{ok:true});}
  const guild=guildId();
  if(path==='/api/config'&&req.method==='GET')return reply(200,await getConfig(guild)||defaults);
  if(path==='/api/channels'&&req.method==='GET') {
   const channels=await discord('/guilds/'+guild+'/channels');
   return reply(200,channels.filter(c=>[0,5].includes(c.type)).map(c=>({id:c.id,name:c.name})));
  }
  if(path==='/api/config'&&req.method==='PUT') {
   let config;try{config=validate(body);}catch(e){return reply(400,{error:e.message});}
   if(config.channelId)await channel(guild,config.channelId);
   await saveConfig(guild,config);return reply(200,config);
  }
  if(path==='/api/test'&&req.method==='POST') {
   if(!await limit('test:'+guild,3,60))return reply(429,{error:'Aguarde um minuto antes de testar novamente.'});
   const c=await getConfig(guild)||defaults;
   if(!c.channelId)return reply(400,{error:'Salve um canal antes do teste.'});
   await channel(guild,c.channelId);
   const [me,g]=await Promise.all([discord('/users/@me'),discord('/guilds/'+guild+'?with_counts=true')]);
   await discord('/channels/'+c.channelId+'/messages',{method:'POST',body:JSON.stringify(message(c,{id:me.id,username:me.username,server:g.name,count:g.approximate_member_count||1}))});
   return reply(200,{ok:true});
  }
  return reply(404,{error:'Rota não encontrada.'});
 } catch(e) {console.error('Falha API:',e.code||e.status||e.name);return reply(e.status||500,{error:e.status?e.message:'Não foi possível concluir. Verifique variáveis e migração do banco.'});}
}
