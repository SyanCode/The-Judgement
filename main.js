require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, PermissionFlagsBits,
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const token = process.env.TOKEN;

const COLOR = '#010039';
const QUORUM = 3;              // votes minimum pour qu'un procès soit valide
const DEFAULT_MINUTES = 2;     // durée par défaut d'un procès
const MAX_MINUTES = 60;

/* ------------------------------ Stockage ------------------------------ */

const file = name => path.join(__dirname, name);
const load = (name, fallback) => {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch { return fallback; }
};
const save = (name, data) => fs.writeFileSync(file(name), JSON.stringify(data, null, 2));

const flops = load('flops.json', {});
const masterclasses = load('masterclasses.json', {});
// casier[userId] = { trials, guilty, acquitted, accusations }
const casier = load('casier.json', {});
// config[guildId] = { flopRoles: [roleId, ...] } : rôles autorisés à utiliser /addflop et /delflop
const config = load('config.json', {});

function canManageFlops(interaction) {
  if (!interaction.guild) return false;
  if (interaction.user.id === interaction.guild.ownerId) return true;
  // Les administrateurs (permission Administrateur) sont toujours autorisés.
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const allowed = config[interaction.guildId]?.flopRoles ?? [];
  return allowed.some(id => interaction.member.roles.cache.has(id));
}

const record = id => (casier[id] ??= { trials: 0, guilty: 0, acquitted: 0, accusations: 0 });

function adjust(store, fileName, id, delta) {
  const value = (store[id] || 0) + delta;
  if (value <= 0) delete store[id]; else store[id] = value;
  save(fileName, store);
  return value > 0 ? value : 0;
}

/* ------------------------------ Contenu ------------------------------- */

const SENTENCES = [
  'condamné à relire toute la documentation de Discord à voix haute.',
  'condamné à écrire « je ne flopperai plus » 100 fois.',
  'condamné à offrir un café virtuel à tout le serveur.',
  'condamné à changer son pseudo en « Accusé n°1 » pendant 24 h.',
  'condamné à regarder un tutoriel de 3 h sans accélérer.',
  'condamné à faire une masterclass pour se racheter.',
  'condamné à parler en vers pendant une journée.',
  'condamné à écouter la musique choisie par le tribunal.',
  'condamné à s\'excuser publiquement dans #général.',
  'condamné à porter le bonnet d\'âne virtuel jusqu\'à nouvel ordre.',
];
const pick = list => list[Math.floor(Math.random() * list.length)];

function rank(flopCount) {
  if (flopCount >= 10) return '☠️ Ennemi public n°1';
  if (flopCount >= 5) return '🚨 Multirécidiviste';
  if (flopCount >= 2) return '⚠️ Récidiviste';
  if (flopCount === 1) return '🟡 Délinquant primaire';
  return '😇 Casier vierge';
}

const medal = i => ['🥇', '🥈', '🥉'][i] ?? `**${i + 1}.**`;

async function leaderboard(store, label) {
  const top = Object.entries(store).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!top.length) return null;
  const lines = await Promise.all(top.map(async ([id, n], i) => {
    const user = await client.users.fetch(id).catch(() => null);
    return `${medal(i)} ${user ? user.username : `<@${id}>`} : ${n} ${label}`;
  }));
  return lines.join('\n');
}

/* ----------------------------- Commandes ------------------------------ */

const userOpt = (desc, required = false) => o =>
  o.setName('utilisateur').setDescription(desc).setRequired(required);

const commands = [
  new SlashCommandBuilder().setName('addflop').setDescription('Ajoute un flop à un utilisateur.')
    .addUserOption(userOpt('L\'utilisateur à qui ajouter un flop', true)),
  new SlashCommandBuilder().setName('delflop').setDescription('Retire un flop à un utilisateur.')
    .addUserOption(userOpt('L\'utilisateur à qui retirer un flop', true)),
  new SlashCommandBuilder().setName('flops').setDescription('Affiche le nombre de flops d\'un utilisateur.')
    .addUserOption(userOpt('L\'utilisateur dont afficher les flops')),
  new SlashCommandBuilder().setName('leaderflop').setDescription('Classement des utilisateurs avec le plus de flops.'),
  new SlashCommandBuilder().setName('addmasterclass').setDescription('Ajoute une masterclass à un utilisateur.')
    .addUserOption(userOpt('L\'utilisateur à qui ajouter une masterclass', true)),
  new SlashCommandBuilder().setName('delmasterclass').setDescription('Retire une masterclass à un utilisateur.')
    .addUserOption(userOpt('L\'utilisateur à qui retirer une masterclass', true)),
  new SlashCommandBuilder().setName('masterclasses').setDescription('Affiche le nombre de masterclasses d\'un utilisateur.')
    .addUserOption(userOpt('L\'utilisateur dont afficher les masterclasses')),
  new SlashCommandBuilder().setName('masterboard').setDescription('Classement des utilisateurs avec le plus de masterclasses.'),

  // ⚖️ Fonctionnalités "The Judgement"
  new SlashCommandBuilder().setName('judge').setDescription('⚖️ Ouvre un procès : le serveur vote coupable ou innocent.')
    .addUserOption(o => o.setName('accuse').setDescription('L\'accusé').setRequired(true))
    .addStringOption(o => o.setName('motif').setDescription('Le chef d\'accusation').setRequired(true).setMaxLength(200))
    .addIntegerOption(o => o.setName('minutes').setDescription(`Durée du vote (1-${MAX_MINUTES}, défaut ${DEFAULT_MINUTES})`).setMinValue(1).setMaxValue(MAX_MINUTES)),
  new SlashCommandBuilder().setName('casier').setDescription('📂 Affiche le casier judiciaire d\'un utilisateur.')
    .addUserOption(userOpt('L\'utilisateur dont afficher le casier')),
  new SlashCommandBuilder().setName('sentence').setDescription('🔨 Le tribunal prononce une sentence aléatoire.')
    .addUserOption(userOpt('Le condamné', true)),
  new SlashCommandBuilder().setName('flopperms').setDescription('👑 (Owner) Définit les rôles pouvant utiliser /addflop et /delflop.')
    .setDMPermission(false)
    .addSubcommand(s => s.setName('ajouter').setDescription('Autorise un rôle')
      .addRoleOption(o => o.setName('role').setDescription('Le rôle à autoriser').setRequired(true)))
    .addSubcommand(s => s.setName('retirer').setDescription('Retire l\'autorisation d\'un rôle')
      .addRoleOption(o => o.setName('role').setDescription('Le rôle à retirer').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('Affiche les rôles autorisés')),
  new SlashCommandBuilder().setName('help').setDescription('Affiche la liste des commandes disponibles'),
].map(c => c.toJSON());

/* ------------------------------- Procès ------------------------------- */

const trials = new Map(); // messageId -> procès en cours
const onTrial = new Set(); // ids des utilisateurs actuellement jugés

function trialEmbed(t, { closed = false, verdict = null } = {}) {
  const guilty = [...t.votes.values()].filter(v => v === 'guilty').length;
  const innocent = t.votes.size - guilty;
  const e = new EmbedBuilder()
    .setTitle(closed ? '⚖️ Verdict du tribunal' : '⚖️ Un procès est ouvert !')
    .setColor(closed ? (verdict === 'guilty' ? '#c0392b' : '#27ae60') : COLOR)
    .setDescription(`**Accusé :** <@${t.accusedId}>\n**Chef d'accusation :** ${t.reason}\n**Procureur :** <@${t.prosecutorId}>`)
    .addFields(
      { name: '🔨 Coupable', value: `${guilty}`, inline: true },
      { name: '😇 Innocent', value: `${innocent}`, inline: true },
    );
  if (!closed) e.setFooter({ text: `Fin du vote dans ${t.minutes} min • quorum : ${QUORUM} votes` });
  return e;
}

const trialButtons = disabled => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('vote_guilty').setLabel('Coupable').setEmoji('🔨').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  new ButtonBuilder().setCustomId('vote_innocent').setLabel('Innocent').setEmoji('😇').setStyle(ButtonStyle.Success).setDisabled(disabled),
);

async function closeTrial(messageId) {
  const t = trials.get(messageId);
  if (!t) return;
  trials.delete(messageId);
  onTrial.delete(t.accusedId);

  const guilty = [...t.votes.values()].filter(v => v === 'guilty').length;
  const innocent = t.votes.size - guilty;

  let verdict, text;
  if (t.votes.size < QUORUM) {
    verdict = 'void';
    text = `🗂️ **Affaire classée sans suite** : seulement ${t.votes.size} vote(s) sur ${QUORUM} requis.`;
  } else if (guilty > innocent) {
    verdict = 'guilty';
    const total = adjust(flops, 'flops.json', t.accusedId, 1);
    const r = record(t.accusedId); r.trials++; r.guilty++;
    text = `🔨 **COUPABLE** (${guilty} contre ${innocent}). <@${t.accusedId}> reçoit un flop (total : ${total}) et est ${pick(SENTENCES)}`;
  } else if (innocent > guilty) {
    verdict = 'innocent';
    const r = record(t.accusedId); r.trials++; r.acquitted++;
    text = `😇 **INNOCENT** (${innocent} contre ${guilty}). <@${t.accusedId}> est relaxé·e. Le tribunal s'excuse pour le dérangement.`;
  } else {
    verdict = 'tie';
    const r = record(t.accusedId); r.trials++; r.acquitted++;
    text = `⚖️ **ÉGALITÉ** (${guilty} - ${innocent}). Le doute profite à l'accusé : <@${t.accusedId}> est relaxé·e.`;
  }
  record(t.prosecutorId).accusations++;
  save('casier.json', casier);

  try {
    const channel = await client.channels.fetch(t.channelId);
    const message = await channel.messages.fetch(messageId);
    await message.edit({ embeds: [trialEmbed(t, { closed: true, verdict })], components: [trialButtons(true)] });
    await channel.send({ content: text, allowedMentions: { users: [t.accusedId] } });
  } catch (err) {
    console.error('Impossible de publier le verdict :', err);
  }
}

/* ----------------------------- Interactions --------------------------- */

const ephemeral = content => ({ content, ephemeral: true });

client.once(Events.ClientReady, async () => {
  console.log(`✅ ${client.user.username} est connecté!`);
  client.user.setActivity('appliquer les sentences');
  try {
    await client.application.commands.set(commands);
    console.log('✅ Les slash commands ont bien été initialisées !');
  } catch (err) {
    console.error(err);
  }
});

async function onButton(interaction) {
  const t = trials.get(interaction.message.id);
  if (!t) return interaction.reply(ephemeral('Ce procès est terminé.'));
  if (interaction.user.id === t.accusedId) {
    return interaction.reply(ephemeral('🚫 L\'accusé ne peut pas voter à son propre procès.'));
  }
  const vote = interaction.customId === 'vote_guilty' ? 'guilty' : 'innocent';
  t.votes.set(interaction.user.id, vote);
  await interaction.update({ embeds: [trialEmbed(t)] });
}

async function onCommand(interaction) {
  const { commandName: cmd, options } = interaction;
  const user = options.getUser('utilisateur') ?? interaction.user;

  if ((cmd === 'addflop' || cmd === 'delflop') && !canManageFlops(interaction)) {
    return interaction.reply(ephemeral('🚫 Tu n\'as pas le rôle nécessaire pour utiliser cette commande.'));
  }

  switch (cmd) {
    case 'flopperms': {
      if (interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply(ephemeral('👑 Seul le propriétaire du serveur peut configurer ces rôles.'));
      }
      const conf = (config[interaction.guildId] ??= { flopRoles: [] });
      const sub = options.getSubcommand();
      if (sub === 'liste') {
        return interaction.reply({
          content: conf.flopRoles.length
            ? `Rôles autorisés : ${conf.flopRoles.map(id => `<@&${id}>`).join(', ')} (+ owner et administrateurs)`
            : 'Aucun rôle configuré. Le owner et les administrateurs peuvent toujours utiliser /addflop et /delflop.',
          ephemeral: true, allowedMentions: { parse: [] },
        });
      }
      const role = options.getRole('role');
      if (sub === 'ajouter') {
        if (!conf.flopRoles.includes(role.id)) conf.flopRoles.push(role.id);
      } else {
        conf.flopRoles = conf.flopRoles.filter(id => id !== role.id);
      }
      save('config.json', config);
      return interaction.reply({
        content: sub === 'ajouter' ? `✅ ${role} peut maintenant utiliser /addflop et /delflop.` : `✅ ${role} ne peut plus utiliser /addflop et /delflop.`,
        allowedMentions: { parse: [] },
      });
    }
    case 'addflop': {
      const n = adjust(flops, 'flops.json', user.id, 1);
      return interaction.reply(`Un flop a été ajouté à ${user.username} (total : ${n}) ! Faites </leaderflop:1101528609405014220> pour afficher le classement !`);
    }
    case 'delflop': {
      if (!flops[user.id]) return interaction.reply(`${user.username} n'a aucun flop à retirer.`);
      const n = adjust(flops, 'flops.json', user.id, -1);
      return interaction.reply(`Un flop a été retiré à ${user.username} (total : ${n}) !`);
    }
    case 'flops':
      return interaction.reply(`${user.tag} a ${flops[user.id] || 0} flop(s) — ${rank(flops[user.id] || 0)}`);
    case 'leaderflop': {
      const board = await leaderboard(flops, 'flop(s)');
      return interaction.reply(board ? `🏴 **Classement des flops**\n${board}` : 'Il n\'y a aucun flop enregistré pour l\'instant.');
    }
    case 'addmasterclass': {
      const n = adjust(masterclasses, 'masterclasses.json', user.id, 1);
      return interaction.reply(`Une masterclass a été ajoutée à ${user.username} (total : ${n}) ! Faites </masterboard:1125898031401799735> pour afficher le classement !`);
    }
    case 'delmasterclass': {
      if (!masterclasses[user.id]) return interaction.reply(`${user.username} n'a aucune masterclass à retirer.`);
      const n = adjust(masterclasses, 'masterclasses.json', user.id, -1);
      return interaction.reply(`Une masterclass a été retirée à ${user.username} (total : ${n}) !`);
    }
    case 'masterclasses':
      return interaction.reply(`${user.tag} a ${masterclasses[user.id] || 0} masterclass(es)`);
    case 'masterboard': {
      const board = await leaderboard(masterclasses, 'masterclass(es)');
      return interaction.reply(board ? `🎓 **Classement des masterclasses**\n${board}` : 'Il n\'y a aucune masterclass enregistrée pour l\'instant.');
    }

    case 'judge': {
      const accused = options.getUser('accuse');
      const reason = options.getString('motif');
      const minutes = options.getInteger('minutes') ?? DEFAULT_MINUTES;
      if (accused.bot) return interaction.reply(ephemeral('🤖 Les bots sont au-dessus des lois.'));
      if (accused.id === interaction.user.id) return interaction.reply(ephemeral('Tu ne peux pas t\'accuser toi-même... enfin, pas ici.'));
      if (onTrial.has(accused.id)) return interaction.reply(ephemeral('⏳ Cet utilisateur est déjà jugé en ce moment.'));

      const t = { accusedId: accused.id, prosecutorId: interaction.user.id, reason, minutes, channelId: interaction.channelId, votes: new Map() };
      onTrial.add(accused.id);
      const message = await interaction.reply({
        embeds: [trialEmbed(t)], components: [trialButtons(false)], fetchReply: true,
        allowedMentions: { users: [accused.id] },
      });
      trials.set(message.id, t);
      setTimeout(() => closeTrial(message.id), minutes * 60 * 1000);
      return;
    }
    case 'casier': {
      const r = casier[user.id] || { trials: 0, guilty: 0, acquitted: 0, accusations: 0 };
      const embed = new EmbedBuilder()
        .setTitle(`📂 Casier judiciaire de ${user.username}`)
        .setThumbnail(user.displayAvatarURL())
        .setColor(COLOR)
        .setDescription(`**Statut :** ${rank(flops[user.id] || 0)}`)
        .addFields(
          { name: '🏴 Flops', value: `${flops[user.id] || 0}`, inline: true },
          { name: '🎓 Masterclasses', value: `${masterclasses[user.id] || 0}`, inline: true },
          { name: '⚖️ Procès subis', value: `${r.trials}`, inline: true },
          { name: '🔨 Condamnations', value: `${r.guilty}`, inline: true },
          { name: '😇 Acquittements', value: `${r.acquitted}`, inline: true },
          { name: '📢 Accusations portées', value: `${r.accusations}`, inline: true },
        );
      return interaction.reply({ embeds: [embed] });
    }
    case 'sentence': {
      if (user.bot) return interaction.reply(ephemeral('🤖 Les bots sont au-dessus des lois.'));
      return interaction.reply({ content: `🔨 Le tribunal a rendu sa décision : ${user} est ${pick(SENTENCES)}`, allowedMentions: { users: [user.id] } });
    }
    case 'help': {
      const embed = new EmbedBuilder()
        .setTitle('Liste des commandes')
        .setThumbnail('https://cdn.discordapp.com/avatars/1100567736981139486/aacd03f9b319c9815bdebf9d54a86b42?size=1024')
        .setColor(COLOR)
        .setDescription([
          '**⚖️ Tribunal**',
          '/judge : Ouvrir un procès (vote coupable / innocent, coupable = +1 flop)',
          '/casier : Voir le casier judiciaire d\'un utilisateur',
          '/sentence : Prononcer une sentence aléatoire',
          '',
          '**🏴 Flops**',
          '/addflop, /delflop : Ajouter / retirer un flop (rôles définis par le owner)',
          '/flopperms : (Owner) Choisir les rôles autorisés pour /addflop et /delflop',
          '/flops : Afficher les flops d\'un utilisateur',
          '/leaderflop : Top 10 des flops',
          '',
          '**🎓 Masterclasses**',
          '/addmasterclass, /delmasterclass : Ajouter / retirer une masterclass',
          '/masterclasses : Afficher les masterclasses d\'un utilisateur',
          '/masterboard : Top 10 des masterclasses',
        ].join('\n'));
      return interaction.reply({ embeds: [embed] });
    }
  }
}

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isButton()) await onButton(interaction);
    else if (interaction.isChatInputCommand()) await onCommand(interaction);
  } catch (err) {
    console.error(err);
    const msg = ephemeral('Une erreur est survenue.');
    if (interaction.replied || interaction.deferred) interaction.followUp(msg).catch(() => {});
    else interaction.reply(msg).catch(() => {});
  }
});

if (require.main === module) client.login(token);
module.exports = { rank, adjust };
