import {defaults,validate,render} from './config.js';
const $=id=>document.getElementById(id);
let config=structuredClone(defaults),dirty=false,loading=false;
let resources={channels:[],roles:[],emojis:[],warnings:[]};
const selections={title:{start:0,end:0},description:{start:0,end:0}};
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
async function api(path,method='GET',data){
 const r=await fetch('/api/'+path,{method,headers:method==='GET'?{}:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
 const value=await r.json();if(!r.ok){if(r.status===401||r.status===403)show(false);throw new Error(value.error||'Falha na solicitação.');}return value;
}
function show(logged){$('dashboard').hidden=!logged;$('logout').hidden=!logged;$('login').hidden=logged;}
function read(){for(const k of ['channelId','title','description','color','bannerUrl','format'])config[k]=$(k).value;config.enabled=$('enabled').checked;return config;}
function changed(){dirty=true;$('dirty').textContent='Alterações não salvas. Salve antes de enviar um teste.';preview();}
function preview(){
 const c=read(), member={id:'123456789012345678',username:'Novo integrante',server:'EB do Alpha',count:1250};
 previewText($('preview-title'),render(c.title,member));
 $('embed').classList.toggle('wide-message',c.format==='components_v2');
 const buttons=$('preview-buttons');
 if(c.format==='components_v2')$('embed').insertBefore(buttons,$('embed').lastElementChild);else $('embed').after(buttons);
 previewText($('preview-description'),render(c.description,member).replace('<@123456789012345678>','@Novo integrante'));
 $('embed').style.borderLeftColor=c.color;
 const img=$('preview-image');try{const u=new URL(c.bannerUrl);if(u.protocol!=='https:')throw Error();if(img.src!==u.href)img.src=u.href;img.hidden=false;}catch{img.hidden=true;img.removeAttribute('src');}
 $('preview-buttons').replaceChildren();
 for(const b of c.buttons.filter(b=>b.active)){
  const a=document.createElement('a');previewText(a,b.emoji);a.append(document.createTextNode(' '+b.label+' ↗'));
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
  const pickerLabel=document.createElement('label');pickerLabel.textContent='Ou escolher emoji do servidor';
  const picker=document.createElement('select');picker.className='emoji-select';picker.setAttribute('aria-label','Emoji do servidor para o botão '+(i+1));picker.add(new Option('Escolha um emoji',''));
  for(const e of resources.emojis)picker.add(new Option(':'+e.name+':'+(e.animated?' (animado)':''),e.mention));
  if(b.emoji&&!resources.emojis.some(e=>e.mention===b.emoji))picker.add(new Option('Emoji atual / manual',b.emoji));
  picker.value=b.emoji||'';
  picker.onchange=()=>{b.emoji=picker.value;buttonEditors();changed();};
  pickerLabel.append(picker);box.append(pickerLabel);
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
 loading=true;try{config=await api('config');config.format??='components_v2';for(const k of ['title','description','color','bannerUrl','format'])$(k).value=config[k];$('enabled').checked=config.enabled;
 for(const id of ['title','description'])selections[id]={start:$(id).value.length,end:$(id).value.length};
 await channels();buttonEditors();preview();dirty=false;$('dirty').textContent='O teste usa a última configuração salva.';show(true);notice('');await loadResources();
 }catch(e){notice(e.message,true);}finally{loading=false;}
}
$('logout').onclick=async()=>{try{await api('logout','POST',{});show(false);notice('Sessão encerrada.');}catch(e){notice(e.message,true);}};
$('settings').oninput=e=>{if(!loading&&!e.target.closest('.resource-tools'))changed();};
$('settings').onchange=e=>{if(!loading&&!e.target.closest('.resource-tools'))changed();};
$('settings').onsubmit=async e=>{e.preventDefault();$('save').disabled=true;try{validate(read());config=await api('config','PUT',config);dirty=false;$('dirty').textContent='Tudo salvo. O teste usa esta configuração.';notice('Configurações salvas.');}catch(e){notice(e.message,true);}finally{$('save').disabled=false;}};
$('add').onclick=()=>{if(config.buttons.length<5){config.buttons.push({label:'Novo acesso',url:'',emoji:'',active:true});buttonEditors();changed();}};
$('reload').onclick=async()=>{try{await channels();notice('Canais atualizados.');}catch(e){notice(e.message,true);}};
$('test').onclick=async()=>{if(dirty)return notice('Salve as alterações antes de enviar o teste.',true);$('test').disabled=true;try{await api('test','POST',{});notice('Mensagem de teste enviada ao canal configurado.');}catch(e){notice(e.message,true);}finally{$('test').disabled=false;}};
$('preview-image').onerror=()=>{$('preview-image').hidden=true;};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});

function previewText(element,text){
 element.replaceChildren();
 const pattern=/<(a?):(\w{2,32}):(\d{17,20})>|<#(\d{17,20})>|<@&(\d{17,20})>/g;
 let last=0;
 for(const m of text.matchAll(pattern)){
  element.append(document.createTextNode(text.slice(last,m.index)));
  if(m[3]){
   const img=document.createElement('img');img.className='custom-emoji';img.src='https://cdn.discordapp.com/emojis/'+m[3]+(m[1]?'.gif':'.png')+'?size=48';img.alt=':'+m[2]+':';img.loading='lazy';element.append(img);
  }else{
   const item=m[4]?resources.channels.find(x=>x.id===m[4]):resources.roles.find(x=>x.id===m[5]);
   const span=document.createElement('span');span.className='mention';span.textContent=(m[4]?'#':'@')+(item?.name||'não encontrado');element.append(span);
  }
  last=m.index+m[0].length;
 }
 element.append(document.createTextNode(text.slice(last)));
}
function insertText(text){
 const id=$('insert-target').value,field=$(id),range=selections[id];
 const start=Math.min(range.start,field.value.length),end=Math.min(range.end,field.value.length);
 if(field.value.length-(end-start)+text.length>field.maxLength)return notice('O campo atingiu o limite de caracteres.',true);
 field.setRangeText(text,start,end,'end');field.focus();selections[id]={start:field.selectionStart,end:field.selectionEnd};changed();
}
for(const id of ['title','description']){
 const track=()=>{selections[id]={start:$(id).selectionStart,end:$(id).selectionEnd};$('insert-target').value=id;};
 for(const event of ['focus','click','keyup','select','input'])$(id).addEventListener(event,track);
}
function emojiGallery(){
 const gallery=$('emoji-gallery');gallery.replaceChildren();
 const search=$('emoji-search').value.trim().toLowerCase();
 const list=resources.emojis.filter(e=>e.name.toLowerCase().includes(search));
 for(const emoji of list){
  const button=document.createElement('button');button.type='button';button.className='emoji-choice';button.title=':'+emoji.name+':';button.setAttribute('aria-label','Inserir emoji '+emoji.name);
  const img=document.createElement('img');img.src=emoji.url;img.alt=':'+emoji.name+':';img.loading='lazy';button.append(img);
  button.onclick=()=>insertText(emoji.mention);gallery.append(button);
 }
 if(!list.length){const p=document.createElement('p');p.className='hint';p.textContent=search?'Nenhum emoji encontrado.':'Nenhum emoji personalizado disponível.';gallery.append(p);}
}
async function loadResources(){
 $('reload-resources').disabled=true;
 try{
  resources=await api('resources');
  for(const [id,key,prefix,placeholder] of [['mention-channel','channels','# ','Escolha um canal'],['mention-role','roles','@','Escolha um cargo']]){
   const select=$(id);select.replaceChildren(new Option(placeholder,''));
   for(const item of resources[key])select.add(new Option(prefix+item.name,item.id));
  }
  emojiGallery();buttonEditors();preview();
  const labels={channels:'canais',roles:'cargos',emojis:'emojis'};
  $('resource-status').textContent=resources.warnings.length?'Não foi possível carregar: '+resources.warnings.map(x=>labels[x]).join(', ')+'. Confira o acesso do bot e atualize.':resources.emojis.length+' emojis • '+resources.channels.length+' canais • '+resources.roles.length+' cargos';
 }catch(e){$('resource-status').textContent=e.message;}finally{$('reload-resources').disabled=false;}
}
$('reload-resources').onclick=loadResources;
$('emoji-search').oninput=emojiGallery;
$('mention-channel').onchange=e=>{if(e.target.value)insertText('<#'+e.target.value+'>');e.target.value='';};
$('mention-role').onchange=e=>{if(e.target.value)insertText('<@&'+e.target.value+'>');e.target.value='';};

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
