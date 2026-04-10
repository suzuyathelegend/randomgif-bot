const { REST, Routes } = require('discord.js');

const token = process.env.token;
const clientId = process.env.clientId; // You can also just hardcode the Client ID since it's public
const guildId = process.env.guildId;   // Guild ID is also safe to hardcode

const commands = [
  {
    name: 'randomcdn',
    description: 'Get a completely random GIF (anything goes)',
  },
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Registering slash command...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('✅ /randomcdn command registered!');
  } catch (error) {
    console.error(error);
  }
})();