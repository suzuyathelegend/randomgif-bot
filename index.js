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
            // Massive list of varied subreddits: anime, real life, funny, completely unfiltered NSFW/ecchi
            const subreddits = [
                'gifs', 'animegifs', 'HighQualityGifs', 'wheredidthesodago', 'wastedgifs', 
                'BetterEveryLoop', 'Unexpected', 'holdmycosmo', 'holdmybeer', 'IdiotsInCars',
                'CatGifs', 'reactiongifs', 'shitposting', 'dankmemes', 'WTF', 'animemes', 'goodanimemes',
                'nsfw_gif', 'ecchi', 'hentai_gif', 'rule34', 'RealGirls', 'nsfw', 'gifsgonewild', 'asiansgonewild', 'holdthemoan'
            ];
            
            // Pick 1 random subreddit for this request so it forces Meme API to give fresh results
            const randomSub = subreddits[Math.floor(Math.random() * subreddits.length)];

            // Bust cache with Date.now() so we don't get stuck on the same Cloudflare cache!
            const response = await axios.get(`https://meme-api.com/gimme/${randomSub}/50?_t=${Date.now()}`);
            
            // Reddit "gifs" are often hosted as .mp4 or .gifv nowadays. Discord embeds these seamlessly.
            // If we only look for ".gif", we might only find 1 match per 50 posts, resulting in the EXACT SAME loop.
            const validMedia = response.data.memes.filter(m => {
                const url = m.url.toLowerCase();
                return url.endsWith('.gif') || url.endsWith('.gifv') || url.endsWith('.mp4') || url.endsWith('.webm');
            });
            
            // Pick a completely random media file from the filtered list.
            const poolToPickFrom = validMedia.length > 0 ? validMedia : response.data.memes;
            const randomChoice = poolToPickFrom[Math.floor(Math.random() * poolToPickFrom.length)];
            
            const gifUrl = randomChoice.url;

            await interaction.editReply(gifUrl);
        } catch (error) {
            console.error('GIF API Error:', error.message);
            await interaction.editReply('❌ Failed to fetch GIF. Try again! (Check console for details)');
        }
    }
});

client.login(token);

