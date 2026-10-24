import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
export function setupError(message){return Object.assign(new Error(message),{status:503,code:'AUTH_SETUP'});}
function secret(){const s=process.env.SESSION_SECRET;if(!s||s.length<32)throw setupError('Configure SESSION_SECRET com pelo menos 32 caracteres na Vercel.');return s;}
export function equal(a,b){const h=v=>createHmac('sha256',secret()).update(String(v)).digest();return timingSafeEqual(h(a),h(b));}
export function signed(data){const value=Buffer.from(JSON.stringify(data)).toString('base64url');return value+'.'+createHmac('sha256',secret()).update(value).digest('base64url');}
export function verified(token,kind){
 if(typeof token!=='string'||token.length>4096)return null;
 const [value,sig,extra]=token.split('.');
 if(extra||!sig||!equal(sig,createHmac('sha256',secret()).update(value).digest('base64url')))return null;
 try{const data=JSON.parse(Buffer.from(value,'base64url'));return data.kind===kind&&Number.isFinite(data.exp)&&data.exp>Date.now()?data:null;}catch{return null;}
}
export function readCookie(req,name){return (req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);}
export function session(userId){
 if(!/^\d{17,20}$/.test(userId||''))throw new Error('Identidade Discord inválida.');
 return signed({kind:'discord-session-v1',userId,exp:Date.now()+8*3600000,nonce:randomBytes(16).toString('hex')});
}
export function identity(req){const data=verified(readCookie(req,'eb_session'),'discord-session-v1');return data&&/^\d{17,20}$/.test(data.userId||'')?data.userId:null;}
export function authenticated(req){return !!identity(req);}
export function cookie(token,logout=false){return namedCookie('eb_session',token,logout?0:28800,'Strict');}
function namedCookie(name,value,age,sameSite){return name+'='+value+'; HttpOnly; SameSite='+sameSite+'; Path=/; Max-Age='+age+(process.env.APP_ORIGIN?.startsWith('https:')?'; Secure':'');}
export function oauthState(){return signed({kind:'discord-oauth-state',exp:Date.now()+600000,nonce:randomBytes(32).toString('hex')});}
export function stateCookie(value,clear=false){return namedCookie('eb_oauth_state',value,clear?0:600,'Lax');}
export function validState(req,state){const stored=readCookie(req,'eb_oauth_state');return typeof state==='string'&&!!stored&&equal(state,stored)&&!!verified(state,'discord-oauth-state');}
