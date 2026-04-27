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

// Sort orders weighted AWAY from trending so popular GIFs don't dominate
const SORT_ORDERS = ['new', 'new', 'new', 'latest', 'latest', 'top'];

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

// ─── The chaos list — pure randomness, no boring categories ──────────────────
const CHAOS_TAGS = [
    // Meme reactions
    'shocked', 'confused', 'screaming', 'disgusted', 'cringe', 'mind blown',
    'facepalm', 'deal with it', 'smug', 'laughing', 'crying', 'nope',

    // Random actions
    'running away', 'falling', 'jumping', 'spinning', 'dancing', 'tripping',
    'slipping', 'exploding', 'throwing', 'catching', 'dodging', 'punching',
    'kicking', 'sliding', 'rolling', 'bouncing', 'flying', 'sinking',
    'crashing', 'yeet', 'backflip', 'faceplant', 'stumbling', 'crawling',
    'moonwalk', 'breakdance', 'twerking', 'flossing', 'robot dance',

    // Random objects & things
    'pizza', 'burger', 'spaghetti', 'cheese', 'bread', 'cake', 'donut',
    'coffee', 'explosion', 'fire', 'water', 'balloon', 'umbrella', 'chair',
    'door', 'stairs', 'elevator', 'escalator', 'toilet', 'sink', 'bathtub',
    'microwave', 'toaster', 'fridge', 'blender', 'lamp', 'couch', 'bed',

    // Internet chaos
    'fail', 'win', 'epic fail', 'owned', 'rekt', 'plot twist', 'awkward',
    'unexpected', 'chaos', 'disaster', 'oops', 'whoops', 'glitch', 'lag',
    'loading', 'buffering', 'timeout', 'error', 'crash', 'freeze',
    'meanwhile', 'suddenly', 'instantly', 'perfect timing', 'almost',

    // Pop culture & memes
    'spongebob', 'patrick star', 'squidward', 'shrek', 'gru', 'minion',
    'pepe', 'doge', 'trollface', 'rickroll', 'john cena', 'the rock',
    'nicolas cage', 'will smith', 'tom and jerry', 'looney tunes',
    'homer simpson', 'peter griffin', 'quagmire', 'stewie', 'kermit',
    'pikachu', 'mewtwo', 'charizard', 'psyduck', 'jigglypuff', 'gengar',
    'mario', 'luigi', 'bowser', 'link', 'zelda', 'sonic', 'tails',
    'among us', 'creeper', 'herobrine', 'enderman',

    // Anime & weeb chaos
    'naruto run', 'one punch', 'bankai', 'kamehameha',
    'nani', 'yamero', 'ara ara', 'muda muda', 'ora ora',
    'thunder breathing', 'gear fifth', 'ultra instinct',
    'chibi', 'tsundere', 'waifu', 'anime scream', 'anime fall',
    'anime blush', 'glomp', 'sparkle eyes',

    // Weird & surreal
    'glitch art', 'vaporwave', 'liminal space', 'uncanny valley', 'analog horror',
    'fever dream', 'dreamcore', 'weirdcore', 'backrooms', 'void',
    'abstract', 'surreal', 'trippy', 'optical illusion', 'paradox',
    'infinite loop', 'fractal', 'kaleidoscope', 'melting', 'morphing',

    // Chaotic scenarios
    'escape room', 'haunted house', 'arcade', 'casino', 'amusement park',
    'roller coaster', 'laser tag', 'theme park',

    // Tech & gaming
    'keyboard smash', 'rage quit', 'speedrun', 'glitch', 'no clip', 'wallhack',
    'aimbot', 'lag', 'ping', 'disconnect', 'victory royale', 'game over',
    'respawn', 'achievement unlocked', 'new high score', 'boss fight',
    'final boss', 'power up', 'level up', 'loot box', 'inventory full',

    // Chaos wildcards
    'monke', 'stonks', 'galaxy brain', 'big brain', 'smooth brain',
    '404', 'windows xp', 'blue screen', 'defrag',
    'dial up', 'floppy disk', 'cassette', 'vhs', 'static', 'signal lost',
    'we live in a society', 'it be like that', 'just vibing', 'no cap',
    'lowkey', 'based', 'sigma', 'gigachad', 'virgin vs chad', 'chad walk',
    'florida man', 'how', 'why', 'what', 'bruh', 'sus', 'rent free',

    // Cute & fun
    'cute', 'adorable', 'fluffy', 'tiny', 'wholesome', 'cozy', 'snuggly',

    // Animated / fictional NSFW (no IRL — drawn/anime only)
    'hentai', 'rule34', 'ecchi', 'futa', 'futanari', 'yaoi', 'yuri',
    'anime nsfw', 'lewd anime', 'ahegao', 'animated nsfw', 'hentai gif',

    // Completely random wildcards
    'bread cat', 'waffle house', 'chuck e cheese', 'furby', 'tamagotchi',
    'rubber duck', 'shopping cart', 'office chair spin', 'bubble wrap',
    'packing tape', 'zip tie', 'duct tape', 'safety pin', 'stapler',
    'hole punch', 'white board', 'projector fail', 'microphone feedback',
    'stage dive', 'crowd surf', 'mosh pit', 'encore', 'guitar smash',

    // Extra spice
    'dramatic turn', 'slow motion', 'time lapse', 'rewind', 'instant replay',
    'camera falls', 'photobomb', 'wrong window', 'wrong tab', 'sent to wrong person',
    'autocorrect fail', 'typo', 'ctrl z', 'undo everything',
    'fresh start', 'do over', 'second chance', 'one more time', 'retry',
];

// ─── Rule34-only tag pool (ALL fictional/animated — no IRL) ──────────────────
// Every act/body tag is a compound phrase anchored to "hentai" or "anime"
// so Redgifs returns drawn/animated content, never IRL porn.
const RULE34_TAGS = [
    // Anime series (inherently animated)
    'naruto hentai', 'bleach hentai', 'one piece hentai', 'dragon ball hentai',
    'attack on titan hentai', 'demon slayer hentai', 'jujutsu kaisen hentai',
    'my hero academia hentai', 'sword art online hentai', 'fairy tail hentai',
    'hunter x hunter hentai', 'fullmetal alchemist hentai', 'overlord hentai',
    're zero hentai', 'konosuba hentai', 'fate stay night hentai',
    'tokyo ghoul hentai', 'black clover hentai',

    // Popular characters (anchored)
    'tsunade hentai', 'hinata hentai', 'sakura hentai', 'temari hentai',
    'mikasa hentai', 'erza scarlet hentai', 'android 18 hentai', 'bulma hentai',
    'nami hentai', 'robin hentai', 'hancock hentai', 'nezuko hentai',
    'mitsuri hentai', 'rem hentai', 'zero two hentai', 'toga himiko hentai',
    'momo yaoyorozu hentai', 'mirko hentai', 'midnight hentai', 'asuna hentai',

    // Acts — anchored to hentai/anime so results stay animated
    'hentai blowjob', 'hentai anal', 'hentai creampie', 'hentai cumshot',
    'hentai doggystyle', 'hentai cowgirl', 'hentai riding', 'hentai missionary',
    'hentai deepthroat', 'hentai paizuri', 'hentai footjob', 'hentai handjob',
    'hentai gangbang', 'hentai threesome', 'hentai orgy', 'hentai squirt',
    'hentai orgasm', 'hentai bondage', 'hentai bdsm', 'hentai spanking',
    'hentai sex toy', 'hentai vibrator', 'tentacle hentai',

    // Pure animated / drawn style tags
    'hentai', 'hentai gif', 'anime hentai', 'animated hentai', 'rule34',
    'ahegao', 'ecchi', 'lewd anime', 'anime nsfw', 'animated nsfw',

    // Animated character types
    'futa hentai', 'futanari hentai', 'femboy hentai', 'trap hentai',
    'yaoi hentai', 'yuri hentai', 'shemale hentai',

    // Animated creature / fantasy types
    'monster girl hentai', 'elf hentai', 'demon girl hentai', 'succubus hentai',
    'cat girl hentai', 'fox girl hentai', 'dragon girl hentai',
    'vampire girl hentai', 'angel hentai',

    // Animated outfits / aesthetics
    'hentai maid', 'hentai school uniform', 'hentai bunny suit',
    'hentai lingerie', 'hentai stockings', 'hentai nude', 'hentai topless',

    // Game franchises (anchored)
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

function pickRandomTags(count = 1) {
    const shuffled = [...CHAOS_TAGS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

client.on('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Allowed users check
    if (!ALLOWED_USERS.has(interaction.user.id)) {
        return interaction.reply({ content: '🚫 This bot is private.', ephemeral: true });
    }

    if (interaction.commandName === 'randomcdn') {
        await interaction.deferReply();

        try {
            const authToken = await getRedgifsToken();

            let finalGifUrl = null;
            let fallbackUrl = null;
            const MAX_ATTEMPTS = 8;

            for (let attempt = 0; attempt < MAX_ATTEMPTS && !finalGifUrl; attempt++) {
                // 1-2 random tags — keep it tight for better results
                const tagCount = Math.random() < 0.6 ? 1 : 2;
                const tags = pickRandomTags(tagCount);
                const searchQuery = tags.join(' ');
                const randomPage = Math.floor(Math.random() * 10) + 1; // pages 1-10

                try {
                    console.log(`🎲 Attempt ${attempt + 1}: searching Redgifs for "${searchQuery}" (page ${randomPage})`);

                    const response = await axios.get('https://api.redgifs.com/v2/gifs/search', {
                        headers: {
                            Authorization: `Bearer ${authToken}`,
                        },
                        params: {
                            search_text: searchQuery,
                            count: 30,
                            page: randomPage,
                            order: 'trending',
                        },
                        timeout: 8000,
                    });

                    const gifs = response.data?.gifs;
                    if (!gifs?.length) {
                        console.log(`⚠️ No results for "${searchQuery}"`);
                        continue;
                    }

                    // Shuffle for extra randomness
                    const shuffled = [...gifs].sort(() => Math.random() - 0.5);

                    for (const gif of shuffled) {
                        const url = gif?.urls?.hd ?? gif?.urls?.sd;
                        if (!url) continue;

                        if (!recentGifsSet.has(url)) {
                            finalGifUrl = url;
                            console.log(`✅ Found unseen GIF: ${url}`);
                            break;
                        } else if (!fallbackUrl) {
                            fallbackUrl = url;
                        }
                    }

                } catch (apiError) {
                    console.log(`⚠️ Redgifs fetch failed (attempt ${attempt + 1}): ${apiError.message}`);
                    // Token may have expired mid-session, clear it so next attempt refreshes
                    if (apiError.response?.status === 401) {
                        redgifsToken = null;
                    }
                }
            }

            // Use fallback if everything was seen
            if (!finalGifUrl && fallbackUrl) {
                console.log('⚠️ All found GIFs were seen. Using fallback.');
                finalGifUrl = fallbackUrl;
            }

            if (!finalGifUrl) {
                throw new Error('Could not find any valid GIFs after all attempts.');
            }

            // Track history
            recentGifsSet.add(finalGifUrl);
            recentGifsQueue.push(finalGifUrl);
            if (recentGifsQueue.length > MAX_HISTORY_SIZE) {
                const oldest = recentGifsQueue.shift();
                recentGifsSet.delete(oldest);
            }

            await interaction.editReply(finalGifUrl);

        } catch (error) {
            console.error('GIF fetch failed severely:', error.message);
            await interaction.editReply('❌ Failed to fetch GIF. Try again! (Check console for details)');
        }
    }

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
                    console.log(`🔞 Attempt ${attempt + 1}: searching Redgifs for "${searchQuery}" (page ${randomPage})`);

                    const response = await axios.get('https://api.redgifs.com/v2/gifs/search', {
                        headers: {
                            Authorization: `Bearer ${authToken}`,
                        },
                        params: {
                            search_text: searchQuery,
                            count: 30,
                            page: randomPage,
                            order: 'trending',
                        },
                        timeout: 8000,
                    });

                    const gifs = response.data?.gifs;
                    if (!gifs?.length) {
                        console.log(`⚠️ No results for "${searchQuery}"`);
                        continue;
                    }

                    // Shuffle for extra randomness
                    const shuffled = [...gifs].sort(() => Math.random() - 0.5);

                    for (const gif of shuffled) {
                        const url = gif?.urls?.hd ?? gif?.urls?.sd;
                        if (!url) continue;

                        if (!recentCoolSet.has(url)) {
                            finalGifUrl = url;
                            console.log(`✅ Found unseen rule34 GIF: ${url}`);
                            break;
                        } else if (!fallbackUrl) {
                            fallbackUrl = url;
                        }
                    }

                } catch (apiError) {
                    console.log(`⚠️ Redgifs fetch failed (attempt ${attempt + 1}): ${apiError.message}`);
                    if (apiError.response?.status === 401) {
                        redgifsToken = null;
                    }
                }
            }

            // Use fallback if everything was seen
            if (!finalGifUrl && fallbackUrl) {
                console.log('⚠️ All found rule34 GIFs were seen. Using fallback.');
                finalGifUrl = fallbackUrl;
            }

            if (!finalGifUrl) {
                throw new Error('Could not find any valid rule34 GIFs after all attempts.');
            }

            // Track history
            recentCoolSet.add(finalGifUrl);
            recentCoolQueue.push(finalGifUrl);
            if (recentCoolQueue.length > MAX_COOL_HISTORY) {
                const oldest = recentCoolQueue.shift();
                recentCoolSet.delete(oldest);
            }

            await interaction.editReply(finalGifUrl);

        } catch (error) {
            console.error('randomcool GIF fetch failed severely:', error.message);
            await interaction.editReply('❌ Failed to fetch rule34 GIF. Try again! (Check console for details)');
        }
    }

});

// ─── Prefix command handler ($r34, $random) ───────────────────────────────────
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Allowed users check
    if (!ALLOWED_USERS.has(message.author.id)) return;

    const content = message.content.trim().toLowerCase();

    // $r34 — same logic as /randomcool
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

    // $random — same logic as /randomcdn
    if (content === '$random') {
        let typingInterval;
        try {
            typingInterval = setInterval(() => message.channel.sendTyping(), 5000);
            message.channel.sendTyping();

            const authToken = await getRedgifsToken();
            let finalGifUrl = null;
            let fallbackUrl = null;
            const MAX_ATTEMPTS = 8;

            for (let attempt = 0; attempt < MAX_ATTEMPTS && !finalGifUrl; attempt++) {
                const tagCount = Math.random() < 0.6 ? 1 : 2;
                const tags = pickRandomTags(tagCount);
                const searchQuery = tags.join(' ');
                const randomPage = Math.floor(Math.random() * 10) + 1;

                try {
                    console.log(`🎲 [$random] attempt ${attempt + 1}: "${searchQuery}" (page ${randomPage})`);

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
                        if (!recentGifsSet.has(url)) {
                            finalGifUrl = url;
                            break;
                        } else if (!fallbackUrl) {
                            fallbackUrl = url;
                        }
                    }
                } catch (apiError) {
                    console.log(`⚠️ [$random] fetch failed (attempt ${attempt + 1}): ${apiError.message}`);
                    if (apiError.response?.status === 401) redgifsToken = null;
                }
            }

            if (!finalGifUrl && fallbackUrl) finalGifUrl = fallbackUrl;
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
