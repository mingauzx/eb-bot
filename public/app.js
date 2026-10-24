import {defaults,validate,render} from './config.js';
const $=id=>document.getElementById(id);
let config=structuredClone(defaults),dirty=false,loading=false;
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
async function api(path,method='GET',data){
 const r=await fetch('/api/'+path,{method,headers:method==='GET'?{}:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
 const value=await r.json();if(!r.ok){if(r.status===401||r.status===403)show(false);throw new Error(value.error||'Falha na solicitação.');}return value;
}
function show(logged){$('dashboard').hidden=!logged;$('logout').hidden=!logged;$('login').hidden=logged;}
function read(){for(const k of ['channelId','title','description','color','bannerUrl'])config[k]=$(k).value;config.enabled=$('enabled').checked;return config;}
function changed(){dirty=true;$('dirty').textContent='Alterações não salvas. Salve antes de enviar um teste.';preview();}
function preview(){
 const c=read(), member={id:'123456789012345678',username:'Novo integrante',server:'EB do Alpha',count:1250};
 $('preview-title').textContent=render(c.title,member);
 $('preview-description').textContent=render(c.description,member).replace('<@123456789012345678>','@Novo integrante');
 $('embed').style.borderLeftColor=c.color;
 const img=$('preview-image');try{const u=new URL(c.bannerUrl);if(u.protocol!=='https:')throw Error();if(img.src!==u.href)img.src=u.href;img.hidden=false;}catch{img.hidden=true;img.removeAttribute('src');}
 $('preview-buttons').replaceChildren();
 for(const b of c.buttons.filter(b=>b.active)){
  const a=document.createElement('a');a.textContent=(b.emoji.startsWith('<')?'':b.emoji+' ')+b.label+' ↗';
  try{const u=new URL(b.url);if(u.protocol==='https:')a.href=u.href;}catch{}
  a.target='_blank';a.rel='noopener noreferrer';$('preview-buttons').append(a);
 }
 $('state').textContent=c.enabled?'SISTEMA ATIVADO':'SISTEMA DESATIVADO';$('state').classList.toggle('on',c.enabled);
}
function buttonEditors(){
 $('buttons').replaceChildren();
 config.buttons.forEach((b,i)=>{
  const box=document.createElement('div');box.className='button-editor';
  const top=document.createElement('div');top.className='row';
  const label=document.createElement('label');label.className='toggle';
  const check=document.createElement('input');check.type='checkbox';check.checked=b.active;check.setAttribute('aria-label','Botão '+(i+1)+' ativo');check.onchange=()=>{b.active=check.checked;changed();};
  label.append(check,document.createTextNode('Botão '+(i+1)));top.append(label);
  const remove=document.createElement('button');remove.type='button';remove.className='ghost';remove.textContent='Remover';remove.onclick=()=>{config.buttons.splice(i,1);buttonEditors();changed();};top.append(remove);box.append(top);
  for(const [key,title,max] of [['label','Nome',80],['url','Link HTTPS',512],['emoji','Emoji (opcional)',64]]){
   const l=document.createElement('label');l.textContent=title;const input=document.createElement('input');input.value=b[key];input.maxLength=max;input.required=key!=='emoji';if(key==='url')input.type='url';input.oninput=()=>{b[key]=input.value;changed();};l.append(input);box.append(l);
  }
  $('buttons').append(box);
 });
 $('button-count').textContent=config.buttons.length+'/5';$('add').disabled=config.buttons.length>=5;
}
async function channels(){
 const list=await api('channels');const selected=config.channelId;$('channelId').replaceChildren(new Option('Selecione um canal',''));
 for(const c of list)$('channelId').add(new Option('# '+c.name,c.id));
 if(selected&&!list.some(c=>c.id===selected))$('channelId').add(new Option('Canal indisponível • '+selected,selected));
 $('channelId').value=selected;
}
async function load(){
 loading=true;try{config=await api('config');for(const k of ['title','description','color','bannerUrl'])$(k).value=config[k];$('enabled').checked=config.enabled;
 await channels();buttonEditors();preview();dirty=false;$('dirty').textContent='O teste usa a última configuração salva.';show(true);notice('');
 }catch(e){notice(e.message,true);}finally{loading=false;}
}
$('logout').onclick=async()=>{try{await api('logout','POST',{});show(false);notice('Sessão encerrada.');}catch(e){notice(e.message,true);}};
$('settings').oninput=()=>{if(!loading)changed();};
$('settings').onchange=()=>{if(!loading)changed();};
$('settings').onsubmit=async e=>{e.preventDefault();$('save').disabled=true;try{validate(read());config=await api('config','PUT',config);dirty=false;$('dirty').textContent='Tudo salvo. O teste usa esta configuração.';notice('Configurações salvas.');}catch(e){notice(e.message,true);}finally{$('save').disabled=false;}};
$('add').onclick=()=>{if(config.buttons.length<5){config.buttons.push({label:'Novo acesso',url:'',emoji:'',active:true});buttonEditors();changed();}};
$('reload').onclick=async()=>{try{await channels();notice('Canais atualizados.');}catch(e){notice(e.message,true);}};
$('test').onclick=async()=>{if(dirty)return notice('Salve as alterações antes de enviar o teste.',true);$('test').disabled=true;try{await api('test','POST',{});notice('Mensagem de teste enviada ao canal configurado.');}catch(e){notice(e.message,true);}finally{$('test').disabled=false;}};
$('preview-image').onerror=()=>{$('preview-image').hidden=true;};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
const authErrors={forbidden:'Acesso permitido somente a ADM, ADM Geral, Patrono e Criador do servidor.',state:'O login expirou ou não pertence a este navegador. Clique em Entrar com Discord novamente.',cancelled:'Autorização cancelada no Discord.',setup:'O login Discord ainda precisa ser configurado na hospedagem.',oauth:'Falha ao autorizar no Discord. Confira a configuração OAuth e tente novamente.'};
Object.assign(authErrors,{
 oauth_client:'O Discord recusou o Client ID ou Client Secret. Na Vercel, confira DISCORD_CLIENT_ID (Application ID) e DISCORD_CLIENT_SECRET (OAuth2 → Client Secret). O Client Secret é diferente do token do bot. Depois faça Redeploy.',
 oauth_code:'O código de login expirou ou o endereço de retorno não coincide. Confira OAuth2 → Redirects no Discord: https://eb-bot.vercel.app/api/auth/callback. Abra o painel e clique em Entrar com Discord novamente.',
 oauth_identity:'O Discord não confirmou sua identidade. Inicie o login novamente.',
 oauth_unavailable:'Não foi possível concluir a conexão com o Discord. Aguarde e inicie o login novamente.',
 bot_token:'Login identificado, mas o token do bot está ausente ou foi recusado. Confira DISCORD_TOKEN: deve ser o token da seção Bot, não o Client Secret. Depois faça Redeploy.',
 bot_access:'Login identificado, mas o bot não consegue consultar o servidor. Confira se o bot foi convidado e se DISCORD_GUILD_ID é o ID do servidor EB do Alpha.',
 member_missing:'Sua conta ou o bot não foi encontrado no servidor configurado. Confira se ambos estão no EB do Alpha e se DISCORD_GUILD_ID contém o ID desse servidor.',
 guild_config:'Configure DISCORD_GUILD_ID com o ID do servidor EB do Alpha, não o ID de um cargo ou canal. Depois faça Redeploy.',
 bot_rate_limit:'O Discord limitou as consultas. Aguarde um pouco e inicie o login novamente.'
});
const authError=new URLSearchParams(location.search).get('auth_error');
if(authError){notice(authErrors[authError]||authErrors.oauth,true);history.replaceState(null,'','/');}
try{await api('session');await load();}catch(e){show(false);if(!authError&&e.message!=='Entre com Discord para continuar.')notice(e.message,true);}
