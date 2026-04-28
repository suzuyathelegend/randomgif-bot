const { Client, IntentsBitField } = require('discord.js');
const axios = require('axios');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

const token = process.env.token;

const ALLOWED_USERS = new Set([
    '1172816141832421399',
    '1368245007177351300',
]);

const recentGifsSet = new Set();
const recentGifsQueue = [];
const MAX_HISTORY_SIZE = 800;

const recentCoolSet = new Set();
const recentCoolQueue = [];
const MAX_COOL_HISTORY = 800;

// ─── Subreddits for meme-api (100% GIFs) ─────────────────────────────────────
const CDN_SUBREDDITS = [
    'reactiongifs', 'HighQualityGifs', 'perfectloops', 'bettereveryloop',
    'catgifs', 'dogegifs', 'AnimalsBeingDerps', 'AnimalsBeingBros',
    'physicsgifs', 'educationalgifs', 'mechanicalgifs', 'chemicalreactiongifs',
    'woahdude', 'oddlysatisfying', 'gifsthatendtoosoon',
    'animegifs', 'hentai_gifs', 'NSFW_GIF', 'nsfwgif', 'gif',
];

// Uses meme-api.com to bypass Reddit's aggressive rate-limiting on Railway
async function fetchRedditGif(subreddit) {
    const res = await axios.get(`https://meme-api.com/gimme/${subreddit}/50`, {
        timeout: 8000
    });
    
    const posts = res.data?.memes || [];
    const gifPosts = posts.filter(p => p.url && p.url.toLowerCase().endsWith('.gif'));
    
    if (!gifPosts.length) return null;
    const shuffled = [...gifPosts].sort(() => Math.random() - 0.5);
    return shuffled[0].url;
}

// ─── Rule34/Hentai Subreddits for randomcool ───────────────────────────────────
const COOL_SUBREDDITS = [
    'rule34', 'hentai_gif', 'Hentai', 'Overwatch_Porn', 
    'GenshinImpactHentai', 'tentai', 'futanari', 'yuri'
];

client.on('ready', () => console.log(`✅ Logged in as ${client.user.tag}`));

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!ALLOWED_USERS.has(interaction.user.id))
        return interaction.reply({ content: '🚫 This bot is private.', ephemeral: true });

    // ── /randomcdn ─────────────────────────────────────────────────────────────
    if (interaction.commandName === 'randomcdn') {
        await interaction.deferReply();
        try {
            let finalGifUrl = null;
            for (let attempt = 0; attempt < 15 && !finalGifUrl; attempt++) {
                const sub = CDN_SUBREDDITS[Math.floor(Math.random() * CDN_SUBREDDITS.length)];
                console.log(`🎲 Attempt ${attempt + 1}: r/${sub}`);
                try {
                    const url = await fetchRedditGif(sub);
                    if (url && !recentGifsSet.has(url)) {
                        finalGifUrl = url;
                        console.log(`✅ ${url}`);
                    }
                } catch (e) { console.log(`⚠️ r/${sub} error: ${e.message}`); }
            }
            if (!finalGifUrl) throw new Error('No valid GIFs found.');
            recentGifsSet.add(finalGifUrl);
            recentGifsQueue.push(finalGifUrl);
            if (recentGifsQueue.length > MAX_HISTORY_SIZE) recentGifsSet.delete(recentGifsQueue.shift());
            await interaction.editReply(finalGifUrl);
        } catch (e) {
            console.error('/randomcdn failed:', e.message);
            await interaction.editReply('❌ Failed to fetch GIF. Try again!');
        }
    }

    // ── /randomcool ────────────────────────────────────────────────────────────
    if (interaction.commandName === 'randomcool') {
        await interaction.deferReply();
        try {
            let finalGifUrl = null;
            for (let attempt = 0; attempt < 15 && !finalGifUrl; attempt++) {
                const sub = COOL_SUBREDDITS[Math.floor(Math.random() * COOL_SUBREDDITS.length)];
                console.log(`🔞 Attempt ${attempt + 1}: r/${sub}`);
                try {
                    const url = await fetchRedditGif(sub);
                    if (url && !recentCoolSet.has(url)) {
                        finalGifUrl = url;
                        console.log(`✅ ${url}`);
                    }
                } catch (e) { console.log(`⚠️ r/${sub} error: ${e.message}`); }
            }
            if (!finalGifUrl) throw new Error('No valid GIFs found.');
            recentCoolSet.add(finalGifUrl);
            recentCoolQueue.push(finalGifUrl);
            if (recentCoolQueue.length > MAX_COOL_HISTORY) recentCoolSet.delete(recentCoolQueue.shift());
            await interaction.editReply(finalGifUrl);
        } catch (e) {
            console.error('/randomcool failed:', e.message);
            await interaction.editReply('❌ Failed to fetch rule34 GIF. Try again!');
        }
    }
});

// ─── Prefix commands ──────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!ALLOWED_USERS.has(message.author.id)) return;
    const content = message.content.trim().toLowerCase();

    if (content === '$r34') {
        let timer;
        try {
            timer = setInterval(() => message.channel.sendTyping(), 5000);
            message.channel.sendTyping();
            let finalGifUrl = null;
            for (let i = 0; i < 15 && !finalGifUrl; i++) {
                const sub = COOL_SUBREDDITS[Math.floor(Math.random() * COOL_SUBREDDITS.length)];
                try {
                    const url = await fetchRedditGif(sub);
                    if (url && !recentCoolSet.has(url)) finalGifUrl = url;
                } catch (e) { console.log(`⚠️ [$r34] error: ${e.message}`); }
            }
            if (!finalGifUrl) throw new Error('No valid GIFs found.');
            recentCoolSet.add(finalGifUrl);
            recentCoolQueue.push(finalGifUrl);
            if (recentCoolQueue.length > MAX_COOL_HISTORY) recentCoolSet.delete(recentCoolQueue.shift());
            clearInterval(timer);
            await message.reply(finalGifUrl);
        } catch (e) {
            clearInterval(timer);
            await message.reply('❌ Failed. Try again!');
        }
        return;
    }

    if (content === '$random') {
        let timer;
        try {
            timer = setInterval(() => message.channel.sendTyping(), 5000);
            message.channel.sendTyping();
            let finalGifUrl = null;
            for (let i = 0; i < 15 && !finalGifUrl; i++) {
                const sub = CDN_SUBREDDITS[Math.floor(Math.random() * CDN_SUBREDDITS.length)];
                try {
                    const url = await fetchRedditGif(sub);
                    if (url && !recentGifsSet.has(url)) finalGifUrl = url;
                } catch (e) { console.log(`⚠️ [$random] error: ${e.message}`); }
            }
            if (!finalGifUrl) throw new Error('No valid GIFs found.');
            recentGifsSet.add(finalGifUrl);
            recentGifsQueue.push(finalGifUrl);
            if (recentGifsQueue.length > MAX_HISTORY_SIZE) recentGifsSet.delete(recentGifsQueue.shift());
            clearInterval(timer);
            await message.reply(finalGifUrl);
        } catch (e) {
            clearInterval(timer);
            await message.reply('❌ Failed. Try again!');
        }
        return;
    }
});

client.login(token);
