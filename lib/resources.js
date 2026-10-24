import {discord} from './discord.js';
const validId=id=>typeof id==='string'&&/^\d{17,20}$/.test(id);
export async function guildResources(guild){
 const kinds=['channels','roles','emojis'];
 const results=await Promise.allSettled(kinds.map(kind=>discord('/guilds/'+guild+'/'+kind)));
 const data={channels:[],roles:[],emojis:[],warnings:[]};
 results.forEach((result,i)=>{
  const kind=kinds[i];
  if(result.status!=='fulfilled'||!Array.isArray(result.value)){data.warnings.push(kind);return;}
  const items=result.value.filter(x=>validId(x.id)&&typeof x.name==='string');
  if(kind==='channels')data.channels=items.filter(x=>[0,2,5,13,15,16].includes(x.type)).sort((a,b)=>(a.position||0)-(b.position||0)).map(x=>({id:x.id,name:x.name,type:x.type}));
  if(kind==='roles')data.roles=items.filter(x=>x.id!==guild).sort((a,b)=>(b.position||0)-(a.position||0)).map(x=>({id:x.id,name:x.name,color:x.color||0}));
  if(kind==='emojis')data.emojis=items.filter(x=>x.available!==false&&/^\w{2,32}$/.test(x.name)).sort((a,b)=>a.name.localeCompare(b.name)).map(x=>({id:x.id,name:x.name,animated:!!x.animated,mention:'<'+(x.animated?'a':'')+':'+x.name+':'+x.id+'>',url:'https://cdn.discordapp.com/emojis/'+x.id+(x.animated?'.gif':'.png')+'?size=48'}));
 });
 return data;
}
