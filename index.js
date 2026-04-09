const { Client, IntentsBitField } = require('discord.js');
const axios = require('axios');

const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent] });

const token = process.env.token;
const giphyApiKey = process.env.giphykey;

client.on('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'randomcdn') {
        await interaction.deferReply();
        
        try {
            const response = await axios.get('https://api.giphy.com/v1/gifs/random', {
                params: { api_key: giphyApiKey }
            });
            const gifUrl = response.data.data.url;
            await interaction.editReply(gifUrl);
        } catch (error) {
            await interaction.editReply('❌ Failed to fetch GIF. Try again!');
        }
    }
});

client.login(token);
