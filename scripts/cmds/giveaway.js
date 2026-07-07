const fs = require('fs-extra');
const path = require('path');
const moment = require('moment-timezone');
const { createCanvas, loadImage } = require('canvas');

const dataPath = path.join(__dirname, "giveaway_data.json");
const adminCache = {};
const CACHE_TTL = 300000; 

const PRELOADED_USERNAMES = {
    "Jerwin B. Panaligan": "Okarun12544",
    "Lume Craftor": "LumeCraftor",
    "Vincent Magtolis": "vincenthunder09",
    "Han Christian Andresan Cuison": "Itz_jess1239",
    "Daniel Raquel": "Tambis354",
    "Charles Mendoza Gorero": "ilikekittycats67",
    "Kylle Allan Basila": "Harlywhy",
    "Prince Robert": "sasadaprince",
    "Arnel Allan Salan": "katearnel015972"
};

const imgBase = "https://cdn-icons-png.flaticon.com/512/";
const GAME_IMAGES = {
    "carrot": "1041/1041355.png",
    "strawberry": "5990/5990513.png",
    "blueberry": "5990/5990520.png",
    "tulip": "2903/2903901.png",
    "tomato": "1202/1202125.png",
    "apple": "415/415733.png",
    "bamboo": "2636/2636838.png",
    "corn": "1135/1135520.png",
    "cactus": "3224/3224855.png",
    "pineapple": "3063/3063777.png",
    "baby cactus": "3224/3224855.png",
    "horned melon": "5990/5990558.png",
    "mushroom": "3063/3063795.png",
    "green bean": "5990/5990547.png",
    "banana": "5990/5990532.png",
    "grape": "5990/5990530.png",
    "coconut": "5990/5990535.png",
    "mango": "5990/5990543.png",
    "glow mushroom": "3063/3063795.png",
    "dragon fruit": "5990/5990548.png",
    "acorn": "2143/2143491.png",
    "cherry": "5990/5990525.png",
    "sunflower": "3063/3063810.png",
    "fire fern": "3063/3063806.png",
    "poison ivy": "3063/3063806.png",
    "venus fly trap": "3063/3063806.png",
    "pomegranate": "5990/5990552.png",
    "poison apple": "415/415733.png",
    "venom spitter": "3063/3063806.png",
    "ghost pepper": "5990/5990565.png",
    "moon bloom": "3063/3063810.png",
    "hypno bloom": "3063/3063810.png",
    "dragon's breath": "3063/3063806.png",
    "watering can": "3063/3063822.png",
    "super watering can": "3063/3063822.png",
    "sprinkler": "3063/3063822.png",
    "uncommon sprinkler": "3063/3063822.png",
    "rare sprinkler": "3063/3063822.png",
    "legendary sprinkler": "3063/3063822.png",
    "super sprinkler": "3063/3063822.png",
    "power hose": "3063/3063822.png",
    "freeze ray": "2723/2723696.png",
    "rainbow carpet": "3063/3063830.png",
    "teleporter": "3063/3063830.png",
    "trowel": "3063/3063830.png",
    "wheelbarrow": "3063/3063830.png",
    "lantern": "3063/3063806.png",
    "bear trap": "3063/3063806.png",
    "flashbang": "3063/3063806.png",
    "gnome": "3063/3063806.png",
    "invisibility mushroom": "3063/3063795.png",
    "speed mushroom": "3063/3063795.png",
    "jump mushroom": "3063/3063795.png",
    "shrink mushroom": "3063/3063795.png",
    "raccoon": "2821/2821232.png",
    "bear": "2821/2821232.png",
    "bee": "2821/2821232.png",
    "robin": "2821/2821232.png",
    "owl": "2821/2821232.png",
    "frog": "2821/2821232.png",
    "unicorn": "2821/2821232.png",
    "golden dragonfly": "2821/2821232.png",
    "ice serpent": "2821/2821232.png",
    "deer": "2821/2821232.png",
    "turtle": "2821/2821232.png",
    "bunny": "2821/2821232.png",
    "monkey": "2821/2821232.png"
};
const DEFAULT_IMAGE = imgBase + "4129/4129424.png";

function loadData() {
    if (!fs.existsSync(dataPath)) return { activeThreads: [], participants: {}, giveaways: {}, usernames: {} };
    try {
        let data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        if (!data.activeThreads) data.activeThreads = []; 
        if (!data.giveaways) data.giveaways = {};
        if (!data.participants) data.participants = {};
        if (!data.usernames) data.usernames = {};
        return data;
    } catch (e) {
        return { activeThreads: [], participants: {}, giveaways: {}, usernames: {} };
    }
}

function saveData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

async function isGroupAdmin(api, threadID, senderID) {
    if (threadID === senderID) return false; 
    const now = Date.now();
    if (!adminCache[threadID] || (now - adminCache[threadID].timestamp > CACHE_TTL)) {
        try {
            const threadInfo = await api.getThreadInfo(threadID);
            const admins = threadInfo.adminIDs.map(admin => String(admin.id || admin));
            adminCache[threadID] = { admins, timestamp: now };
        } catch (e) { return false; }
    }
    return adminCache[threadID].admins.includes(String(senderID));
}

function parseTimer(timerStr) {
    const match = timerStr.match(/^(\d+)(second|minute|hour|sec|min|hr)s?$/i);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('sec')) return value * 1000;
    if (unit.startsWith('min')) return value * 60 * 1000;
    if (unit.startsWith('hour') || unit.startsWith('hr')) return value * 60 * 60 * 1000;
    return null;
}

async function generatePrizeCanvas(giveawayId, itemName, amount, imageUrl, sponsorName) {
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#34495e';
    ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 45px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎁 GIVEAWAY #${giveawayId} 🎁`, 400, 80);
    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`Sponsored by: ${sponsorName}`, 400, 140);
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 35px sans-serif';
    ctx.fillText(`Prize: ${amount}x ${itemName.toUpperCase()}`, 400, 210);

    try {
        const itemImg = await loadImage(imageUrl);
        ctx.drawImage(itemImg, 350, 240, 100, 100);
    } catch (err) {}

    const imagePath = path.join(__dirname, `prize_canvas_${Date.now()}_${Math.random()}.png`);
    const out = fs.createWriteStream(imagePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    return new Promise((resolve, reject) => {
        out.on('finish', () => resolve(imagePath));
        out.on('error', reject);
    });
}

async function generateWinnerCanvas(giveawayId, winnerName, itemName, amount, imageUrl) {
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#34495e';
    ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎉 WINNER FOR #${giveawayId} 🎉`, 400, 70);
    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText(winnerName, 400, 150);
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`Won: ${amount}x ${itemName.toUpperCase()}`, 400, 220);

    try {
        const itemImg = await loadImage(imageUrl);
        ctx.drawImage(itemImg, 350, 250, 100, 100);
    } catch (err) {}

    const imagePath = path.join(__dirname, `winner_canvas_${Date.now()}_${Math.random()}.png`);
    const out = fs.createWriteStream(imagePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    return new Promise((resolve, reject) => {
        out.on('finish', () => resolve(imagePath));
        out.on('error', reject);
    });
}

module.exports = {
    config: {
        name: "giveaway",
        version: "10.0",
        author: "Xdragon Bot",
        role: 0, 
        description: "Automated giveaway system with username mapping resolution using ~ identifier.",
        category: "admin",
        aliases: ["addgiveaway"]
    },

    onChat: async ({ event, api }) => {
        if (!event.body) return;
        const msgText = event.body.toLowerCase().trim();
        const senderID = String(event.senderID);
        
        if (msgText === "~join entry") {
            let data = loadData();
            const activeGiveaway = Object.values(data.giveaways).find(g => g.status === "open");
            
            if (!activeGiveaway) return api.sendMessage("🚫 There is currently no active open Giveaway round.", event.threadID);
            if (data.participants[senderID]) return api.sendMessage("⚠️ You have already joined this giveaway pool!", event.threadID);

            let name = "Member";
            try {
                const userInfo = await api.getUserInfo(senderID);
                if (userInfo && userInfo[senderID]) name = userInfo[senderID].name;
            } catch (e) {}

            const time = moment().tz("Asia/Manila").format("hh:mm A, MM/DD/YY");
            data.participants[senderID] = { name, item: "Pending", status: "Not Winner", time };
            saveData(data);

            return api.sendMessage(`✅ **Successfully Joined!**\n\nName: ${name}\nTime: ${time}\n\nYou are now in the pool. Good luck!`, event.threadID);
        }
    },

    onStart: async ({ event, args, message, api }) => {
        const threadID = String(event.threadID);
        const senderID = String(event.senderID);
        const bodyText = event.body || "";
        
        if (bodyText.toLowerCase().startsWith("!addgiveaway")) {
            const mentions = Object.keys(event.mentions);
            if (mentions.length === 0) return message.reply("❌ Error: Please mention a user. Format: !addgiveaway @mention ~username");
            
            const targetID = mentions[0];
            const mentionName = event.mentions[targetID];
            
            const cmdAndArgs = bodyText.slice(bodyText.indexOf(args[0]));
            let rawUsername = cmdAndArgs.replace(mentionName, "").trim();
            
            if (!rawUsername.startsWith("~")) {
                return message.reply("❌ Error: Username must start with the '~' symbol.\n\nExample: !addgiveaway @Dev Xdragon ~official_xdragon");
            }

            const username = rawUsername.substring(1).trim();
            
            if (!username) return message.reply("❌ Error: Missing username after '~'.");

            let data = loadData();
            data.usernames[targetID] = username;
            saveData(data);

            return message.reply(`✅ Successfully saved game username: "${username}" for ${mentionName}`);
        }

        const isAdmin = await isGroupAdmin(api, threadID, senderID);
        if (!isAdmin) return message.reply("❌ Error: Only Facebook Group Admins can manage the giveaway system.");
        
        if (args.length === 0) {
            return message.reply("📌 **Commands:**\n!giveaway ping on/off\n!giveaway {Item} {PCs} {Sponsored} {Timer} {ID}\n!addgiveaway {@mention} {~username}");
        }

        const cmdCheck = args[0]?.toLowerCase();
        let data = loadData();

        if (cmdCheck === "ping") {
            const status = args[1]?.toLowerCase();
            if (status === "on") {
                if (!data.activeThreads.includes(threadID)) data.activeThreads.push(threadID);
                saveData(data);
                return message.reply(`(Give Away Ping 📌)\n\nThe GiveAway winner announcements are now **ON** for this thread!`);
            }
            if (status === "off") {
                data.activeThreads = data.activeThreads.filter(id => id !== threadID);
                saveData(data);
                return message.reply(`(Give Away Ping Closed 🚫)\n\nThe GiveAway winner announcements have been turned **OFF** for this thread.`);
            }
            return message.reply("❌ Use: !giveaway ping on/off");
        }

        if (args.length < 5) {
            return message.reply("❌ Invalid format!\nUse: !giveaway {Item} {PCs} {Sponsored} {Timer} {ID}\nExample: !giveaway carrot 100 @dev xdragon 5minutes 1");
        }

        let stockIndex = -1;
        for (let i = 0; i < args.length - 2; i++) {
            if (/^\d+$/.test(args[i])) { 
                stockIndex = i;
                break;
            }
        }

        if (stockIndex === -1 || stockIndex === 0) {
            return message.reply("❌ Stock/Pieces must be a valid number and placed after the item name!");
        }

        const itemRequested = args.slice(0, stockIndex).join(" ");
        const stock = parseInt(args[stockIndex], 10);
        const sponsorName = args.slice(stockIndex + 1, args.length - 2).join(" ");
        const timerStr = args[args.length - 2];
        const giveawayId = args[args.length - 1];

        const ms = parseTimer(timerStr);
        if (!ms) return message.reply("❌ Invalid timer format! Connect number and time unit (e.g., 5minutes, 10seconds, 1hour).");

        data.participants = {}; 
        data.giveaways[giveawayId] = { item: itemRequested, stock: stock, sponsor: sponsorName, status: "open", originThread: threadID };
        saveData(data);

        const itemKey = itemRequested.toLowerCase();
        let imageUrl = GAME_IMAGES[itemKey] ? imgBase + GAME_IMAGES[itemKey] : DEFAULT_IMAGE;

        let startText = `🚨 **GIVEAWAY ROUND STARTED: #${giveawayId}** 🚨\n\n👤 Sponsored by: **${sponsorName}**\n🎁 Prize: **${stock}x ${itemRequested.toUpperCase()}**\n⏳ Duration: **${timerStr}**\n\n⚠️ Everyone must type **~join entry** to join this new round!`;

        try {
            const imagePath = await generatePrizeCanvas(giveawayId, itemRequested, stock, imageUrl, sponsorName);
            await api.sendMessage({ body: startText, attachment: fs.createReadStream(imagePath) }, threadID);
            fs.unlinkSync(imagePath);
        } catch (e) {
            await api.sendMessage(startText, threadID);
        }

        setTimeout(async () => {
            let currentData = loadData();
            if (!currentData.giveaways[giveawayId] || currentData.giveaways[giveawayId].status !== "open") return;

            let eligibleUsers = Object.keys(currentData.participants).filter(uid => currentData.participants[uid].status === "Not Winner");
            
            if (eligibleUsers.length === 0) {
                currentData.giveaways[giveawayId].status = "closed";
                saveData(currentData);
                for (const tID of currentData.activeThreads) {
                    try { await api.sendMessage(`⚠️ Giveaway #${giveawayId} ended, but no entries were found in the pool.`, tID); } catch(err){}
                }
                return;
            }

            let winnerUid = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
            currentData.participants[winnerUid].status = "Winner";
            currentData.participants[winnerUid].item = `${stock}x ${itemRequested}`; 
            currentData.giveaways[giveawayId].status = "closed"; 
            saveData(currentData);

            const winnerName = currentData.participants[winnerUid].name;
            const gameUsername = currentData.usernames?.[winnerUid] || PRELOADED_USERNAMES[winnerName] || "no available";
            const timeNow = moment().tz("Asia/Manila").format("MM/DD/YYYY, hh:mm:ss A");
            const gcLink = `https://m.me/j/AbaD_g2xhKDMnCRg/?send_source=gc%3Acopy_invite_link_c`;

            let autoText = `🎊 **WINNER FOR GIVEAWAY #${giveawayId}** 🎊\n\n🎁 Prize: **${stock}pcs** of **${itemRequested.toUpperCase()}**\n🎉 Winner: **${winnerName}**\n👤 Username: **${gameUsername}**\n📅 Ended at: **${timeNow}**\n🌐 Claim your prize at this GC: ${gcLink}\n\nCongratulations! 🌱`;

            try {
                const imagePath = await generateWinnerCanvas(giveawayId, winnerName, itemRequested, stock, imageUrl);
                for (const tID of currentData.activeThreads) {
                    try { await api.sendMessage({ body: autoText, attachment: fs.createReadStream(imagePath) }, tID); } catch (err) {}
                }
                fs.unlinkSync(imagePath);
            } catch (e) {
                for (const tID of currentData.activeThreads) {
                    try { await api.sendMessage(autoText, tID); } catch(err){}
                }
            }
        }, ms);
    }
};
