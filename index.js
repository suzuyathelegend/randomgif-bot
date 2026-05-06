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

// Uses meme-api.com without count limit to fetch truly random posts (uses Reddit's native /random instead of 'hot')
async function fetchTrulyRandomGif(subredditsPool, avoidSet) {
    // Fetch from 5 random subreddits concurrently to speed up finding a .gif
    const subs = [...subredditsPool].sort(() => 0.5 - Math.random()).slice(0, 5);
    console.log(`🎲 Fetching from: ${subs.map(s => 'r/'+s).join(', ')}`);
    
    const fetchPromises = subs.map(sub => 
        axios.get(`https://meme-api.com/gimme/${sub}`, { timeout: 8000 }).catch(() => null)
    );
    
    const responses = await Promise.all(fetchPromises);
    
    const gifUrls = responses
        .map(res => res && res.data ? res.data.url : null)
        .filter(url => url && url.toLowerCase().endsWith('.gif') && !avoidSet.has(url));
        
    if (!gifUrls.length) return null;
    
    // Pick a random one from the successful ones
    const shuffled = [...gifUrls].sort(() => Math.random() - 0.5);
    return shuffled[0];
}

// ─── Rule34/Hentai Subreddits for randomcool ───────────────────────────────────
const COOL_SUBREDDITS = [
    // ── Core R34 / General ────────────────────────────────────────────────────
    'rule34', 'Hentai_GIFs', 'rule34_gifs', 'AnimeHentaiGifs',
    'hentai_gif', 'Hentai', 'AnimatedPorn', 'WesternHentai',
    'HentaiSource', 'drawn_hentai', 'ecchi', 'AnimePorn',
    'HentaiMemes', 'HentaiTrap', 'Sukebe',

    // ── Solo Female (fictional/drawn) ─────────────────────────────────────────
    'SoloFemale_Hentai', 'solo_hentai', 'HentaiGirls',
    'AnimeBoobs', 'animebigboobs', 'AnimeButts', 'AnimeFeet',
    'AnimeThighs', 'HentaiBondage', 'HentaiMilf', 'AnimeGirls',
    'DrawingsSFM', 'MasturbationHentai', 'HentaiBlowjob',

    // ── Futanari / Femboy / Trap ──────────────────────────────────────────────
    'futanari', 'Futanari_Hentai', 'AnimeTrap', 'traps',
    'Femboy', 'FemboyHentai',

    // ── Yuri / Lesbian ────────────────────────────────────────────────────────
    'yuri', 'YuriHentai', 'GirlsLoveHentai',

    // ── Monster / Fantasy ─────────────────────────────────────────────────────
    'MonsterGirl', 'MonsterGirlHentai', 'tentai',
    'TentacleHentai', 'OrcPorn', 'ElvesAndSexElves',

    // ── SFM / 3D Animated ─────────────────────────────────────────────────────
    'SFM_Porn', '3DPorn', 'SFMporn', 'SFMNSFW',
    'Blender_Porn', '3DAnimatedPorn', 'SFM_Rule34',

    // ── Overwatch ─────────────────────────────────────────────────────────────
    'Overwatch_Porn', 'OverwatchTracer', 'OverwatchMercyPorn',
    'OverwatchD_Va', 'OverwatchWidowmaker',

    // ── Genshin Impact ───────────────────────────────────────────────────────
    'GenshinImpactHentai', 'GenshinImpactNSFW', 'GenshinHentai',
    'GenshinRule34', 'HuTaoHentai', 'GanyuHentai', 'RaidenShogunHentai',

    // ── League of Legends / Valorant ─────────────────────────────────────────
    'Rule34LoL', 'LeagueOfLegendsPorn', 'ValorantPorn',
    'LoLHentai', 'AhriHentai', 'JinxHentai',

    // ── Pokémon ───────────────────────────────────────────────────────────────
    'PokePorn', 'PokemonNSFW', 'Pokemon_Hentai', 'PokemonRule34',
    'PokemonGirlsNSFW',

    // ── Zelda ─────────────────────────────────────────────────────────────────
    'ZeldaPorn', 'ZeldaHentai', 'ZeldaRule34',

    // ── Final Fantasy ─────────────────────────────────────────────────────────
    'FinalFantasyPorn', 'FinalFantasyHentai', 'FF14Porn',

    // ── Fate ─────────────────────────────────────────────────────────────────
    'FateHentai', 'FateStayNightHentai', 'FateGrandOrderNSFW',

    // ── Anime-specific Fandoms ────────────────────────────────────────────────
    'NierAutomataPorn', '2BHentai',
    'SpyxFamilyHentai', 'AniFamilyHentai',
    'DemonSlayerHentai', 'DemonSlayer_NSFW',
    'NarutoHentai', 'NarutoRule34',
    'DragonBallHentai', 'DragonBallZPorn',
    'OnePunchManNSFW', 'MyHeroAcademiaHentai', 'BnhaHentai',
    'AttackOnTitanHentai', 'SnkHentai',
    'JujutsuKaisenHentai', 'JJKHentai',
    'HunterXHunterNSFW', 'ChainsawManHentai',
    'SteinsGateHentai', 'TokyoRevengersHentai',
    'RecordOfRagnarokNSFW', 'TengenToppaHentai',
    'KonosubaHentai', 'RimworldHentai',

    // ── Gacha / Mobile Games ─────────────────────────────────────────────────
    'AzurLaneHentai', 'AzurLane_NSFW',
    'ArknightsHentai', 'Arknights_NSFW',
    'BlueArchiveHentai', 'BlueArchiveNSFW',
    'NikkeMobileHentai', 'NIKKERule34',
    'HonkaiStarRailHentai', 'HonkaiStarRailNSFW',
    'HonkaiImpact3Hentai', 'FGOHentai',

    // ── FPS / Shooter Games ───────────────────────────────────────────────────
    'ApexPorn', 'FortnitePorn', 'ValorantPorn',
    'Rainbow6Porn', 'CallOfDutyPorn', 'HaloNSFW',

    // ── Fighting Games ────────────────────────────────────────────────────────
    'StreetFighterPorn', 'TekkenPorn', 'DeadOrAlivePorn',
    'GuiltyGearPorn', 'MortalKombatPorn',

    // ── RPG / Action Games ────────────────────────────────────────────────────
    'CyberpunkPorn', 'BioShockPorn', 'MassEffectPorn',
    'TombRaiderPorn', 'ResidentEvilPorn', 'WitcherPorn',
    'EldenRingNSFW', 'DarkSoulsNSFW', 'SkyrimPorn',
    'PersonaHentai', 'FireEmblemHentai', 'DanganronpaHentai',

    // ── Western Animation / Comics ────────────────────────────────────────────
    'WesternHentai', 'WesternAnimated_R34',
    'TotallySpiesPorn', 'FairlyOddParentsPorn',
    'AvatarPorn', 'GravityFallsPorn',
    'MiraculousLadybugHentai', 'StarVsNSFW',
    'StevenUniverseNSFW', 'AmericanDadPorn',

    // ── Misc Drawn / Illustrated ──────────────────────────────────────────────
    'HentaiSource', 'PaladinsPorn', 'HentaiBondage',
    'TwistedWonderlandNSFW', 'FemboyHentai',
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
            for (let attempt = 0; attempt < 8 && !finalGifUrl; attempt++) {
                console.log(`[randomcdn] Attempt ${attempt + 1}...`);
                finalGifUrl = await fetchTrulyRandomGif(CDN_SUBREDDITS, recentGifsSet);
            }
            if (!finalGifUrl) throw new Error('No valid GIFs found.');
            
            console.log(`✅ Final SFW GIF: ${finalGifUrl}`);
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
            for (let attempt = 0; attempt < 8 && !finalGifUrl; attempt++) {
                console.log(`[randomcool] Attempt ${attempt + 1}...`);
                finalGifUrl = await fetchTrulyRandomGif(COOL_SUBREDDITS, recentCoolSet);
            }
            if (!finalGifUrl) throw new Error('No valid GIFs found.');
            
            console.log(`🔞 Final NSFW GIF: ${finalGifUrl}`);
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
            for (let attempt = 0; attempt < 8 && !finalGifUrl; attempt++) {
                finalGifUrl = await fetchTrulyRandomGif(COOL_SUBREDDITS, recentCoolSet);
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
            for (let attempt = 0; attempt < 8 && !finalGifUrl; attempt++) {
                finalGifUrl = await fetchTrulyRandomGif(CDN_SUBREDDITS, recentGifsSet);
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
