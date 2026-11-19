import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags, PermissionFlagsBits} from 'discord.js';
import {accessibleTrainings, rankOrder, trainings} from './training-ranks.js';

import {trainingButtonPrefix as buttonPrefix, trainingMenuButton as menuButton, trainingColor, trainingPanelMessage} from '../lib/training-panel.js';

const panelCommand = 'scripts-treinamento';

const trainingStaffRoles = new Set([
  'supervisor administrativo', 'moderador', 'administrador', 'administrador geral',
  'adm', 'adm geral', 'criador'
]);

function isTrainingStaff(role) {
  if (!role || role.managed) return false;
  const name = role.name.trim().replace(/^\[[^\]]+\]\s*/, '').replace(/\s+/g, ' ').toLowerCase();
  return trainingStaffRoles.has(name);
}

function documentLink(key) {
  const value = process.env['TRAINING_LINK_' + key];
  if (!URL.canParse(value ?? '')) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.host)) return null;
  return url.href;
}

export async function registerTrainingPanel(client, guildId) {
  const guild = await client.guilds.fetch(guildId);
  const ranks = rankOrder(await guild.roles.fetch());
  const unresolved = trainings.flatMap(item => item.minimumRoles).filter(id => !ranks.has(id));
  if (unresolved.length) console.warn('Patentes dos treinamentos sem correspondência:', [...new Set(unresolved)].join(', '));
  await guild.commands.create({
    name: panelCommand,
    description: 'Publica a central de scripts de treinamento neste canal',
    defaultMemberPermissions: PermissionFlagsBits.Administrator
  });
}

export async function handleTrainingPanel(interaction, guildId) {
  if (interaction.guildId !== guildId) return;
  if (interaction.isChatInputCommand() && interaction.commandName === panelCommand) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({content: 'A publicação é reservada à administração.', flags: MessageFlags.Ephemeral});
      return;
    }
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(interaction.channel?.type)
      || !interaction.appPermissions?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
      await interaction.reply({content: 'Use um canal de texto onde o bot possa enviar mensagens e embeds.', flags: MessageFlags.Ephemeral});
      return;
    }
    await interaction.deferReply({flags: MessageFlags.Ephemeral});
    try {
      await interaction.channel.send(trainingPanelMessage());
      await interaction.editReply('Central de treinamentos publicada.');
    } catch (error) {
      await interaction.editReply('Não consegui publicar a central neste canal.');
      throw error;
    }
    return;
  }

  if (!interaction.isButton() || !interaction.customId.startsWith(buttonPrefix)
    || interaction.message.author?.id !== interaction.client.user.id) return;

  const roles = interaction.member?.roles;
  const memberRoleIds = new Set(Array.isArray(roles) ? roles : roles?.cache.keys() ?? []);
  const guildRoles = interaction.guild.roles.cache;
  const isStaff = [...memberRoleIds].some(id => isTrainingStaff(guildRoles.get(id)));
  const available = isStaff ? trainings : accessibleTrainings(rankOrder(guildRoles), memberRoleIds);
  const flags = MessageFlags.Ephemeral;

  if (interaction.customId === menuButton) {
    const buttons = available.filter(({key}) => documentLink(key)).map(({key, label}) => new ButtonBuilder()
      .setCustomId(buttonPrefix + key).setLabel(label).setEmoji('📄').setStyle(ButtonStyle.Secondary));
    if (!buttons.length) {
      await interaction.reply({
        embeds: [{
          color: 0xc98924,
          title: 'Nenhum script disponível',
          description: available.length
            ? 'Os links dos seus treinamentos estão indisponíveis no momento. Avise a administração.'
            : 'Seu cargo ou patente ainda não dá acesso a um roteiro de treinamento.'
        }],
        flags
      });
      return;
    }
    const components = [new ActionRowBuilder().addComponents(buttons.slice(0, 5))];
    if (buttons.length > 5) components.push(new ActionRowBuilder().addComponents(buttons.slice(5)));
    await interaction.reply({
      embeds: [{
        color: trainingColor,
        title: '📚 Seus scripts de treinamento',
        description: 'Selecione um treinamento abaixo para abrir o roteiro.',
        footer: {text: 'Esta mensagem é visível apenas para você'}
      }],
      components,
      flags
    });
    return;
  }

  const training = available.find(({key}) => interaction.customId === buttonPrefix + key);
  const link = training && documentLink(training.key);
  if (!link) {
    await interaction.reply({
      embeds: [{
        color: 0xc98924,
        title: 'Script indisponível',
        description: 'Volte à Central de Treinamentos para consultar os roteiros disponíveis.'
      }],
      flags
    });
    return;
  }
  await interaction.reply({
    embeds: [{
      color: trainingColor,
      author: {name: 'EB do Gandra • Roteiro de treinamento'},
      title: training.label,
      description: 'Use o botão abaixo para abrir o documento do treinamento.'
    }],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder()
      .setLabel('Abrir documento').setEmoji('📄').setStyle(ButtonStyle.Link).setURL(link))],
    flags
  });
}
