import {defaults,validate,guildId,message} from '../lib/config.js';
import {getConfig,saveConfig,limit,listSavedEmbeds,writeSavedEmbed} from '../lib/db.js';
import {session,identity,cookie,oauthState,stateCookie,validState} from '../lib/auth.js';
import {origin,authorizationUrl,exchangeIdentity,requireRole,oauthErrorCodes} from '../lib/oauth.js';
import {discord,channel} from '../lib/discord.js';
import {guildResources} from '../lib/resources.js';
import {validatePromotion,promotionMessage} from '../lib/promotions.js';
import {trainingPanelMessage} from '../lib/training-panel.js';
export default async function handler(req,res) {
 const reply=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 try {
  const url=new URL(req.url,'http://localhost');
  const path=url.pathname.replace(/\/$/,'');
  const redirect=location=>{res.statusCode=302;res.setHeader('Location',location);res.end();};
  if(path==='/api/auth/login'&&req.method==='GET'){
   const state=oauthState();const location=authorizationUrl(state);
   res.setHeader('Set-Cookie',stateCookie(state));return redirect(location);
  }
  if(path==='/api/auth/callback'&&req.method==='GET'){
   res.setHeader('Set-Cookie',stateCookie('',true));
   if(!validState(req,url.searchParams.get('state')))return redirect('/?auth_error=state');
   if(url.searchParams.has('error'))return redirect('/?auth_error=cancelled');
   const code=url.searchParams.get('code');
   if(!code||code.length>2048)return redirect('/?auth_error=oauth');
   try{
    const userId=await exchangeIdentity(code);await requireRole(userId);
    res.setHeader('Set-Cookie',[stateCookie('',true),cookie(session(userId))]);
    return redirect('/');
   }catch(e){
    console.error('Falha OAuth:',e.code||e.status||e.name);
    const code=oauthErrorCodes.has(e.code)?e.code:e.status===403?'forbidden':e.code==='AUTH_SETUP'?'setup':e.name==='TimeoutError'||e.name==='TypeError'?'oauth_unavailable':'oauth';
    return redirect('/?auth_error='+code);
   }
  }
  if(!['GET','POST','PUT'].includes(req.method))return reply(405,{error:'Método não permitido.'});
  if(req.method!=='GET') {
   if(req.headers.origin!==origin())return reply(403,{error:'Origem não autorizada.'});
  }
  let body=req.body;
  if(req.method!=='GET'&&!body) {
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>24000)return reply(413,{error:'Dados muito grandes.'});}
   try{body=JSON.parse(raw||'{}');}catch{return reply(400,{error:'JSON inválido.'});}
  } else if(typeof body==='string') {try{body=JSON.parse(body);}catch{return reply(400,{error:'JSON inválido.'});}}
  // O login antigo por senha foi removido. Sessões antigas não contêm identidade Discord.
  const userId=identity(req);
  if(!userId)return reply(401,{error:'Entre com Discord para continuar.'});
  if(path==='/api/logout'&&req.method==='POST'){res.setHeader('Set-Cookie',cookie('',true));return reply(200,{ok:true});}
  await requireRole(userId);
  if(path==='/api/session'&&req.method==='GET')return reply(200,{ok:true,userId});
  const guild=guildId();
  if(path==='/api/resources'&&req.method==='GET')return reply(200,await guildResources(guild));
  const withEmbedUrl=item=>({...item,url:item.message_id?'https://discord.com/channels/'+guild+'/'+item.config.channelId+'/'+item.message_id:null});
  if(path==='/api/embeds'&&req.method==='GET')return reply(200,(await listSavedEmbeds(guild)).map(withEmbedUrl));
  if(path==='/api/embeds'&&['PUT','POST'].includes(req.method)){
   const publishing=req.method==='POST';
   const id=body?.id;
   if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return reply(400,{error:'Identificador inválido.'});
   let config;
   try{
    config=validate({...body,enabled:false,infoText:'',closingTitle:'',closingText:'',footerText:body?.footerText??''});
    if(publishing&&!config.channelId)throw new Error('Selecione um canal de publicação.');
   }catch(error){return reply(400,{error:error.message});}
   if(publishing){
    if(!await limit('embeds:'+guild,5,60))return reply(429,{error:'Aguarde um minuto antes de publicar novamente.'});
    const target=await discord('/channels/'+config.channelId);
    if(target.guild_id!==guild||![0,5].includes(target.type))return reply(400,{error:'Escolha um canal de texto deste servidor.'});
   }
   const saved=await writeSavedEmbed(guild,id,config,publishing?async messageId=>{
    const path='/channels/'+config.channelId+'/messages';
    const payload=message(config);
    if(!messageId){
     payload.nonce=id.replaceAll('-','').slice(0,25);
     payload.enforce_nonce=true;
    }
    try{
     const sent=await discord(messageId?path+'/'+messageId:path,{method:messageId?'PATCH':'POST',body:JSON.stringify(payload)});
     return sent.id;
    }catch(error){
     if(messageId&&error.discordStatus===404)throw Object.assign(new Error('A mensagem original foi apagada ou está indisponível. Crie uma nova embed para republicar.'),{status:404});
     throw error;
    }
   }:null);
   return reply(200,withEmbedUrl(saved));
  }
  if(path==='/api/training-panel'&&req.method==='POST') {
   const id=body?.channelId;
   if(typeof id!=='string'||!/^\d{17,20}$/.test(id))return reply(400,{error:'Selecione um canal de publicação.'});
   if(!await limit('training-panel:'+guild,5,60))return reply(429,{error:'Aguarde um minuto antes de publicar novamente.'});
   const target=await discord('/channels/'+id);
   if(target.guild_id!==guild||![0,5].includes(target.type))return reply(400,{error:'Escolha um canal de texto deste servidor.'});
   const sent=await discord('/channels/'+id+'/messages',{method:'POST',body:JSON.stringify(trainingPanelMessage())});
   return reply(200,{url:'https://discord.com/channels/'+guild+'/'+id+'/'+sent.id});
  }
  if(path==='/api/promotions'&&req.method==='POST') {
   let promotion;
   try { promotion=validatePromotion(body); } catch(error) { return reply(400,{error:error.message}); }
   if(!await limit('promotion:'+guild,5,60))return reply(429,{error:'Aguarde um minuto antes de publicar outra promoção.'});
   const target=await discord('/channels/'+promotion.channelId);
   if(target.guild_id!==guild||![0,5].includes(target.type))return reply(400,{error:'Escolha um canal de texto ou anúncios deste servidor.'});
   if(promotion.pingRoleId) {
    const roles=await discord('/guilds/'+guild+'/roles');
    if(promotion.pingRoleId===guild||!roles.some(role=>role.id===promotion.pingRoleId))return reply(400,{error:'Selecione um cargo válido deste servidor.'});
   }
   const sent=await discord('/channels/'+target.id+'/messages',{method:'POST',body:JSON.stringify(promotionMessage(promotion))});
   return reply(200,{url:'https://discord.com/channels/'+guild+'/'+target.id+'/'+sent.id});
  }
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
