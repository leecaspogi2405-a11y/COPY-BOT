const fs = require('fs');
fs path = require('path');
const moment = require('moment-timezone');

const dataPath = path.join(__dirname, "autowarn_data.json");

// Cache for Group Admins to prevent Facebook API rate limits (spamming getThreadInfo)
const adminCache = {};
const CACHE_TTL = 5 * 60 * 1000; // Refreshes admin list every 5 minutes

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

// Helper function to dynamically check if someone is a Group Admin
async function isGroupAdmin(api, threadID, senderID) {
    const now = Date.now();
    // If cache is empty or expired, fetch new admin list from Facebook
    if (!adminCache[threadID] || (now - adminCache[threadID].timestamp > CACHE_TTL)) {
        try {
            const threadInfo = await api.getThreadInfo(threadID);
            const admins = threadInfo.adminIDs.map(admin => String(admin.id));
            adminCache[threadID] = { admins, timestamp: now };
        } catch (e) {
            console.error("Failed to fetch thread info:", e);
            return false; // Default to false if API fails
        }
    }
    return adminCache[threadID].admins.includes(String(senderID));
}

// Auto-warn background listener
async function processWarn({ event, api, message }) {
    // Ignore system messages (like changing group name/theme)
    if (!event.senderID || event.logMessageType) return;
    
    const threadID = String(event.threadID);
    const senderID = String(event.senderID);

    let data = loadData();
    
    // Ignore if autowarn is OFF in this thread
    if (!data.activeThreads.includes(threadID)) return;
    
    // EXEMPT THE BOT: If the sender is the bot itself, ignore
    if (senderID === String(api.getCurrentUserID())) return;

    // EXEMPT GROUP ADMINS: Check dynamically
    const isAdmin = await isGroupAdmin(api, threadID, senderID);
    if (isAdmin) return;

    // If it reaches here, the user is a normal member chatting while lockdown is ON
    let name = "Member";
    try {
        const userInfo = await api.getUserInfo(senderID);
        if (userInfo && userInfo[senderID]) name = userInfo[senderID].name;
    } catch (e) {}

    // Initialize data structures if they don't exist
    if (!data.warningsMap[threadID]) data.warningsMap[threadID] = {};
    if (!data.warningsMap[threadID][senderID]) {
        data.warningsMap[threadID][senderID] = { count: 0, name: name };
    }

    // Add warning
    data.warningsMap[threadID][senderID].count += 1;
    data.warningsMap[threadID][senderID].name = name; 
    const count = data.warningsMap[threadID][senderID].count;
    saveData(data);

    const time = moment().tz("Asia/Manila").format("MM/DD/YYYY, hh:mm:ss A");

    const msg = `⚠️ Warnings: ${count}/3\n` +
                `❎ Reason: Sending a message while Autowarn is ON!\n` +
                `🪪 UID: ${senderID}\n` +
                `📛 Name: ${name}\n` +
                `⏰ Time: ${time}\n` +
                `⚠️ Warned by: Xdragon Bot`;

    message.reply(msg);

    // Kick on 3rd warning
    if (count >= 3) {
        try {
            await api.removeUserFromGroup(senderID, threadID);
            message.reply(`🚷 ${name} has been kicked from the group for reaching 3 warnings!`);
            delete data.warningsMap[threadID][senderID];
            saveData(data);
        } catch (err) {
            message.reply(`⚠️ ${name} reached 3 warnings but couldn't be kicked. Please ensure the bot is set as a Group Admin!`);
        }
    }
}

module.exports = {
    config: {
        name: "autowarn",
        version: "3.0",
        author: "Xdragon Bot",
        role: 0, 
        description: "Auto warn members who chat. Exempts Group Admins dynamically.",
        category: "admin",
        guide: "{pn} on | off | show | reset all | reset @mention"
    },

    onStart: async ({ event, args, message, api }) => {
        const threadID = String(event.threadID);
        const senderID = String(event.senderID);

        // Security Check: Only Group Admins can use this command
        const isAdmin = await isGroupAdmin(api, threadID, senderID);
        if (!isAdmin) {
            return message.reply("❌ Error: Only Group Admins are allowed to use this command.");
        }

        const cmd = args[0]?.toLowerCase();
        let data = loadData();

        // COMMAND: !autowarn on
        if (cmd === "on") {
            if (!data.activeThreads.includes(threadID)) {
                data.activeThreads.push(threadID);
                saveData(data);
            }
            return message.reply("✅ Autowarn is now ON for this group.\n\nChatting is currently prohibited! Any normal member who sends a message will receive a warning.\n(Note: Group Admins are automatically exempted).");
        }

        // COMMAND: !autowarn off
        if (cmd === "off") {
            data.activeThreads = data.activeThreads.filter(id => id !== threadID);
            saveData(data);
            return message.reply("❎ Autowarn is now OFF.\n\nEveryone can chat freely again. (Note: Previous warnings are kept in the system unless you use the reset command).");
        }

        // COMMAND: !autowarn show
        if (cmd === "show") {
            const warns = data.warningsMap[threadID];
            if (!warns || Object.keys(warns).length === 0) {
                return message.reply("✅ No one has any warnings in this group yet.");
            }
            
            let listMsg = "📋 **List of Warned Members:**\n\n";
            let index = 1;
            for (const uid in warns) {
                listMsg += `${index}. ${warns[uid].name} - [${warns[uid].count}/3] warnings\n`;
                index++;
            }
            return message.reply(listMsg);
        }

        // COMMAND: !autowarn reset
        if (cmd === "reset") {
            const target = args[1]?.toLowerCase();
            
            // Reset ALL
            if (target === "all") {
                if (data.warningsMap[threadID]) {
                    delete data.warningsMap[threadID];
                    saveData(data);
                }
                return message.reply("✅ All warnings for everyone in this group have been successfully reset.");
            } 
            
            // Reset Specific Mentions
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
                return message.reply("❌ Invalid reset format!\n\nUse:\n!autowarn reset all\n!autowarn reset @mention");
            }
        }

        // Default response if no valid command is typed
        const helpMsg = `❌ Invalid command!\n\n📌 **How to use:**\n` +
                        `• !autowarn on - Turn on lockdown\n` +
                        `• !autowarn off - Turn off lockdown\n` +
                        `• !autowarn show - List warned members\n` +
                        `• !autowarn reset all - Clear all warnings\n` +
                        `• !autowarn reset @name - Clear someone's warnings`;
                        
        return message.reply(helpMsg);
    },
    
    onChat: processWarn,
    handleEvent: processWarn
};
