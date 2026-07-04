const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

const dataPath = path.join(__dirname, "autowarn_data.json");

// EXEMPTED FROM WARNINGS (Bot UID and Admin UIDs only)
const exemptedUIDs = [
    "61585471672439",  // Bot UID
    "61578056887855",  // Admin 1
    "100059484207000", // Admin 2
    "61589047318104",  // Admin 3
    "61591725114394",  // Admin 4
    "61583174657283"   // Admin 5
];

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

async function processWarn({ event, api, message }) {
    if (!event.body) return;
    
    let data = loadData();
    if (!data.activeThreads.includes(event.threadID)) return;
    if (exemptedUIDs.includes(String(event.senderID))) return;

    let name = "Member";
    try {
        const userInfo = await api.getUserInfo(event.senderID);
        if (userInfo && userInfo[event.senderID]) name = userInfo[event.senderID].name;
    } catch (e) {}

    if (!data.warningsMap[event.threadID]) data.warningsMap[event.threadID] = {};
    if (!data.warningsMap[event.threadID][event.senderID]) {
        data.warningsMap[event.threadID][event.senderID] = { count: 0, name: name };
    }

    data.warningsMap[event.threadID][event.senderID].count += 1;
    data.warningsMap[event.threadID][event.senderID].name = name; 
    const count = data.warningsMap[event.threadID][event.senderID].count;
    saveData(data);

    const time = moment().tz("Asia/Manila").format("MM/DD/YYYY, hh:mm:ss A");

    const msg = `⚠️ Warnings: ${count}/3\n` +
                `❎ Reason: Sending a message while Autowarn is ON!\n` +
                `🪪 UID: ${event.senderID}\n` +
                `📛 Name: ${name}\n` +
                `⏰ Time: ${time}\n` +
                `⚠️ Warned by: Xdragon Bot`;

    message.reply(msg);

    if (count >= 3) {
        try {
            await api.removeUserFromGroup(event.senderID, event.threadID);
            message.reply(`🚷 ${name} has been kicked from the group for reaching 3 warnings!`);
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

        if (cmd === "on") {
            if (!data.activeThreads.includes(threadID)) {
                data.activeThreads.push(threadID);
                saveData(data);
            }
            return message.reply("✅ Autowarn is now ON for this group.\n\nChatting is currently prohibited! Anyone who messages will receive a warning.\n(Note: Allowed Admins are exempt).");
        }

        if (cmd === "off") {
            data.activeThreads = data.activeThreads.filter(id => id !== threadID);
            if (data.warningsMap[threadID]) delete data.warningsMap[threadID];
            saveData(data);
            return message.reply("❎ Autowarn is now OFF.\n\nEveryone can chat again. All previous warnings in this group have been reset.");
        }

        return message.reply("❌ Invalid command!\n\nHow to use:\n!autowarn on - Turn on lockdown\n!autowarn off - Turn off lockdown");
    },
    onChat: processWarn,
    handleEvent: processWarn
};
