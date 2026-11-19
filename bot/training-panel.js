import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags, PermissionFlagsBits} from 'discord.js';
import {accessibleTrainings, rankOrder, trainings} from './training-ranks.js';

const panelCommand = 'scripts-treinamento';
import {trainingButtonPrefix as buttonPrefix, trainingMenuButton as menuButton, trainingPanelMessage} from '../lib/training-panel.js';

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
  const memberRoleIds = Array.isArray(roles) ? roles : roles?.cache.keys() ?? [];
  const available = accessibleTrainings(rankOrder(interaction.guild.roles.cache), memberRoleIds);
  const flags = MessageFlags.Ephemeral;

  if (interaction.customId === menuButton) {
    const buttons = available.filter(({key}) => documentLink(key)).map(({key, label}) => new ButtonBuilder()
      .setCustomId(buttonPrefix + key).setLabel(label).setStyle(ButtonStyle.Secondary));
    if (!buttons.length) {
      await interaction.reply({content: 'Nenhum script está disponível para sua patente.', flags});
      return;
    }
    const components = [new ActionRowBuilder().addComponents(buttons.slice(0, 5))];
    if (buttons.length > 5) components.push(new ActionRowBuilder().addComponents(buttons.slice(5)));
    await interaction.reply({content: 'Escolha um treinamento.', components, flags});
    return;
  }

  const training = available.find(({key}) => interaction.customId === buttonPrefix + key);
  const link = training && documentLink(training.key);
  if (!link) {
    await interaction.reply({content: 'Este script está indisponível para sua patente.', flags});
    return;
  }
  await interaction.reply({content: '[Abrir script de ' + training.label + '](<' + link + '>)', flags});
}
