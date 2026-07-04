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
        description: "Auto warn members who chat or spam.",
        category: "admin",
        guide: "{pn} on | off"
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

        // Default invalid command response
        return message.reply("❌ Invalid command!\n\nHow to use:\n!autowarn on - Turn on lockdown\n!autowarn off - Turn off lockdown");
    },

    // These catch every message sent in the group
    onChat: processWarn,
    handleEvent: processWarn
};
