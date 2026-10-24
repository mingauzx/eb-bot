export const defaults = { enabled:false, format:'components_v2', channelId:'', title:'Bem-vindo ao EB do Alpha, {username}!', description:'{member}, sua jornada começa aqui. Leia as regras e apresente-se à tropa.\n\nVocê é o integrante nº {count} do {server}.', infoText:'', closingTitle:'', closingText:'', footerText:'EB DO ALPHA • BOAS-VINDAS', color:'#8fa66a', bannerUrl:'', buttons:[] };
const id = /^\d{17,20}$/;
export function guildId() {
 const value=process.env.DISCORD_GUILD_ID;
 if(!id.test(value||'')) throw new Error('DISCORD_GUILD_ID inválido.');
 return value;
}
export function safeUrl(value) {
 try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password && value.length<=512; } catch {return false;}
}
export function validate(input) {
 if(!input || typeof input!=='object' || Array.isArray(input)) throw new Error('Configuração inválida.');
 const c={};
 c.format=input.format??'components_v2';
 if(!['embed','components_v2'].includes(c.format))throw new Error('Formato de mensagem inválido.');
 if(typeof input.enabled!=='boolean') throw new Error('Estado inválido.');
 c.enabled=input.enabled;
 c.channelId=String(input.channelId||'');
 if((c.channelId && !id.test(c.channelId)) || (c.enabled&&!c.channelId)) throw new Error('Escolha um canal válido.');
 for(const [key,max] of [['title',256],['description',4096]]) {
  if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>max) throw new Error('Título ou descrição inválidos.');
  c[key]=input[key].trim();
 }
 for(const [key,max] of [['infoText',1500],['closingTitle',100],['closingText',800],['footerText',500]]){
  const value=input[key]??defaults[key];
  if(typeof value!=='string'||value.length>max)throw new Error('O campo '+key+' ultrapassou o limite permitido.');
  c[key]=value.trim();
 }
 if(c.format==='components_v2'&&['title','description','infoText','closingTitle','closingText','footerText'].reduce((n,key)=>n+c[key].length,30)>4000)throw new Error('No Components V2, os textos de todos os blocos devem somar até 3970 caracteres.');
 if(!/^#[0-9a-f]{6}$/i.test(input.color)) throw new Error('Cor inválida.');
 c.color=input.color;
 c.bannerUrl=String(input.bannerUrl||'').trim();
 if(c.bannerUrl&&!safeUrl(c.bannerUrl)) throw new Error('Use um banner com URL HTTPS de até 512 caracteres.');
 if(!Array.isArray(input.buttons)||input.buttons.length>5) throw new Error('O limite é de 5 botões.');
 c.buttons=input.buttons.map(b=>{
  if(typeof b.active!=='boolean'||typeof b.label!=='string'||!b.label.trim()||b.label.length>80||!safeUrl(b.url)) throw new Error('Cada botão precisa de nome e link HTTPS válidos.');
  const emoji=String(b.emoji||'').trim();
  if(emoji.length>64 || (emoji && !/^<a?:\w{2,32}:\d{17,20}>$/.test(emoji) && !/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u.test(emoji))) throw new Error('Emoji inválido: use um emoji Unicode ou <:nome:id>.');
  return {label:b.label.trim(),url:b.url,emoji,active:b.active};
 });
 return c;
}
export function render(text,member) {
 const values={username:member.username,member:'<@'+member.id+'>',server:member.server,count:String(member.count)};
 return text.replace(/\{(username|member|server|count)\}/g,(_,k)=>values[k]);
}
export function message(c,member) {
 const buttons=c.buttons.filter(b=>b.active).map(b=>{
  const out={type:2,style:5,label:b.label,url:b.url};
  if(b.emoji) {const custom=b.emoji.match(/^<(a?):(\w+):(\d+)>$/);out.emoji=custom?{id:custom[3],name:custom[2],animated:!!custom[1]}:{name:b.emoji};}
  return out;
 });
 const allowed_mentions={parse:[],users:[member.id]};
 const info=render(c.infoText??defaults.infoText,member);
 const closingTitle=render(c.closingTitle??defaults.closingTitle,member);
 const closingText=render(c.closingText??defaults.closingText,member);
 const footer=render(c.footerText??defaults.footerText,member);
 const closing=[closingTitle?'**'+closingTitle+'**':'',closingText].filter(Boolean).join('\n');
 if((c.format??'components_v2')==='components_v2'){
  const components=[];
  let budget=4000;
  function text(value){if(value&&budget>0){const content=value.slice(0,budget);budget-=content.length;components.push({type:10,content});}}
  function separator(){components.push({type:14,divider:true,spacing:1});}
  text('## '+render(c.title,member).slice(0,256));
  if(c.bannerUrl)components.push({type:12,items:[{media:{url:c.bannerUrl},description:'Banner do EB do Alpha'}]});
  // Reserve o espaço do rodapé antes de substituir variáveis em textos longos.
  const footerContent=footer?('-# '+footer).slice(0,503):'';
  budget-=footerContent.length;
  text(render(c.description,member));
  if(info&&budget>0){separator();text(info);}
  if(closing&&budget>0){separator();text(closing);}
  if(buttons.length)components.push({type:14,divider:true,spacing:1},{type:1,components:buttons});
  if(footerContent)components.push({type:10,content:footerContent});
  return {flags:32768,components:[{type:17,accent_color:parseInt(c.color.slice(1),16),components}],allowed_mentions};
 }
 const description=[render(c.description,member),info,closing].filter(Boolean).join('\n\n').slice(0,4096);
 const embed={title:render(c.title,member).slice(0,256),description,color:parseInt(c.color.slice(1),16)};
 if(footer)embed.footer={text:footer.slice(0,500)};
 if(c.bannerUrl) embed.image={url:c.bannerUrl};
 return {embeds:[embed],components:buttons.length?[{type:1,components:buttons}]:[],allowed_mentions:{parse:[],users:[member.id]}};
}
