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

// ─── Subreddits that actually still host real .gif files ──────────────────────
const CDN_SUBREDDITS = [
    'reactiongifs', 'HighQualityGifs', 'perfectloops', 'bettereveryloop',
    'catgifs', 'dogegifs', 'AnimalsBeingDerps', 'AnimalsBeingBros',
    'physicsgifs', 'educationalgifs', 'mechanicalgifs', 'chemicalreactiongifs',
    'woahdude', 'oddlysatisfying', 'gifsthatendtoosoon',
    'animegifs', 'hentai_gifs', 'NSFW_GIF', 'nsfwgif', 'gif',
];

async function fetchRedditGif(subreddit) {
    const sort = ['hot', 'new', 'top'][Math.floor(Math.random() * 3)];
    const t = ['week', 'month', 'all'][Math.floor(Math.random() * 3)];
    const res = await axios.get(
        `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=100&t=${t}`,
        { headers: { 'User-Agent': 'randomgif-bot/1.0' }, timeout: 8000 }
    );
    const posts = (res.data?.data?.children ?? []).filter(p => {
        const u = (p.data?.url ?? '').toLowerCase();
        return !p.data.is_video && !u.includes('v.redd.it') &&
            (u.endsWith('.gif') || (u.includes('imgur.com') && u.endsWith('.gif')));
    });
    if (!posts.length) return null;
    const shuffled = [...posts].sort(() => Math.random() - 0.5);
    return shuffled[0]?.data?.url ?? null;
}

// ─── Rule34.xxx tag pool ───────────────────────────────────────────────────────
const RULE34_POOL = [
    'hinata_hyuga', 'tsunade', 'sakura_haruno', 'yoruichi_shihoin',
    'rangiku_matsumoto', 'nami', 'nico_robin', 'boa_hancock',
    'android_18', 'bulma', 'mikasa_ackerman', 'nezuko_kamado',
    'mitsuri_kanroji', 'momo_yaoyorozu', 'mirko', 'toga_himiko',
    'asuna_(sao)', 'erza_scarlet', 'lucy_heartfilia', 'mirajane_strauss',
    'rem_(re:zero)', 'zero_two', 'tracer_(overwatch)', 'dva_(overwatch)',
    'mercy_(overwatch)', 'ganyu_(genshin_impact)', 'hu_tao_(genshin_impact)',
    'raiden_shogun', 'ahri', 'jinx_(league_of_legends)', 'tifa_lockhart',
    'zelda', 'samus_aran', 'chun-li', 'cammy_white', 'gardevoir', 'lopunny',
    'naruto', 'bleach_(series)', 'one_piece', 'dragon_ball',
    'boku_no_hero_academia', 'sword_art_online', 'fairy_tail',
    'kimetsu_no_yaiba', 'jujutsu_kaisen_(series)',
    'fellatio', 'anal', 'paizuri', 'doggystyle', 'cowgirl_position',
    'gangbang', 'bondage', 'tentacles', 'futanari', 'yuri',
];

function pickRule34Tags(count = 1) {
    return [...RULE34_POOL].sort(() => Math.random() - 0.5).slice(0, count);
}

// Rule34.xxx — 100% drawn content, forces gif tag for actual GIF files
async function fetchRule34Gif() {
    const tags = pickRule34Tags(1);
    // 'gif' tag on rule34.xxx specifically means animated .gif files
    const tagString = [...tags, 'gif'].join('+');
    const pid = Math.floor(Math.random() * 30);

    const res = await axios.get('https://rule34.xxx/index.php', {
        params: { page: 'dapi', s: 'post', q: 'index', json: 1, tags: tagString, limit: 100, pid },
        timeout: 10000,
        headers: { 'User-Agent': 'randomgif-bot/1.0' },
    });

    const posts = Array.isArray(res.data) ? res.data : [];
    if (!posts.length) return null;

    const gifPosts = posts.filter(p => p.file_url?.toLowerCase().endsWith('.gif'));
    if (!gifPosts.length) return null;

    const shuffled = [...gifPosts].sort(() => Math.random() - 0.5);
    return shuffled[0].file_url;
}

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
                    } else if (!url) {
                        console.log(`⚠️ No .gif posts in r/${sub}`);
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
            let fallbackUrl = null;
            for (let attempt = 0; attempt < 10 && !finalGifUrl; attempt++) {
                console.log(`🔞 Attempt ${attempt + 1}: Rule34.xxx`);
                try {
                    const url = await fetchRule34Gif();
                    if (!url) { console.log(`⚠️ No results`); continue; }
                    if (!recentCoolSet.has(url)) {
                        finalGifUrl = url;
                        console.log(`✅ ${url}`);
                    } else if (!fallbackUrl) {
                        fallbackUrl = url;
                    }
                } catch (e) { console.log(`⚠️ Rule34 error: ${e.message}`); }
            }
            if (!finalGifUrl && fallbackUrl) finalGifUrl = fallbackUrl;
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
            let finalGifUrl = null, fallbackUrl = null;
            for (let i = 0; i < 10 && !finalGifUrl; i++) {
                try {
                    const url = await fetchRule34Gif();
                    if (!url) continue;
                    if (!recentCoolSet.has(url)) finalGifUrl = url;
                    else if (!fallbackUrl) fallbackUrl = url;
                } catch (e) { console.log(`⚠️ [$r34] error: ${e.message}`); }
            }
            if (!finalGifUrl && fallbackUrl) finalGifUrl = fallbackUrl;
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
