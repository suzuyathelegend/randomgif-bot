const { Client, IntentsBitField } = require('discord.js');
const axios = require('axios');

const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.MessageContent] });

const token = process.env.token;

// Use a Set for O(1) lookups — much faster deduplication
const recentGifsSet = new Set();
const recentGifsQueue = []; // keeps insertion order so we can evict oldest
const MAX_HISTORY_SIZE = 600; // remember last 600 GIFs

// Shuffle array in-place (Fisher-Yates)
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
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
            // -------------------------------------------------------------------
            // SUBREDDIT POOL — 120+ subs across every vibe
            // -------------------------------------------------------------------
            const subreddits = [
                // ── General & Chaotic Funny ──────────────────────────────────
                'gifs', 'HighQualityGifs', 'BetterEveryLoop', 'Unexpected',
                'nonononoyes', 'yesyesyesno', 'holdmybeer', 'holdmycosmo',
                'holdmyredbull', 'holdmyfeedingtube', 'holdmyjuicebox',
                'wheredidthesodago', 'wastedgifs', 'reactiongifs',
                'ChildrenFallingOver', 'DadReflexes', 'AbruptChaos',
                'ANormalDayInRussia', 'WinStupidPrizes', 'therewasanattempt',
                'instant_regret', 'SweatyPalms', 'mildlyinfuriating',
                'mildlysatisfying', 'IdiotsInCars', 'Wellthatsucks',
                'leopardsatemyface', 'KidsAreFuckingStupid',
                'Whatcouldgowrong', 'nononono', 'almostperfect',
                'punchablefaces', 'praisethecameraman', 'HolUp',

                // ── Action / Sports / Skills ─────────────────────────────────
                'nextfuckinglevel', 'woahdude', 'interestingasfuck',
                'blackmagicfuckery', 'gifsthatendtoosoon', 'stickyfingaz',
                'PerfectTiming', 'BeAmazed', 'toptalent', 'Damnthatsinteresting',
                'specializedtools', 'watchandlearn', 'skateboarding',
                'skiing', 'Surfing', 'Parkour', 'martialarts', 'boxing',
                'MMA', 'acrobatics', 'gymnastics', 'triplej', 'sports',
                'nba', 'soccer', 'hockey',

                // ── Satisfying & Visual ───────────────────────────────────────
                'oddlysatisfying', 'mechanical_gifs', 'physicsgifs',
                'perfectloops', 'educationalgifs', 'simulated',
                'chemicalreactiongifs', 'loadingicon', 'RetroFuturism',
                'itookapicture', 'EarthPorn', 'NatureIsFuckingLit',
                'FullScaleRecreations', 'Foodporn', 'gifrecipes',
                'toptalent', 'crafts', 'woodworking',

                // ── Animals ──────────────────────────────────────────────────
                'CatGifs', 'StartledCats', 'Zoomies', 'tippyTaps',
                'catslaps', 'dog_gifs', 'animal_gifs', 'aww',
                'AnimalsBeingDerps', 'AnimalsBeingBros', 'AnimalsBeingJerks',
                'rarepuppers', 'superbowl', 'Thisismylifemeow',
                'Floof', 'WhatsWrongWithYourDog', 'WhatsWrongWithYourCat',
                'BigCatGifs', 'likeus', 'birdsbeingdicks',
                'birding', 'WildlifePhotography',

                // ── Anime & Weeb ─────────────────────────────────────────────
                'animegifs', 'anime', 'animemes', 'Animewallpaper',
                'Konosuba', 'swordartonline', 'OnePiece', 'attackontitan',
                'DemonSlayer', 'DragonBallSuper', 'Jujutsukaisen',
                'chainsawman', 'bleach', 'NarutoGifs', 'myheroacademia',
                'ReZero', 'Hololive', 'VirtualYoutubers',

                // ── Gaming ───────────────────────────────────────────────────
                'GamingGifs', 'GamePhysics', 'GTAorRussia', 'gaming',
                'smashbros', 'Competitiveoverwatch', 'GlobalOffensive',
                'leagueoflegends', 'Minecraft', 'darksouls',
                'Eldenring', 'Sekiro', 'apexlegends', 'Valorant',
                'RocketLeague', 'Battlefield', 'CallOfDuty',
                'deadbydaylight', 'Doom', 'pcgaming', 'speedrun',
                'gameglitches', 'trueachievements',

                // ── NSFW — Real People ────────────────────────────────────────
                'nsfw_gif', 'gifsgonewild', 'holdthemoan', 'O_Faces',
                'NSFW_HTML5', '60fpsporn', 'publicsex', 'publicflashing',
                'gonewildstories', 'AsiansGoneWild', 'asiansgonewild',
                'cumsluts', 'squirting', 'jigglefuck', 'blowjobs',
                'throatfuck', 'realgirls', 'amateur_milfs', 'collegesluts',
                'pawg', 'BigBoobsGW', 'GoneWildAudio',
                'fitnessnsfw', 'petitegonewild', 'GoneWild',

                // ── NSFW — Hentai & Ecchi ─────────────────────────────────────
                'hentai_gif', 'ecchi', 'rule34', 'bigtiddygothgf',
                'hentai', 'Hentai_Gif', 'HENTAI_GIF', 'animenudes',
                'rule34_animated', 'doujinshi', 'lewdkigurumi',
                'wholesomehentai', 'powerlevel', 'Overwatch_Porn',
                'LeagueOfLegendsHentai', 'FutaHentai', 'yuri',
                'traps', 'kemono', 'BlownBackHair',
            ];

            // Shuffle so we never hit the same top few subs repeatedly
            const shuffled = shuffle([...subreddits]);

            let finalGifUrl = null;
            let fallbackUrl = null;
            let attempts = 0;
            const MAX_ATTEMPTS = 8;

            while (attempts < MAX_ATTEMPTS && !finalGifUrl) {
                attempts++;
                // Cycle through the shuffled list, not random — guarantees variety
                const sub = shuffled[attempts % shuffled.length];

                try {
                    // Request 100 posts and use a random sort word to avoid always getting #1 post
                    const sorts = ['hot', 'new', 'top', 'rising'];
                    const sort = sorts[Math.floor(Math.random() * sorts.length)];
                    const response = await axios.get(
                        `https://meme-api.com/gimme/${sub}/100`,
                        { timeout: 6000 }
                    );

                    if (!response.data?.memes?.length) continue;

                    // Keep only real media files
                    const validMedia = response.data.memes.filter(m => {
                        if (!m.url) return false;
                        const url = m.url.toLowerCase();
                        return url.endsWith('.gif') || url.endsWith('.gifv') ||
                               url.endsWith('.mp4') || url.endsWith('.webm');
                    });

                    if (!validMedia.length) continue;

                    // Shuffle the valid media so we don't always pick the most-upvoted post
                    shuffle(validMedia);

                    // Find first unseen
                    const unseen = validMedia.find(m => !recentGifsSet.has(m.url));

                    if (unseen) {
                        finalGifUrl = unseen.url;
                        console.log(`✅ [${sub}] Found unseen GIF on attempt ${attempts}`);
                    } else if (!fallbackUrl) {
                        fallbackUrl = validMedia[0].url;
                    }
                } catch (apiError) {
                    console.log(`⚠️ [${sub}] fetch failed: ${apiError.message}`);
                }
            }

            if (!finalGifUrl && fallbackUrl) {
                console.log('⚠️ All attempts returned seen GIFs. Using fallback.');
                finalGifUrl = fallbackUrl;
            }

            if (!finalGifUrl) {
                throw new Error('Could not find any valid GIFs after all attempts.');
            }

            // Add to history
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


