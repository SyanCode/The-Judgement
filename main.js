const Discord = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const dotenv = require('dotenv'); require('dotenv').config();
const fs = require('fs');
const { EmbedBuilder } = require('discord.js')

const client = new Discord.Client({ intents: 3243773 });
const commands = [];

const application_id = `${process.env['CLIENT_ID']}`;
const guild_id = `${process.env['GUILD_ID']}`;
const token = `${process.env['TOKEN']}`;

const flops = require('./flops.json');
const masterclasses = require('./masterclasses.json');

client.on('ready', () => {
  console.log(`✅ ${client.user.username} est connecté!`);
  client.user.setActivity('appliquer les sentences');

  const addFlopCommand = new SlashCommandBuilder()
    .setName('addflop')
    .setDescription('Ajoute un flop à un utilisateur.')
    .addUserOption(option => 
      option.setName('utilisateur')
      .setDescription('L\'utilisateur à qui ajouter un flop')
      .setRequired(true)
    );

  const delFlopCommand = new SlashCommandBuilder()
    .setName('delflop')
    .setDescription('Retire un flop à un utilisateur.')
    .addUserOption(option => 
      option.setName('utilisateur')
      .setDescription('L\'utilisateur à qui retirer un flop')
      .setRequired(true)
    );

  const flopsCommand = new SlashCommandBuilder()
    .setName('flops')
    .setDescription('Affiche le nombre de flops de l\'utilisateur.')
    .addUserOption(option => 
      option.setName('utilisateur')
      .setDescription('L\'utilisateur dont afficher les flops')
    );

  const leaderFlopCommand = new SlashCommandBuilder()
    .setName('leaderflop')
    .setDescription('Affiche le classement des utilisateurs avec le plus de flops.');

  const helpCommand = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche la liste des commandes disponibles');

  const addMasterclassCommand = new SlashCommandBuilder()
    .setName('addmasterclass')
    .setDescription('Ajoute une masterclass à un utilisateur.')
    .addUserOption(option => 
      option.setName('utilisateur')
      .setDescription('L\'utilisateur à qui ajouter une masterclass')
      .setRequired(true)
    );

  const delMasterclassCommand = new SlashCommandBuilder()
    .setName('delmasterclass')
    .setDescription('Retire une masterclass à un utilisateur.')
    .addUserOption(option => 
      option.setName('utilisateur')
      .setDescription('L\'utilisateur à qui retirer une masterclass')
      .setRequired(true)
    );
  
  const masterclassesCommand = new SlashCommandBuilder()
    .setName('masterclasses')
    .setDescription('Affiche le nombre de masterclasses de l\'utilisateur.')
    .addUserOption(option => 
      option.setName('utilisateur')
      .setDescription('L\'utilisateur dont afficher les masterclasses')
    );

  const masterBoardCommand = new SlashCommandBuilder()
    .setName('masterboard')
    .setDescription('Affiche le classement des utilisateurs avec le plus de masterclasses.');

  commands.push(addFlopCommand.toJSON());
  commands.push(delFlopCommand.toJSON());
  commands.push(flopsCommand.toJSON());
  commands.push(leaderFlopCommand.toJSON());
  commands.push(helpCommand.toJSON());
  commands.push(addMasterclassCommand.toJSON());
  commands.push(delMasterclassCommand.toJSON());
  commands.push(masterclassesCommand.toJSON());
  commands.push(masterBoardCommand.toJSON());

  const rest = new REST({ version: '9' }).setToken(token);

  rest.put(Routes.applicationCommands(client.user.id), { body: commands })
    .then(() => console.log('✅ Les slash commands ont bien été initialisées !'))
    .catch(console.error);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'addflop') {
    const user = options.getUser('utilisateur');
    const userId = user.id;

    if (!flops[userId]) {
      flops[userId] = 1;
    } else {
      flops[userId] += 1;
    }

    fs.writeFileSync('flops.json', JSON.stringify(flops, null, 2));

    await interaction.reply(`Un flop a été ajouté à ${user.username}! Faites </leaderflop:1101528609405014220> pour afficher le classement!`);
  } else if (commandName === 'delflop') {
    const user = options.getUser('utilisateur');
    const userId = user.id;

    if (flops[userId]) {
      flops[userId] -= 1;

      if (flops[userId] === 0) {
        delete flops[userId];
      }

      fs.writeFileSync('flops.json', JSON.stringify(flops, null, 2));

      await interaction.reply(`Un flop a été retiré à ${user.username}! Faites </leaderflop:1101528609405014220> pour afficher le classement!`);
    } else {
      await interaction.reply(`${user.username} n'a aucun flop à retirer.`);
    }
  } else if (commandName === 'flops') {
    const user = options.getUser('utilisateur');
    const userId = user.id;

    const userFlops = flops[userId] || 0;

    await interaction.reply(`${user.tag} a ${userFlops} flop(s)`);
} else if (commandName === 'leaderflop') {
let leaderBoard = '';
Object.entries(flops).sort((a, b) => b[1] - a[1]).forEach(([userId, userFlops], index) => {
    const user = client.users.cache.get(userId);
  
    leaderBoard += `${index + 1}. ${user.username}: ${userFlops} flops\n`;
  });
  
  if (leaderBoard === '') {
    leaderBoard = 'Il n\'y a aucun flop enregistré pour l\'instant.';
  }
  
  await interaction.reply(`Voici le classement des flops :\n${leaderBoard}`);
} else if (commandName === 'help') {
  const embed = new EmbedBuilder()
    .setTitle('Liste des commandes')
    .setThumbnail('https://cdn.discordapp.com/avatars/1100567736981139486/aacd03f9b319c9815bdebf9d54a86b42?size=1024')
    .setDescription('Voici les commandes disponibles: \n/addflop: Ajouter un flop à un utilisateur précis  /delflop: Retirer un flop à un utilisateur précis\n/flops: Afficher les flops d\'un utilisateur précis\n/leaderflop: Afficher le leaderflop du top 10 utilisateurs avec le plus de flops\n/addmasterclass: Ajouter une masterclass à un utilisateur précis \n /delmasterclass: Retirer une masterclass à un utilisateur précis\n/masterclasses: Afficher les masterclasses d\'un utilisateur précis\n/masterboard: Afficher le masterboard du top 10 utilisateurs avec le plus de masterclasses')
    .setColor('#010039')
  interaction.reply({ embeds: [embed] });
} else if (commandName === 'addmasterclass') {
  const user = options.getUser('utilisateur');
  const userId = user.id;

  if (!masterclasses[userId]) {
    masterclasses[userId] = 1;
  } else {
    masterclasses[userId] += 1;
  }

  fs.writeFileSync('masterclasses.json', JSON.stringify(masterclasses, null, 2));

  await interaction.reply(`Une masterclass a été ajoutée à ${user.username}! Faites </masterboard:1125898031401799735> pour afficher le classement!`);
} else if (commandName === 'delmasterclass') {
  const user = options.getUser('utilisateur');
  const userId = user.id;

  if (masterclasses[userId]) {
    masterclasses[userId] -= 1;

    if (masterclasses[userId] === 0) {
      delete masterclasses[userId];
    }

    fs.writeFileSync('masterclasses.json', JSON.stringify(masterclasses, null, 2));

    await interaction.reply(`Une masterclass a été retirée à ${user.username}! Faites </masterboard:1125898031401799735> pour afficher le classement!`);
  } else {
    await interaction.reply(`${user.username} n'a aucune masterclass à retirer.`);
  }
} else if (commandName === 'masterclasses') {
  const user = options.getUser('utilisateur');
  const userId = user.id;

  const userMasterclasses = masterclasses[userId] || 0;

  await interaction.reply(`${user.tag} a ${userFlops} masterclass(es)`);
} else if (commandName === 'masterboard') {
  let masterBoard = '';
  Object.entries(masterclasses).sort((a, b) => b[1] - a[1]).forEach(([userId, userMasterclasses], index) => {
      const user = client.users.cache.get(userId);
    
      masterBoard += `${index + 1}. ${user.username}: ${userMasterclasses} masterclasses\n`;
    });
    
    if (masterBoard === '') {
      masterBoard = 'Il n\'y a aucun flop enregistré pour l\'instant.';
    }
    
    await interaction.reply(`Voici le classement des masterclasses :\n${masterBoard}`);
  }

});

client.login(token);