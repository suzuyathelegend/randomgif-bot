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

// ─── Reddit subreddits for /randomcdn ────────────────────────────────────────
const CDN_SUBREDDITS = [
    'gifs', 'funny', 'reactiongifs', 'perfectlycutscreams', 'nonononoyes',
    'unexpected', 'instantregret', 'therewasanattempt', 'killthecameraman',
    'whatcouldgowrong', 'gifsthatendtoosoon', 'bettereveryloop', 'perfectloops',
    'highqualitygifs', 'mildlyinteresting', 'damnthatsinteresting',
    'aww', 'AnimalsBeingDerps', 'AnimalsBeingBros', 'WhatsWrongWithYourCat',
    'WhatsWrongWithYourDog', 'birdsbeingdicks', 'oddlysatisfying', 'woahdude',
    'nextfuckinglevel', 'educationalgifs', 'physicsgifs', 'gaming', 'HolUp',
    'animegifs', 'anime', 'animememes',
    'NSFW_GIF', 'nsfwgif', 'hentai_gifs',
];

// Fetches only actual .gif URLs from Reddit — no videos, no mp4
async function fetchRedditGif(subreddit) {
    const sorts = ['hot', 'new', 'top'];
    const sort = sorts[Math.floor(Math.random() * sorts.length)];
    const times = ['day', 'week', 'month', 'all'];
    const t = times[Math.floor(Math.random() * times.length)];

    const res = await axios.get(
        `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=100&t=${t}`,
        { headers: { 'User-Agent': 'randomgif-discord-bot/1.0' }, timeout: 8000 }
    );

    const posts = (res.data?.data?.children ?? []).filter(p => {
        const d = p.data;
        if (d.is_self || d.stickied || d.is_video) return false;
        const u = (d.url ?? '').toLowerCase();
        return u.endsWith('.gif'); // strict: only real GIF files
    });

    if (!posts.length) return null;
    const shuffled = [...posts].sort(() => Math.random() - 0.5);
    return shuffled[0]?.data?.url ?? null;
}

// ─── Rule34.xxx tag pool (drawn/animated only — no IRL) ──────────────────────
const RULE34_POOL = [
    // Characters
    'hinata_hyuga', 'tsunade', 'sakura_haruno', 'temari',
    'yoruichi_shihoin', 'rangiku_matsumoto',
    'nami', 'nico_robin', 'boa_hancock',
    'android_18', 'bulma', 'caulifla',
    'mikasa_ackerman', 'historia_reiss',
    'nezuko_kamado', 'mitsuri_kanroji',
    'momo_yaoyorozu', 'mirko', 'toga_himiko',
    'asuna_(sao)', 'sinon_(sao)',
    'erza_scarlet', 'lucy_heartfilia', 'mirajane_strauss',
    'rem_(re:zero)', 'emilia_(re:zero)',
    'zero_two',
    'tracer_(overwatch)', 'dva_(overwatch)', 'mercy_(overwatch)',
    'ganyu_(genshin_impact)', 'hu_tao_(genshin_impact)', 'raiden_shogun',
    'ahri', 'jinx_(league_of_legends)', 'miss_fortune_(league_of_legends)',
    'tifa_lockhart', 'aerith_gainsborough',
    'zelda', 'samus_aran', 'chun-li', 'cammy_white', 'mai_shiranui',
    'gardevoir', 'lopunny',
    // Acts
    'fellatio', 'anal', 'creampie', 'doggystyle', 'cowgirl_position',
    'paizuri', 'handjob', 'gangbang', 'threesome', 'bondage', 'tentacles',
    // Types / styles
    'futanari', 'femboy', 'yaoi', 'yuri',
    'maid', 'bunnysuit', 'stockings',
    // Series
    'naruto', 'bleach_(series)', 'one_piece', 'dragon_ball',
    'boku_no_hero_academia', 'sword_art_online', 'fairy_tail',
    'kimetsu_no_yaiba', 'jujutsu_kaisen_(series)',
];

function pickRule34Tags(count = 2) {
    return [...RULE34_POOL].sort(() => Math.random() - 0.5).slice(0, count);
}

// Fetches a GIF from Rule34.xxx — 100% drawn/animated, no IRL content
async function fetchRule34Gif() {
    const tags = pickRule34Tags(Math.random() < 0.5 ? 1 : 2);
    const tagString = [...tags, 'animated'].join('+');
    const randomPid = Math.floor(Math.random() * 50);

    const response = await axios.get('https://rule34.xxx/index.php', {
        params: { page: 'dapi', s: 'post', q: 'index', json: 1, tags: tagString, limit: 100, pid: randomPid },
        timeout: 10000,
        headers: { 'User-Agent': 'randomgif-discord-bot/1.0' },
    });

    const posts = response.data;
    if (!Array.isArray(posts) || !posts.length) return null;

    // Only return actual .gif files
    const gifPosts = posts.filter(p => p.file_url?.toLowerCase().endsWith('.gif'));
    if (!gifPosts.length) return null;

    const shuffled = [...gifPosts].sort(() => Math.random() - 0.5);
    return shuffled[0]?.file_url ?? null;
}

client.on('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (!ALLOWED_USERS.has(interaction.user.id)) {
        return interaction.reply({ content: '🚫 This bot is private.', ephemeral: true });
    }

    // ── /randomcdn ─────────────────────────────────────────────────────────────
    if (interaction.commandName === 'randomcdn') {
        await interaction.deferReply();
        try {
            let finalGifUrl = null;
            const MAX_ATTEMPTS = 10;

            for (let attempt = 0; attempt < MAX_ATTEMPTS && !finalGifUrl; attempt++) {
                const subreddit = CDN_SUBREDDITS[Math.floor(Math.random() * CDN_SUBREDDITS.length)];
                console.log(`🎲 Attempt ${attempt + 1}: r/${subreddit}`);
                try {
                    const url = await fetchRedditGif(subreddit);
                    if (!url) { console.log(`⚠️ No GIFs in r/${subreddit}`); continue; }
                    if (!recentGifsSet.has(url)) {
                        finalGifUrl = url;
                        console.log(`✅ Found: ${url}`);
                    }
                } catch (e) {
                    console.log(`⚠️ Reddit error (attempt ${attempt + 1}): ${e.message}`);
                }
            }

            if (!finalGifUrl) throw new Error('No valid GIFs found.');

            recentGifsSet.add(finalGifUrl);
            recentGifsQueue.push(finalGifUrl);
            if (recentGifsQueue.length > MAX_HISTORY_SIZE) recentGifsSet.delete(recentGifsQueue.shift());

            await interaction.editReply(finalGifUrl);
        } catch (error) {
            console.error('/randomcdn failed:', error.message);
            await interaction.editReply('❌ Failed to fetch GIF. Try again!');
        }
    }

    // ── /randomcool ────────────────────────────────────────────────────────────
    if (interaction.commandName === 'randomcool') {
        await interaction.deferReply();
        try {
            let finalGifUrl = null;
            let fallbackUrl = null;
            const MAX_ATTEMPTS = 8;

            for (let attempt = 0; attempt < MAX_ATTEMPTS && !finalGifUrl; attempt++) {
                const tags = pickRule34Tags(Math.random() < 0.5 ? 1 : 2);
                console.log(`🔞 Attempt ${attempt + 1}: Rule34 tags: ${tags.join(', ')}`);
                try {
                    const url = await fetchRule34Gif();
                    if (!url) { console.log(`⚠️ No GIFs returned`); continue; }
                    if (!recentCoolSet.has(url)) {
                        finalGifUrl = url;
                        console.log(`✅ Found rule34 GIF: ${url}`);
                    } else if (!fallbackUrl) {
                        fallbackUrl = url;
                    }
                } catch (e) {
                    console.log(`⚠️ Rule34 error (attempt ${attempt + 1}): ${e.message}`);
                }
            }

            if (!finalGifUrl && fallbackUrl) finalGifUrl = fallbackUrl;
            if (!finalGifUrl) throw new Error('No valid rule34 GIFs found.');

            recentCoolSet.add(finalGifUrl);
            recentCoolQueue.push(finalGifUrl);
            if (recentCoolQueue.length > MAX_COOL_HISTORY) recentCoolSet.delete(recentCoolQueue.shift());

            await interaction.editReply(finalGifUrl);
        } catch (error) {
            console.error('/randomcool failed:', error.message);
            await interaction.editReply('❌ Failed to fetch rule34 GIF. Try again!');
        }
    }
});

// ─── Prefix commands ──────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!ALLOWED_USERS.has(message.author.id)) return;

    const content = message.content.trim().toLowerCase();

    // $r34 — same as /randomcool
    if (content === '$r34') {
        let typingInterval;
        try {
            typingInterval = setInterval(() => message.channel.sendTyping(), 5000);
            message.channel.sendTyping();

            let finalGifUrl = null;
            let fallbackUrl = null;
            const MAX_ATTEMPTS = 8;

            for (let attempt = 0; attempt < MAX_ATTEMPTS && !finalGifUrl; attempt++) {
                try {
                    const url = await fetchRule34Gif();
                    if (!url) continue;
                    if (!recentCoolSet.has(url)) {
                        finalGifUrl = url;
                    } else if (!fallbackUrl) {
                        fallbackUrl = url;
                    }
                } catch (e) {
                    console.log(`⚠️ [$r34] error (attempt ${attempt + 1}): ${e.message}`);
                }
            }

            if (!finalGifUrl && fallbackUrl) finalGifUrl = fallbackUrl;
            if (!finalGifUrl) throw new Error('No valid GIFs found.');

            recentCoolSet.add(finalGifUrl);
            recentCoolQueue.push(finalGifUrl);
            if (recentCoolQueue.length > MAX_COOL_HISTORY) recentCoolSet.delete(recentCoolQueue.shift());

            clearInterval(typingInterval);
            await message.reply(finalGifUrl);
        } catch (error) {
            clearInterval(typingInterval);
            console.error('[$r34] failed:', error.message);
            await message.reply('❌ Failed to fetch rule34 GIF. Try again!');
        }
        return;
    }

    // $random — same as /randomcdn
    if (content === '$random') {
        let typingInterval;
        try {
            typingInterval = setInterval(() => message.channel.sendTyping(), 5000);
            message.channel.sendTyping();

            let finalGifUrl = null;
            const MAX_ATTEMPTS = 10;

            for (let attempt = 0; attempt < MAX_ATTEMPTS && !finalGifUrl; attempt++) {
                const subreddit = CDN_SUBREDDITS[Math.floor(Math.random() * CDN_SUBREDDITS.length)];
                try {
                    const url = await fetchRedditGif(subreddit);
                    if (url && !recentGifsSet.has(url)) finalGifUrl = url;
                } catch (e) {
                    console.log(`⚠️ [$random] error (attempt ${attempt + 1}): ${e.message}`);
                }
            }

            if (!finalGifUrl) throw new Error('No valid GIFs found.');

            recentGifsSet.add(finalGifUrl);
            recentGifsQueue.push(finalGifUrl);
            if (recentGifsQueue.length > MAX_HISTORY_SIZE) recentGifsSet.delete(recentGifsQueue.shift());

            clearInterval(typingInterval);
            await message.reply(finalGifUrl);
        } catch (error) {
            clearInterval(typingInterval);
            console.error('[$random] failed:', error.message);
            await message.reply('❌ Failed to fetch GIF. Try again!');
        }
        return;
    }
});

client.login(token);
