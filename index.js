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

// ─── Allowed users (you + your alt) ──────────────────────────────────────────
const ALLOWED_USERS = new Set([
    '1172816141832421399', // main
    '1368245007177351300', // alt
]);

// ─── History deduplication (separate pools per command) ─────────────────────
const recentGifsSet = new Set();        // /randomcdn pool
const recentGifsQueue = [];
const MAX_HISTORY_SIZE = 800;

const recentCoolSet = new Set();        // /randomcool pool (independent)
const recentCoolQueue = [];
const MAX_COOL_HISTORY = 800;

// ─── Redgifs token cache (auto-refreshes, no API key needed) ─────────────────
let redgifsToken = null;
let tokenExpiry = 0;

async function getRedgifsToken() {
    if (redgifsToken && Date.now() < tokenExpiry) return redgifsToken;
    const res = await axios.get('https://api.redgifs.com/v2/auth/temporary', { timeout: 6000 });
    redgifsToken = res.data.token;
    tokenExpiry = Date.now() + (res.data.expiresIn ?? 3600) * 1000 - 30000;
    console.log('🔑 Redgifs token refreshed.');
    return redgifsToken;
}

// ─── Reddit subreddits for /randomcdn — real GIF variety ─────────────────────
const CDN_SUBREDDITS = [
    // Funny / reactions
    'gifs', 'funny', 'reactiongifs', 'perfectlycutscreams', 'nonononoyes',
    'yesyesyesyesno', 'unexpected', 'instantregret', 'therewasanattempt',
    'killthecameraman', 'whatcouldgowrong', 'holdmybeer',
    'gifsthatendtoosoon', 'misleadingthumbnails', 'highqualitygifs',
    'bettereveryloop', 'perfectloops', 'mildlyinteresting', 'damnthatsinteresting',
    'interestingasfuck',

    // Animals
    'aww', 'AnimalsBeingDerps', 'AnimalsBeingBros', 'AnimalsBeingJerks',
    'PetsAreAmazing', 'WhatsWrongWithYourCat', 'WhatsWrongWithYourDog',
    'birdsbeingdicks', 'catvideos', 'dogvideos', 'otters', 'pandas',
    'babyelephantgifs',

    // Cool / satisfying
    'oddlysatisfying', 'woahdude', 'nextfuckinglevel',
    'educationalgifs', 'physicsgifs', 'mechanicalgifs',

    // Gaming / internet
    'gaming', 'HolUp',

    // Anime / weeb
    'animegifs', 'anime', 'animememes',

    // NSFW mixed (Reddit marks these 18+)
    'NSFW_GIF', 'nsfwgif', 'hentai_gifs',
];

// Fetch a media URL from a random post in a given subreddit
async function fetchRedditGif(subreddit) {
    const sorts = ['hot', 'new', 'top', 'rising'];
    const sort = sorts[Math.floor(Math.random() * sorts.length)];
    const times = ['day', 'week', 'month', 'all'];
    const t = times[Math.floor(Math.random() * times.length)];

    const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=50&t=${t}`;
    const res = await axios.get(url, {
        headers: { 'User-Agent': 'randomgif-discord-bot/1.0' },
        timeout: 8000,
    });

    const posts = (res.data?.data?.children ?? []).filter(p => {
        const d = p.data;
        if (d.is_self || d.stickied) return false;
        const u = d.url ?? '';
        return (
            u.includes('i.redd.it') ||
            u.includes('i.imgur.com') ||
            u.includes('imgur.com') ||
            u.endsWith('.gif') ||
            u.endsWith('.gifv') ||
            u.endsWith('.mp4') ||
            d.is_video ||
            d.preview?.reddit_video_preview?.fallback_url ||
            d.media?.reddit_video?.fallback_url
        );
    });

    if (!posts.length) return null;

    const shuffled = [...posts].sort(() => Math.random() - 0.5);
    for (const post of shuffled) {
        const d = post.data;
        let mediaUrl =
            d.media?.reddit_video?.fallback_url ||
            d.preview?.reddit_video_preview?.fallback_url ||
            d.url;

        if (mediaUrl?.endsWith('.gifv')) mediaUrl = mediaUrl.replace('.gifv', '.mp4');
        if (mediaUrl) return mediaUrl;
    }
    return null;
}

// ─── Rule34-only tag pool (ALL fictional/animated — no IRL) ──────────────────
const RULE34_TAGS = [
    // Anime series
    'naruto hentai', 'bleach hentai', 'one piece hentai', 'dragon ball hentai',
    'attack on titan hentai', 'demon slayer hentai', 'jujutsu kaisen hentai',
    'my hero academia hentai', 'sword art online hentai', 'fairy tail hentai',
    'hunter x hunter hentai', 'fullmetal alchemist hentai', 'overlord hentai',
    're zero hentai', 'konosuba hentai', 'fate stay night hentai',
    'tokyo ghoul hentai', 'black clover hentai',

    // Popular characters
    'tsunade hentai', 'hinata hentai', 'sakura hentai', 'temari hentai',
    'mikasa hentai', 'erza scarlet hentai', 'android 18 hentai', 'bulma hentai',
    'nami hentai', 'robin hentai', 'hancock hentai', 'nezuko hentai',
    'mitsuri hentai', 'rem hentai', 'zero two hentai', 'toga himiko hentai',
    'momo yaoyorozu hentai', 'mirko hentai', 'midnight hentai', 'asuna hentai',

    // Acts
    'hentai blowjob', 'hentai anal', 'hentai creampie', 'hentai cumshot',
    'hentai doggystyle', 'hentai cowgirl', 'hentai riding', 'hentai missionary',
    'hentai deepthroat', 'hentai paizuri', 'hentai footjob', 'hentai handjob',
    'hentai gangbang', 'hentai threesome', 'hentai orgy', 'hentai squirt',
    'hentai orgasm', 'hentai bondage', 'hentai bdsm', 'hentai spanking',
    'hentai sex toy', 'hentai vibrator', 'tentacle hentai',

    // Style tags
    'hentai', 'hentai gif', 'anime hentai', 'animated hentai', 'rule34',
    'ahegao', 'ecchi', 'lewd anime', 'anime nsfw', 'animated nsfw',

    // Character types
    'futa hentai', 'futanari hentai', 'femboy hentai', 'trap hentai',
    'yaoi hentai', 'yuri hentai', 'shemale hentai',

    // Fantasy types
    'monster girl hentai', 'elf hentai', 'demon girl hentai', 'succubus hentai',
    'cat girl hentai', 'fox girl hentai', 'dragon girl hentai',
    'vampire girl hentai', 'angel hentai',

    // Outfits
    'hentai maid', 'hentai school uniform', 'hentai bunny suit',
    'hentai lingerie', 'hentai stockings', 'hentai nude', 'hentai topless',

    // Game franchises
    'overwatch hentai', 'genshin impact hentai', 'league of legends hentai',
    'final fantasy hentai', 'fire emblem hentai', 'zelda hentai',
    'street fighter hentai', 'mortal kombat hentai', 'pokemon hentai',
    'touhou hentai', 'vocaloid hentai', 'azur lane hentai',
    'arknights hentai', 'honkai impact hentai', 'nikke hentai',
    'kantai collection hentai',
];

function pickRandomRule34Tag(count = 1) {
    const shuffled = [...RULE34_TAGS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

// ─── Bot ready ────────────────────────────────────────────────────────────────
client.on('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// ─── Slash command handler ────────────────────────────────────────────────────
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
                    if (!url) { console.log(`⚠️ No media in r/${subreddit}`); continue; }
                    if (!recentGifsSet.has(url)) {
                        finalGifUrl = url;
                        console.log(`✅ Found: ${url}`);
                    } else {
                        console.log(`🔁 Already seen, skipping`);
                    }
                } catch (apiError) {
                    console.log(`⚠️ Reddit fetch failed (attempt ${attempt + 1}): ${apiError.message}`);
                }
            }

            if (!finalGifUrl) throw new Error('No valid GIFs after all attempts.');

            recentGifsSet.add(finalGifUrl);
            recentGifsQueue.push(finalGifUrl);
            if (recentGifsQueue.length > MAX_HISTORY_SIZE) {
                recentGifsSet.delete(recentGifsQueue.shift());
            }

            await interaction.editReply(finalGifUrl);
        } catch (error) {
            console.error('GIF fetch failed:', error.message);
            await interaction.editReply('❌ Failed to fetch GIF. Try again!');
        }
    }

    // ── /randomcool ────────────────────────────────────────────────────────────
    if (interaction.commandName === 'randomcool') {
        await interaction.deferReply();
        try {
            const authToken = await getRedgifsToken();
            let finalGifUrl = null;
            let fallbackUrl = null;
            const MAX_ATTEMPTS = 8;

            for (let attempt = 0; attempt < MAX_ATTEMPTS && !finalGifUrl; attempt++) {
                const tagCount = Math.random() < 0.5 ? 1 : 2;
                const tags = pickRandomRule34Tag(tagCount);
                const searchQuery = tags.join(' ');
                const randomPage = Math.floor(Math.random() * 30) + 1;

                try {
                    console.log(`🔞 Attempt ${attempt + 1}: "${searchQuery}" (page ${randomPage})`);
                    const response = await axios.get('https://api.redgifs.com/v2/gifs/search', {
                        headers: { Authorization: `Bearer ${authToken}` },
                        params: { search_text: searchQuery, count: 30, page: randomPage, order: 'trending' },
                        timeout: 8000,
                    });

                    const gifs = response.data?.gifs;
                    if (!gifs?.length) { console.log(`⚠️ No results for "${searchQuery}"`); continue; }

                    const shuffled = [...gifs].sort(() => Math.random() - 0.5);
                    for (const gif of shuffled) {
                        const url = gif?.urls?.hd ?? gif?.urls?.sd;
                        if (!url) continue;
                        if (!recentCoolSet.has(url)) {
                            finalGifUrl = url;
                            console.log(`✅ Found rule34 GIF: ${url}`);
                            break;
                        } else if (!fallbackUrl) {
                            fallbackUrl = url;
                        }
                    }
                } catch (apiError) {
                    console.log(`⚠️ Redgifs fetch failed (attempt ${attempt + 1}): ${apiError.message}`);
                    if (apiError.response?.status === 401) redgifsToken = null;
                }
            }

            if (!finalGifUrl && fallbackUrl) {
                console.log('⚠️ All seen. Using fallback.');
                finalGifUrl = fallbackUrl;
            }
            if (!finalGifUrl) throw new Error('No valid rule34 GIFs after all attempts.');

            recentCoolSet.add(finalGifUrl);
            recentCoolQueue.push(finalGifUrl);
            if (recentCoolQueue.length > MAX_COOL_HISTORY) {
                recentCoolSet.delete(recentCoolQueue.shift());
            }

            await interaction.editReply(finalGifUrl);
        } catch (error) {
            console.error('randomcool failed:', error.message);
            await interaction.editReply('❌ Failed to fetch rule34 GIF. Try again!');
        }
    }
});

// ─── Prefix command handler ($r34, $random) ───────────────────────────────────
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

            const authToken = await getRedgifsToken();
            let finalGifUrl = null;
            let fallbackUrl = null;
            const MAX_ATTEMPTS = 8;

            for (let attempt = 0; attempt < MAX_ATTEMPTS && !finalGifUrl; attempt++) {
                const tagCount = Math.random() < 0.5 ? 1 : 2;
                const tags = pickRandomRule34Tag(tagCount);
                const searchQuery = tags.join(' ');
                const randomPage = Math.floor(Math.random() * 30) + 1;

                try {
                    console.log(`🔞 [$r34] attempt ${attempt + 1}: "${searchQuery}" | page=${randomPage}`);
                    const response = await axios.get('https://api.redgifs.com/v2/gifs/search', {
                        headers: { Authorization: `Bearer ${authToken}` },
                        params: { search_text: searchQuery, count: 30, page: randomPage, order: 'trending' },
                        timeout: 8000,
                    });

                    const gifs = response.data?.gifs;
                    if (!gifs?.length) continue;

                    const shuffled = [...gifs].sort(() => Math.random() - 0.5);
                    for (const gif of shuffled) {
                        const url = gif?.urls?.hd ?? gif?.urls?.sd;
                        if (!url) continue;
                        if (!recentCoolSet.has(url)) {
                            finalGifUrl = url;
                            break;
                        } else if (!fallbackUrl) {
                            fallbackUrl = url;
                        }
                    }
                } catch (apiError) {
                    console.log(`⚠️ [$r34] fetch failed (attempt ${attempt + 1}): ${apiError.message}`);
                    if (apiError.response?.status === 401) redgifsToken = null;
                }
            }

            if (!finalGifUrl && fallbackUrl) finalGifUrl = fallbackUrl;
            if (!finalGifUrl) throw new Error('No valid GIFs found.');

            recentCoolSet.add(finalGifUrl);
            recentCoolQueue.push(finalGifUrl);
            if (recentCoolQueue.length > MAX_COOL_HISTORY) {
                recentCoolSet.delete(recentCoolQueue.shift());
            }

            clearInterval(typingInterval);
            await message.reply(finalGifUrl);
        } catch (error) {
            clearInterval(typingInterval);
            console.error('[$r34] failed:', error.message);
            await message.reply('❌ Failed to fetch rule34 GIF. Try again!');
        }
        return;
    }

    // $random — same as /randomcdn (Reddit-based)
    if (content === '$random') {
        let typingInterval;
        try {
            typingInterval = setInterval(() => message.channel.sendTyping(), 5000);
            message.channel.sendTyping();

            let finalGifUrl = null;
            const MAX_ATTEMPTS = 10;

            for (let attempt = 0; attempt < MAX_ATTEMPTS && !finalGifUrl; attempt++) {
                const subreddit = CDN_SUBREDDITS[Math.floor(Math.random() * CDN_SUBREDDITS.length)];
                console.log(`🎲 [$random] attempt ${attempt + 1}: r/${subreddit}`);
                try {
                    const url = await fetchRedditGif(subreddit);
                    if (!url) continue;
                    if (!recentGifsSet.has(url)) {
                        finalGifUrl = url;
                    }
                } catch (apiError) {
                    console.log(`⚠️ [$random] fetch failed (attempt ${attempt + 1}): ${apiError.message}`);
                }
            }

            if (!finalGifUrl) throw new Error('No valid GIFs found.');

            recentGifsSet.add(finalGifUrl);
            recentGifsQueue.push(finalGifUrl);
            if (recentGifsQueue.length > MAX_HISTORY_SIZE) {
                recentGifsSet.delete(recentGifsQueue.shift());
            }

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
