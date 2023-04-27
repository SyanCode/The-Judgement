const flopCounts = require('./flopCounts.json');
const { Client, Intents } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const dotenv = require('dotenv'); require('dotenv').config();
const fs = require('fs');

const application_id = `${process.env['CLIENT_ID']}`;
const guild_id = `${process.env['GUILD_ID']}`;
const token = `${process.env['TOKEN']}`;

const commands = [
  {
    name: 'addflop',
    description: 'Ajoute un flop à un utilisateur.',
    options: [
      {
        name: 'utilisateur',
        description: 'L\'utilisateur à qui ajouter un flop.',
        type: 6,
        required: true,
      },
    ],
  },
  {
    name: 'delflop',
    description: 'Supprime un flop à un utilisateur.',
    options: [
      {
        name: 'utilisateur',
        description: 'L\'utilisateur à qui supprimer un flop.',
        type: 6,
        required: true,
      },
    ],
  },
  {
    name: 'leaderflop',
    description: 'Affiche le classement des utilisateurs avec le plus de flops.',
  },
  {
    name: 'flops',
    description: 'Affiche le nombre de flops d\'un utilisateur.',
    options: [
      {
        name: 'utilisateur',
        description: 'L\'utilisateur dont vous voulez connaître le nombre de flops.',
        type: 6,
        required: true,
      },
    ],
  },
];

const client = new Client({ intents: 3243773 });
const rest = new REST({ version: '9' }).setToken(token);

client.on('ready', async () => {
  console.log(`✅ ${client.user.tag} est connecté!`);
  client.user.setActivity('observer son déploiement!');

  try {
    await rest.put(
      Routes.applicationGuildCommands(application_id, guild_id),
      { body: commands },
    );

    console.log('✅ Les slash commands ont bien été initialisées !');
  } catch (error) {
    console.error(error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'addflop') {
    const user = options.getUser('utilisateur');
    if (!user) return interaction.reply('Merci de mentionner un utilisateur.');
  
    // Ajouter un flop à l'utilisateur ici
    const userFlopCount = flopCounts.get(user.id) || 0;
    flopCounts.set(user.id, userFlopCount + 1);
  
    fs.writeFile('flopCounts.json', JSON.stringify([...flopCounts]), (err) => {
      if (err) throw err;
      console.log('Flop counts saved to file.');
    });
  
    interaction.reply(`${user} a maintenant un flop de plus ! Faites /leaderflop pour afficher le classement !`);
  }

  if (commandName === 'delflop') {
    const user = options.getUser('utilisateur');
    const guild = client.guilds.cache.get(guild_id);
    const member = guild.members.cache.get(user)
    if (!user) return interaction.reply('Merci de mentionner un utilisateur.');
  
    // Supprimer un flop à l'utilisateur ici
    const userFlopCount = flopCounts.get(user.id) || 0;
    if (userFlopCount > 0) {
      flopCounts.set(user.id, userFlopCount - 1);
      fs.writeFile('flopCounts.json', JSON.stringify([...flopCounts]), (err) => {
        if (err) throw err;
        console.log('Flop counts saved to file.');
      });
      interaction.reply(`${user} a maintenant un flop de moins ! Faites /leaderflop pour afficher le classement !`);
    } else {
      interaction.reply(`${user} n'a pas de flops à retirer.`);
    }
  }

  if (commandName === 'leaderflop') {
    // Afficher le classement des utilisateurs avec le plus de flops ici
    const sortedFlopCounts = Object.entries(flopCounts).sort((a, b) => b[1] - a[1]);

    if (sortedFlopCounts.length === 0) {
      interaction.reply('Personne n\'a de flop pour le moment.');
    } else {
      const topFlopUsers = sortedFlopCounts.slice(0, 10);
      const response = topFlopUsers.map((user, index) => `${index + 1}. ${user[0]} - ${user[1]} flops`).join('\n');
      interaction.reply(`Voici le classement des utilisateurs avec le plus de flops :\n${response}`);
    }
  }

  if (commandName === 'flops') {
    const user = options.getUser('utilisateur');
    if (!user) return interaction.reply('Merci de mentionner un utilisateur.');
    const userFlopCount = flopCounts[user.id] || 0;
    interaction.reply(`${user} a ${userFlopCount} flops.`);
  }
});


client.login(token);

module.exports = { flopCounts };