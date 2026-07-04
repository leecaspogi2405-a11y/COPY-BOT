const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

// The data for each group chat is saved here to persist even after bot restarts
const dataPath = path.join(__dirname, "autowarn_data.json");

// EXEMPTED FROM WARNINGS (Bot UID and Admin UIDs only)
const exemptedUIDs = [
    "61585471672439",  // Bot UID
    "61578056887855",  // Admin 1
    "100059484207000", // Admin 2
    "61589047318104",  // Admin 3
    "61591725114394",  // Admin 4
    "61583174657283"   // Admin 5 (Newly Added)
];

// Helper function to load the database automatically
function loadData() {
    if (!fs.existsSync(dataPath)) {
        return { activeThreads: [], warningsMap: {} };
    }
    try {
        return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    } catch (e) {
        return { activeThreads: [], warningsMap: {} };
    }
}

// Helper function to save the database automatically
function saveData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Function to intercept all chats in the group
async function processWarn({ event, api, message }) {
    // Ensure it's a message and not a system notification
    if (!event.body) return;
    
    let data = loadData();
    
    // Ignore if autowarn is OFF in this group
    if (!data.activeThreads.includes(event.threadID)) return;
    
    // LOGIC FIX: Only the specified UIDs are safe from warnings.
    // If the sender is the Bot or one of the Admins above, IGNORE them.
    if (exemptedUIDs.includes(String(event.senderID))) return;

    // Get the user's name
    let name = "Member";
    try {
        const userInfo = await api.getUserInfo(event.senderID);
        if (userInfo && userInfo[event.senderID]) {
            name = userInfo[event.senderID].name;
        }
    } catch (e) {
        console.error("Error fetching user info:", e);
    }

    // Initialize group warnings if they don't exist yet
    if (!data.warningsMap[event.threadID]) {
        data.warningsMap[event.threadID] = {};
    }
    
    // Get current user data or create a new entry
    if (!data.warningsMap[event.threadID][event.senderID]) {
        data.warningsMap[event.threadID][event.senderID] = { count: 0, name: name };
    }

    // Add 1 to the warning count and update their name
    data.warningsMap[event.threadID][event.senderID].count += 1;
    data.warningsMap[event.threadID][event.senderID].name = name; 

    const count = data.warningsMap[event.threadID][event.senderID].count;
    
    // Save data back to the JSON file immediately
    saveData(data);

    // Get the current time (Philippine Time)
    const time = moment().tz("Asia/Manila").format("MM/DD/YYYY, hh:mm:ss A");

    // Format the warning message
    const msg = `⚠️ Warnings: ${count}/3\n` +
                `❎ Reason: Sending a message while Autowarn is ON!\n` +
                `🪪 UID: ${event.senderID}\n` +
                `📛 Name: ${name}\n` +
                `⏰ Time: ${time}\n` +
                `⚠️ Warned by: Xdragon Bot`;

    // Send the warning
    message.reply(msg);

    // Kick the user if they reach 3 warnings
    if (count >= 3) {
        try {
            await api.removeUserFromGroup(event.senderID, event.threadID);
            message.reply(`🚷 ${name} has been kicked from the group for reaching 3 warnings!`);
            
            // Reset their individual warning count after kicking
            delete data.warningsMap[event.threadID][event.senderID];
            saveData(data);
        } catch (err) {
            message.reply(`⚠️ ${name} reached 3 warnings but couldn't be kicked because the bot is not an Admin.`);
        }
    }
}

module.exports = {
    config: {
        name: "autowarn",
        version: "2.7",
        author: "Xdragon Bot",
        role: 1, 
        description: "Auto warn members who chat or spam. Supports Multiple GCs with permanent save.",
        category: "admin",
        guide: "{pn} on | off | show | reset all | reset @user"
    },

    onStart: async ({ event, args, message }) => {
        const cmd = args[0]?.toLowerCase();
        const threadID = event.threadID;
        let data = loadData();

        // Turn ON autowarn
        if (cmd === "on") {
            if (!data.activeThreads.includes(threadID)) {
                data.activeThreads.push(threadID);
                saveData(data);
            }
            return message.reply("✅ Autowarn is now ON for this group.\n\nChatting is currently prohibited! Anyone who messages will receive a warning.\n(Note: Allowed Admins are exempt).");
        }

        // Turn OFF autowarn
        if (cmd === "off") {
            data.activeThreads = data.activeThreads.filter(id => id !== threadID);
            if (data.warningsMap[threadID]) {
                delete data.warningsMap[threadID];
            }
            saveData(data);
            return message.reply("❎ Autowarn is now OFF.\n\nEveryone can chat again. All previous warnings in this group have been reset.");
        }

        // SHOW current warnings
        if (cmd === "show") {
            const threadWarnings = data.warningsMap[threadID];
            if (!threadWarnings || Object.keys(threadWarnings).length === 0) {
                return message.reply("✅ No one has any warnings in this group currently.");
            }
            
            let msg = "⚠️ **CURRENT WARNINGS** ⚠️\n\n";
            for (const [uid, userData] of Object.entries(threadWarnings)) {
                msg += `📛 ${userData.name}\n🪪 UID: ${uid}\n⚠️ Warnings: ${userData.count}/3\n\n`;
            }
            return message.reply(msg.trim());
        }

        // RESET warnings
        if (cmd === "reset") {
            const target = args[1]?.toLowerCase();
            const threadWarnings = data.warningsMap[threadID];

            if (!threadWarnings || Object.keys(threadWarnings).length === 0) {
                return message.reply("✅ There are no warnings to reset in this group.");
            }

            // Reset ALL users
            if (target === "all") {
                delete data.warningsMap[threadID];
                saveData(data);
                return message.reply("✅ All warnings in this group have been successfully reset.");
            }

            // Reset SPECIFIC users via mention
            const mentions = Object.keys(event.mentions || {});
            if (mentions.length > 0) {
                let resetNames = [];
                for (const uid of mentions) {
                    if (threadWarnings[uid]) {
                        resetNames.push(threadWarnings[uid].name);
                        delete data.warningsMap[threadID][uid]; // Reset back to zero by removing them from DB
                    }
                }
                
                if (resetNames.length > 0) {
                    saveData(data);
                    return message.reply(`✅ Successfully reset warnings for: ${resetNames.join(", ")}`);
                } else {
                    return message.reply("❎ The mentioned user(s) do not currently have any warnings.");
                }
            }

            return message.reply("❌ Invalid format!\n\nUse:\n!autowarn reset all\n!autowarn reset @mention");
        }

        // Default invalid command response
        return message.reply("❌ Invalid command!\n\nHow to use:\n!autowarn on - Turn on lockdown\n!autowarn off - Turn off lockdown\n!autowarn show - List warned users\n!autowarn reset all - Reset all warnings\n!autowarn reset @mention - Reset warning for specific user");
    },

    // These catch every message sent in the group
    onChat: processWarn,
    handleEvent: processWarn
};
const
