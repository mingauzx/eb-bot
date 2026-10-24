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
export async function exchangeIdentity(code){
 const {clientId,clientSecret,redirectUri}=oauthSettings();
 const response=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,client_secret:clientSecret,code,redirect_uri:redirectUri}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Object.assign(new Error('Não foi possível autorizar no Discord. Tente entrar novamente.'),{status:502});
 const tokens=await response.json();
 if(typeof tokens.access_token!=='string')throw Object.assign(new Error('Resposta de autorização inválida.'),{status:502});
 try{
  const userResponse=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+tokens.access_token},signal:AbortSignal.timeout(8000)});
  if(!userResponse.ok)throw Object.assign(new Error('Não foi possível confirmar sua conta Discord.'),{status:502});
  const user=await userResponse.json();
  if(!/^\d{17,20}$/.test(user.id||''))throw Object.assign(new Error('Identidade Discord inválida.'),{status:502});
  return user.id;
 }finally{
  // O token OAuth só identifica a conta; não é persistido nem enviado ao navegador.
  try{await fetch('https://discord.com/api/v10/oauth2/token/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,token:tokens.access_token,token_type_hint:'access_token'}),signal:AbortSignal.timeout(1500)});}catch{}
 }
}
export async function requireRole(userId){
 let member;
 try{member=await discord('/guilds/'+guildId()+'/members/'+userId);}
 catch(e){if(e.discordStatus===404)throw Object.assign(new Error('Você precisa ser membro do servidor EB do Alpha.'),{status:403});throw e;}
 if(!Array.isArray(member.roles)||!member.roles.some(id=>allowedRoles.includes(id)))throw Object.assign(new Error('Acesso restrito a ADM, ADM Geral, Patrono e Criador do EB do Alpha.'),{status:403});
 return member;
}
