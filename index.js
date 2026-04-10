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
            // Using a free API (nekos.best) to get completely random gifs WITHOUT needing an API key!
            const reactions = ['wave', 'wink', 'tease', 'smug', 'smile', 'slap', 'shoot', 'shrug', 'punch', 'poke', 'pat', 'nom', 'nod', 'neko', 'laugh', 'kiss', 'kick', 'hug', 'happy', 'dance', 'cuddle', 'cry', 'blush', 'bored', 'bite', 'baka'];
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
            const response = await axios.get(`https://nekos.best/api/v2/${randomReaction}`);
            const gifUrl = response.data.results[0].url;
            
            await interaction.editReply(gifUrl);
        } catch (error) {
            console.error('GIF API Error:', error.message);
            await interaction.editReply('❌ Failed to fetch GIF. Try again! (Check console for details)');
        }
    }
});

client.login(token);
