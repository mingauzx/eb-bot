import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
function secret(){const s=process.env.SESSION_SECRET;if(!s||s.length<32)throw new Error('SESSION_SECRET deve ter pelo menos 32 caracteres.');return s;}
export function equal(a,b) {const h=v=>createHmac('sha256',secret()).update(String(v)).digest();return timingSafeEqual(h(a),h(b));}
export function session() {
 const data=Buffer.from(JSON.stringify({exp:Date.now()+8*3600000,nonce:randomBytes(16).toString('hex')})).toString('base64url');
 return data+'.'+createHmac('sha256',secret()).update(data).digest('base64url');
}
export function authenticated(req) {
 const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('eb_session='))?.slice(11);
 if(!token)return false;
 const [data,sig]=token.split('.');
 if(!sig||!equal(sig,createHmac('sha256',secret()).update(data).digest('base64url')))return false;
 try{return JSON.parse(Buffer.from(data,'base64url')).exp>Date.now();}catch{return false;}
}
export function cookie(token,logout=false) {return 'eb_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+(logout?0:28800)+(process.env.APP_ORIGIN?.startsWith('https:')?'; Secure':'');}
