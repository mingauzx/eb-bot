import {Client,Events,GatewayIntentBits,PermissionFlagsBits} from 'discord.js';
import {guildId,message} from '../lib/config.js';
import {db,getConfig} from '../lib/db.js';
const guild=guildId();
if(!process.env.DISCORD_TOKEN)throw new Error('Configure DISCORD_TOKEN.');
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers]});
client.once(Events.ClientReady,c=>console.log('EB do Alpha conectado como '+c.user.tag));
client.on(Events.Error,e=>console.error('Erro Discord:',e.name));
client.on(Events.GuildMemberAdd,async member=>{
 if(member.guild.id!==guild)return;
 try {
  const config=await getConfig(guild);
  if(!config?.enabled||!config.channelId)return;
  const channel=await member.guild.channels.fetch(config.channelId);
  if(!channel||![0,5].includes(channel.type)||!channel.permissionsFor(member.guild.members.me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks]))throw new Error('Canal ou permissões inválidos.');
  const payload=message(config,{id:member.id,username:member.user.username,server:member.guild.name,count:member.guild.memberCount});
  await channel.send({...payload,allowedMentions:{parse:[],users:[member.id]},allowed_mentions:undefined});
 } catch(e) {console.error('Falha ao enviar boas-vindas:',e.code||e.message);}
});
let stopping=false;
async function stop(){if(stopping)return;stopping=true;client.destroy();await db().end();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
try {await db().query('SELECT 1 FROM welcome_settings LIMIT 1');await client.login(process.env.DISCORD_TOKEN);}
catch(e){console.error('Falha de inicialização:',e.code||e.name);client.destroy();await db().end();process.exitCode=1;}
