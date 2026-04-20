const { Client, IntentsBitField } = require('discord.js');
const axios = require('axios');

const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent] });

const token = process.env.token;

// ─── History deduplication ───────────────────────────────────────────────────
const recentGifsSet = new Set();
const recentGifsQueue = [];
const MAX_HISTORY_SIZE = 800;

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

    // NSFW
    'hentai', 'ecchi', 'rule34', 'anime nsfw', 'lewd', 'sexy', 'strip',
    'blowjob', 'anal', 'creampie', 'squirt', 'orgasm', 'moaning', 'thong',
    'lingerie', 'nude', 'naked', 'boobs', 'ass', 'pussy', 'dick', 'cock',
    'cumshot', 'facial', 'gangbang', 'threesome', 'milf', 'amateur',
    'public sex', 'doggystyle', 'missionary', 'cowgirl', 'riding', 'deepthroat',
    'footjob', 'handjob', 'titjob', 'futa', 'yaoi', 'yuri', 'hentai gif',
    'nsfw', 'sex', 'porn', 'erotic', 'kinky', 'bdsm',

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

function pickRandomTags(count = 1) {
    const shuffled = [...CHAOS_TAGS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

client.on('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Owner-only check
    const ownerId = '1172816141832421399';
    if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: '🚫 This bot is private and only the owner can use it.', ephemeral: true });
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
});

client.login(token);


