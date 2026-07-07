const fs = require('fs');
fs path = require('path');
const moment = require('moment-timezone');

const dataPath = path.join(__dirname, "autodetect_data.json");

// --- CACHES ---
// Cache for Group Admins to prevent API rate limits
const adminCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for Anti-Spam (Stores message timestamps per user per thread)
const spamTracker = {}; 
const SPAM_LIMIT = 5; // Max messages
const SPAM_TIME = 60 * 1000; // 1 minute window (60,000 ms)

// --- WORD FILTERS ---
// Add or remove bad words here (English & Tagalog)
const BAD_WORDS = [
    "fuck", "shit", "bitch", "asshole", "cunt", "dick", "motherfucker",
    "putangina", "tanga", "bobo", "gago", "tarantado", "hayop", "pakyu", "pota", "puta", "inamo"
];

// Phrases that trigger harassment warnings
const HARASSMENT_PHRASES = [
    "kill yourself", "kys", "mamatay ka na", "magbigti"
];

// --- DATA MANAGEMENT ---
function loadData() {
    if (!fs.existsSync(dataPath)) return { activeThreads: [], warningsMap: {} };
    try {
        return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    } catch (e) {
        return { activeThreads: [], warningsMap: {} };
    }
}

function saveData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Helper: Check if user is an Admin dynamically
async function isGroupAdmin(api, threadID, senderID) {
    const now = Date.now();
    if (!adminCache[threadID] || (now - adminCache[threadID].timestamp > CACHE_TTL)) {
        try {
            const threadInfo = await api.getThreadInfo(threadID);
            const admins = threadInfo.adminIDs.map(admin => String(admin.id));
            adminCache[threadID] = { admins, timestamp: now };
        } catch (e) {
            console.error("Failed to fetch thread info:", e);
            return false;
        }
    }
    return adminCache[threadID].admins.includes(String(senderID));
}

// Helper: Apply Warning & Check Kick
async function applyWarning(api, message, threadID, senderID, name, reason) {
    let data = loadData();

    if (!data.warningsMap[threadID]) data.warningsMap[threadID] = {};
    if (!data.warningsMap[threadID][senderID]) {
        data.warningsMap[threadID][senderID] = { count: 0, name: name };
    }

    data.warningsMap[threadID][senderID].count += 1;
    data.warningsMap[threadID][senderID].name = name; 
    const count = data.warningsMap[threadID][senderID].count;
    saveData(data);

    const time = moment().tz("Asia/Manila").format("MM/DD/YYYY, hh:mm:ss A");

    const msg = `⚠️ **WARNING ISSUED** [${count}/3]\n` +
                `👤 Name: ${name}\n` +
                `🪪 UID: ${senderID}\n` +
                `❎ Reason: ${reason}\n` +
                `⏰ Time: ${time}\n` +
                `🤖 System: AutoModerator`;

    message.reply(msg);

    // Kick on 3rd warning
    if (count >= 3) {
        try {
            await api.removeUserFromGroup(senderID, threadID);
            message.reply(`🚷 ${name} has been kicked from the group for reaching 3 warnings due to rule violations!`);
            delete data.warningsMap[threadID][senderID];
            saveData(data);
        } catch (err) {
            message.reply(`⚠️ ${name} reached 3 warnings but couldn't be kicked. Please ensure the bot is set as a Group Admin!`);
        }
    }
}

// --- BACKGROUND LISTENER (AUTO-DETECT) ---
async function processAutoDetect({ event, api, message }) {
    if (!event.senderID || !event.body) return; // Only process text messages

    const threadID = String(event.threadID);
    const senderID = String(event.senderID);
    let data = loadData();

    // Ignore if feature is OFF in this thread
    if (!data.activeThreads.includes(threadID)) return;

    // EXEMPT THE BOT
    if (senderID === String(api.getCurrentUserID())) return;

    // EXEMPT GROUP ADMINS
    const isAdmin = await isGroupAdmin(api, threadID, senderID);
    if (isAdmin) return;

    const msgText = event.body.toLowerCase();
    const now = Date.now();
    let name = "Member";
    
    try {
        const userInfo = await api.getUserInfo(senderID);
        if (userInfo && userInfo[senderID]) name = userInfo[senderID].name;
    } catch (e) {}

    let violation = null;

    // 1. SPAM DETECTION LOGIC
    if (!spamTracker[threadID]) spamTracker[threadID] = {};
    if (!spamTracker[threadID][senderID]) spamTracker[threadID][senderID] = [];

    // Keep only timestamps within the last 60 seconds
    spamTracker[threadID][senderID] = spamTracker[threadID][senderID].filter(t => now - t < SPAM_TIME);
    spamTracker[threadID][senderID].push(now);

    if (spamTracker[threadID][senderID].length >= SPAM_LIMIT) {
        violation = "Spamming (Sent 5+ messages in 1 minute).";
        spamTracker[threadID][senderID] = []; // Reset spam cache for this user to prevent loop
    } 
    
    // 2. BAD WORD DETECTION LOGIC (Only check if not already flagged for spam)
    if (!violation) {
        // Remove punctuation for accurate word matching
        const cleanText = msgText.replace(/[^\w\s]/g, "");
        const words = cleanText.split(/\s+/);
        
        const hasBadWord = words.some(word => BAD_WORDS.includes(word));
        if (hasBadWord) {
            violation = "Using profanity/bad words in the chat.";
        }
    }

    // 3. HARASSMENT DETECTION LOGIC
    if (!violation) {
        const hasHarassment = HARASSMENT_PHRASES.some(phrase => msgText.includes(phrase));
        if (hasHarassment) {
            violation = "Sending severe harassment or toxic phrases.";
        }
    }

    // Apply Warning if a violation was found
    if (violation) {
        await applyWarning(api, message, threadID, senderID, name, violation);
    }
}

module.exports = {
    config: {
        name: "autodetect",
        version: "4.0",
        author: "Xdragon Bot",
        role: 0, 
        description: "Advanced Auto-Moderator: Detects spam, bad words, harassment, and allows manual admin warnings.",
        category: "admin",
        guide: "{pn} on | off | show | reset all/@mention | warn @mention [reason]"
    },

    onStart: async ({ event, args, message, api }) => {
        const threadID = String(event.threadID);
        const senderID = String(event.senderID);

        // Security Check: Only Group Admins can use configuration commands
        const isAdmin = await isGroupAdmin(api, threadID, senderID);
        if (!isAdmin) {
            return message.reply("❌ Error: Only Group Admins are allowed to manage the AutoDetect system.");
        }

        const cmd = args[0]?.toLowerCase();
        let data = loadData();

        // COMMAND: !autodetect on
        if (cmd === "on") {
            if (!data.activeThreads.includes(threadID)) {
                data.activeThreads.push(threadID);
                saveData(data);
            }
            return message.reply("✅ **AutoDetect is now ON.**\n\nThe bot will now automatically scan and warn members for:\n• Spamming (5 msgs/min)\n• Bad Words (Eng/Tag)\n• Harassment");
        }

        // COMMAND: !autodetect off
        if (cmd === "off") {
            data.activeThreads = data.activeThreads.filter(id => id !== threadID);
            saveData(data);
            return message.reply("❎ **AutoDetect is now OFF.**\n\nThe bot will no longer scan messages. (Previous warnings are saved).");
        }

        // COMMAND: !autodetect show
        if (cmd === "show") {
            const warns = data.warningsMap[threadID];
            if (!warns || Object.keys(warns).length === 0) {
                return message.reply("✅ No members have any warnings in this group.");
            }

            let listMsg = "📋 **List of Warned Members:**\n\n";
            let index = 1;
            for (const uid in warns) {
                listMsg += `${index}. ${warns[uid].name} - [${warns[uid].count}/3] warnings\n`;
                index++;
            }
            return message.reply(listMsg);
        }

        // COMMAND: !autodetect reset
        if (cmd === "reset") {
            const target = args[1]?.toLowerCase();

            if (target === "all") {
                if (data.warningsMap[threadID]) {
                    delete data.warningsMap[threadID];
                    saveData(data);
                }
                return message.reply("✅ All warnings for everyone in this group have been successfully reset.");
            } 
            else if (event.mentions && Object.keys(event.mentions).length > 0) {
                let resetList = [];
                for (let mentionedUID in event.mentions) {
                    if (data.warningsMap[threadID] && data.warningsMap[threadID][mentionedUID]) {
                        delete data.warningsMap[threadID][mentionedUID];
                        resetList.push(event.mentions[mentionedUID].replace("@", ""));
                    }
                }
                saveData(data);
                if (resetList.length > 0) {
                    return message.reply(`✅ Successfully reset warnings for: ${resetList.join(", ")}`);
                } else {
                    return message.reply("⚠️ The mentioned user(s) currently do not have any warnings.");
                }
            } 
            else {
                return message.reply("❌ Invalid format! Use:\n!autodetect reset all\n!autodetect reset @mention");
            }
        }

        // COMMAND: !autodetect warn @mention [reason]
        // Example: !autodetect warn @John Harassment / Not following group rules
        if (cmd === "warn") {
            if (!event.mentions || Object.keys(event.mentions).length === 0) {
                return message.reply("❌ You need to mention someone to warn them.\nExample: !autodetect warn @name Not following rules");
            }

            const mentionIDs = Object.keys(event.mentions);
            const firstMentionID = mentionIDs[0]; // Take the first mentioned user
            const rawName = event.mentions[firstMentionID];
            const cleanName = rawName.replace("@", "");
            
            // Extract reason (everything typed after the mention)
            let reason = args.slice(2).join(" ");
            if (!reason) reason = "Violating group rules / Administrator Warning";

            // Apply the warning using the helper function
            await applyWarning(api, message, threadID, firstMentionID, cleanName, reason);
            return; // Exit after warning so help message doesn't trigger
        }

        // Default Help Response
        const helpMsg = `🛡️ **AutoDetect Commands:**\n\n` +
            `• !autodetect on - Enable AutoMod\n` +
            `• !autodetect off - Disable AutoMod\n` +
            `• !autodetect show - List warned users\n` +
            `• !autodetect reset all - Clear all data\n` +
            `• !autodetect reset @user - Clear user data\n` +
            `• !autodetect warn @user [reason] - Manually warn someone (e.g., Harassment/Rules)\n\n` +
            `*Automated Systems: Anti-Spam (5 msg/min), Profanity Filter, Toxicity Check.*`;

        return message.reply(helpMsg);
    },

    onChat: processAutoDetect,
    handleEvent: processAutoDetect
};
