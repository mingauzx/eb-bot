import {ChannelType, MessageFlags, OverwriteType, PermissionFlagsBits} from 'discord.js';
import {db} from '../lib/db.js';
import {ticketButton} from '../lib/promotions.js';

const ticketPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory];
const LOCK_KEY = 'promotion-ticket:';

export async function handlePromotionTicket(interaction, guildId) {
 if (!interaction.isButton() || interaction.guildId !== guildId || interaction.message.author?.id !== interaction.client.user.id) return;
 const match = interaction.customId.match(ticketButton);
 if (!match) return;
 const [, categoryId, staffRoleId] = match;
 const guild = interaction.guild;
 await interaction.deferReply({flags:MessageFlags.Ephemeral});
 try {
  const [category, role] = await Promise.all([guild.channels.fetch(categoryId), guild.roles.fetch(staffRoleId)]);
  if (category?.type !== ChannelType.GuildCategory || !role || role.id === guild.id) {
   await interaction.editReply('O atendimento desta promoção está indisponível. Procure a equipe.');
   return;
  }
  const memberId = interaction.user.id;
  const topic = LOCK_KEY + memberId;
  const connection = await db().connect();
  let channel;
  let created = false;
  try {
   await connection.query('BEGIN');
   await connection.query("SET LOCAL lock_timeout = '8s'");
   await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',[guild.id+':'+topic]);
   const channels = await guild.channels.fetch();
   channel = channels.find(item => item?.type === ChannelType.GuildText && item.topic === topic);
   if (!channel) {
    channel = await guild.channels.create({
     name:'compra-'+memberId, type:ChannelType.GuildText, parent:category.id, topic,
     permissionOverwrites:[
      {id:guild.id,type:OverwriteType.Role,deny:[PermissionFlagsBits.ViewChannel]},
      {id:memberId,type:OverwriteType.Member,allow:ticketPermissions},
      {id:role.id,type:OverwriteType.Role,allow:ticketPermissions},
      {id:interaction.client.user.id,type:OverwriteType.Member,allow:ticketPermissions}
     ],
     reason:'Ticket de compra aberto pelo botão de promoção'
    });
    created = true;
   }
   await connection.query('COMMIT');
  } catch (error) {
   await connection.query('ROLLBACK').catch(() => {});
   throw error;
  } finally {
   connection.release();
  }
  if (created) {
   const link = 'https://discord.com/channels/'+guild.id+'/'+interaction.channelId+'/'+interaction.message.id;
   await channel.send({
    content:'Olá, <@'+memberId+'>! Conte aqui o que deseja comprar.\n[Ver a promoção que abriu este ticket]('+link+')',
    allowedMentions:{parse:[],users:[memberId]}
   }).catch(error => console.error('Falha ao enviar mensagem no ticket:',error.code||error.name));
  }
  await interaction.editReply((created?'Ticket aberto: ':'Você já tem um ticket aberto: ')+channel.toString());
 } catch (error) {
  console.error('Falha ao abrir ticket de promoção:',error.code||error.name);
  await interaction.editReply('Não consegui abrir seu ticket. Tente novamente ou fale com a equipe.');
 }
}
