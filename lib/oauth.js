import {guildId} from './config.js';
import {discord} from './discord.js';
import {setupError} from './auth.js';
export const allowedRoles=Object.freeze(['1545550460763770993','1545550460763770996','1562882324104876062','1545550460763770997']);
export function origin(){
 try{const url=new URL(process.env.APP_ORIGIN);if(url.protocol==='https:'||(url.protocol==='http:'&&url.hostname==='localhost'))return url.origin;}catch{}
 throw setupError('Configure APP_ORIGIN com o endereço HTTPS do painel.');
}
export function oauthSettings(){
 const clientId=process.env.DISCORD_CLIENT_ID,clientSecret=process.env.DISCORD_CLIENT_SECRET;
 if(!/^\d{17,20}$/.test(clientId||'')||!clientSecret)throw setupError('Configure DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET na Vercel.');
 return {clientId,clientSecret,redirectUri:origin()+'/api/auth/callback'};
}
export function authorizationUrl(state){
 const {clientId,redirectUri}=oauthSettings();
 return 'https://discord.com/oauth2/authorize?'+new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:'identify',state,prompt:'consent'});
}
function authError(code,message,status=502){return Object.assign(new Error(message),{code,status});}
export const oauthErrorCodes=new Set(['oauth_client','oauth_code','oauth_identity','oauth_unavailable','bot_token','bot_access','member_missing','guild_config','bot_rate_limit']);
export async function exchangeIdentity(code){
 const {clientId,clientSecret,redirectUri}=oauthSettings();
 const response=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,client_secret:clientSecret,code,redirect_uri:redirectUri}),signal:AbortSignal.timeout(8000)});
 if(!response.ok){
  // Não registrar o corpo: provedores podem incluir dados sensíveis.
  let error;try{error=(await response.json()).error;}catch{}
  if(error==='invalid_client'||response.status===401)throw authError('oauth_client','O Client ID ou Client Secret da aplicação Discord está incorreto.');
  if(error==='invalid_grant'||error==='invalid_request')throw authError('oauth_code','Código OAuth inválido, expirado ou URL de retorno divergente.');
  throw authError('oauth_unavailable','O Discord não concluiu a autorização. Tente novamente.');
 }
 const tokens=await response.json();
 if(typeof tokens.access_token!=='string')throw authError('oauth_identity','Resposta de autorização inválida.');
 try{
  const userResponse=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+tokens.access_token},signal:AbortSignal.timeout(8000)});
  if(!userResponse.ok)throw authError('oauth_identity','Não foi possível confirmar sua conta Discord.');
  const user=await userResponse.json();
  if(!/^\d{17,20}$/.test(user.id||''))throw authError('oauth_identity','Identidade Discord inválida.');
  return user.id;
 }finally{
  // O token OAuth só identifica a conta; não é persistido nem enviado ao navegador.
  try{await fetch('https://discord.com/api/v10/oauth2/token/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,token:tokens.access_token,token_type_hint:'access_token'}),signal:AbortSignal.timeout(1500)});}catch{}
 }
}
export async function requireRole(userId){
 if(!process.env.DISCORD_TOKEN)throw authError('bot_token','Configure DISCORD_TOKEN com o token da seção Bot do Discord Developer Portal.',503);
 let guild;try{guild=guildId();}catch{throw authError('guild_config','Configure DISCORD_GUILD_ID com o ID do servidor EB do Alpha.',503);}
 let member;
 try{member=await discord('/guilds/'+guild+'/members/'+userId);}
 catch(e){
  if(e.discordStatus===401)throw authError('bot_token','O token do bot foi recusado pelo Discord. Confira DISCORD_TOKEN.',503);
  if(e.discordStatus===403)throw authError('bot_access','O bot não consegue consultar o servidor configurado. Confira o convite do bot e DISCORD_GUILD_ID.',503);
  if(e.discordStatus===404)throw authError('member_missing','Sua conta ou o bot não está no servidor configurado. Confira DISCORD_GUILD_ID.',403);
  if(e.discordStatus===429)throw authError('bot_rate_limit','O Discord limitou as consultas. Aguarde um pouco e tente novamente.',429);
  throw e;
 }
 if(!Array.isArray(member.roles)||!member.roles.some(id=>allowedRoles.includes(id)))throw Object.assign(new Error('Acesso restrito a ADM, ADM Geral, Patrono e Criador do EB do Alpha.'),{status:403});
 return member;
}
