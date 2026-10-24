import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,validate,message} from '../lib/config.js';
import {session,authenticated} from '../lib/auth.js';
const member={id:'123456789012345678',username:'Mingau',server:'EB do Alpha',count:67};
test('mensagem substitui variáveis, preserva GIF e limita menções',()=>{
 const c=validate({...defaults,format:'embed',bannerUrl:'https://example.com/banner.gif'});
 const m=message(c,member);assert.match(m.embeds[0].title,/Mingau/);assert.match(m.embeds[0].description,/67/);assert.equal(m.embeds[0].image.url,c.bannerUrl);assert.deepEqual(m.allowed_mentions,{parse:[],users:[member.id]});assert.deepEqual(m.components,[]);
});
test('validação rejeita sexto botão, links inseguros e campos excessivos',()=>{
 const b={label:'Regras',url:'https://example.com',emoji:'',active:true};
 assert.throws(()=>validate({...defaults,buttons:Array(6).fill(b)}));
 assert.throws(()=>validate({...defaults,buttons:[{...b,url:'javascript:alert(1)'}]}));
 assert.throws(()=>validate({...defaults,title:'a'.repeat(257)}));
 assert.throws(()=>validate({...defaults,enabled:true}));
 assert.throws(()=>validate({...defaults,color:'red'}));
 assert.throws(()=>validate({...defaults,bannerUrl:'http://example.com'}));
});
test('cinco botões ativos e emojis personalizados são serializados',()=>{
 const b={label:'Regras',url:'https://example.com',emoji:'<:alpha:123456789012345678>',active:true};
 const c=validate({...defaults,format:'embed',buttons:Array(5).fill(b)});
 assert.equal(message(c,member).components[0].components.length,5);
 assert.equal(message(c,member).components[0].components[0].emoji.id,member.id);
 c.buttons[0].active=false;assert.equal(message(c,member).components[0].components.length,4);
});
test('sessão válida, adulterada e expirada',()=>{
 process.env.SESSION_SECRET='test-only-secret-with-more-than-32-characters';
 const token=session(member.id);assert.equal(authenticated({headers:{cookie:'eb_session='+token}}),true);
 assert.equal(authenticated({headers:{cookie:'eb_session='+token+'x'}}),false);
 assert.equal(authenticated({headers:{}}),false);
 const real=Date.now;Date.now=()=>real()+9*3600000;
 try{assert.equal(authenticated({headers:{cookie:'eb_session='+token}}),false);}finally{Date.now=real;}
});

test('Components V2 usa container, galeria e botões sem embeds',()=>{
 const c=validate({...defaults,bannerUrl:'https://example.com/banner.gif',buttons:Array.from({length:5},()=>({label:'Regras',url:'https://example.com',emoji:'<a:alpha:123456789012345678>',active:true}))});
 const m=message(c,member);
 assert.equal(m.flags,32768);assert.equal('embeds' in m,false);assert.equal('content' in m,false);
 const container=m.components[0];assert.equal(container.type,17);assert.equal(container.accent_color,parseInt(c.color.slice(1),16));
 assert.match(container.components[0].content,/# Bem-vindo/);
 assert.equal(container.components.find(x=>x.type===12).items[0].media.url,c.bannerUrl);
 assert.equal(container.components.find(x=>x.type===1).components.length,5);
 assert.equal(container.components.find(x=>x.type===1).components[0].emoji.animated,true);
 assert.deepEqual(m.allowed_mentions,{parse:[],users:[member.id]});
});
test('V2 sem imagem/botões e limite após substituir variáveis',()=>{
 const m=message({...defaults,title:'Boas-vindas',description:'{server}'.repeat(400)}, {...member,server:'x'.repeat(100)});
 assert.equal(m.components[0].components.some(x=>[1,12].includes(x.type)),false);
 assert.ok(m.components[0].components.filter(x=>x.type===10).reduce((n,c)=>n+c.content.length,0)<=4000);
 assert.throws(()=>validate({...defaults,title:'a'.repeat(256),description:'a'.repeat(3800)}));
 assert.throws(()=>validate({...defaults,format:'arbitrary'}));
 const old={...defaults};delete old.format;assert.equal(message(old,member).flags,32768);
});

test('blocos V2 na ordem: cabeçalho, banner, boas-vindas, informações, fechamento e rodapé',()=>{
 const c=validate({...defaults,bannerUrl:'https://example.com/banner.gif',infoText:'Leia <#223456789012345678>',closingTitle:'Disciplina • Honra • Lealdade',closingText:'Boa jornada, {username}!',footerText:'Rodapé personalizado'});
 const list=message(c,member).components[0].components;
 assert.equal(list[0].type,10);assert.equal(list[1].type,12);
 assert.match(list[2].content,/sua jornada/);
 assert.deepEqual(list[3],{type:14,divider:true,spacing:1});
 assert.equal(list[4].content,c.infoText);
 assert.equal(list[5].type,14);assert.match(list[6].content,/\*\*Disciplina/);
 assert.match(list[6].content,/Boa jornada, Mingau!/);
 assert.equal(list.at(-1).content,'-# Rodapé personalizado');
});
test('blocos opcionais vazios são omitidos e payload completo respeita limite',()=>{
 const c=validate({...defaults,footerText:''});
 const simple=message(c,member).components[0].components;
 assert.equal(simple.length,2);assert.equal(simple.some(x=>x.type===14),false);
 const huge={...defaults,title:'{server}',description:'{server}'.repeat(100),infoText:'{server}'.repeat(20),closingTitle:'Final',closingText:'Até mais',footerText:'Rodapé'};
 const list=message(huge,{...member,server:'s'.repeat(100)}).components[0].components;
 assert.ok(list.filter(x=>x.type===10).reduce((sum,c)=>sum+c.content.length,0)<=4000);
 assert.equal(list.at(-1).content,'-# Rodapé');
 assert.throws(()=>validate({...defaults,infoText:'x'.repeat(1501)}));
 assert.throws(()=>validate({...defaults,footerText:'x'.repeat(501)}));
});
test('embed tradicional preserva blocos e rodapé editados',()=>{
 const c=validate({...defaults,format:'embed',infoText:'Informações',closingTitle:'Lema',closingText:'Texto final',footerText:'Meu rodapé'});
 const embed=message(c,member).embeds[0];
 assert.match(embed.description,/Informações/);assert.match(embed.description,/Texto final/);
 assert.equal(embed.footer.text,'Meu rodapé');
 const empty=message({...c,footerText:''},member).embeds[0];assert.equal('footer' in empty,false);
});
