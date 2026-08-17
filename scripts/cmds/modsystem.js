module.exports.config = {
    name: "mod",
    version: "3.0.0",
    hasPermssion: 0,
    credits: "Dev Xdragon",
    description: "Moderator application system",
    commandCategory: "system",
    usages: "apply | tutorial | add <num> | list",
    cooldowns: 5
};

// Global memory persistence
if (!global.modSystemData) {
    global.modSystemData = {
        maxMods: 2,
        cooldowns: new Map(),
        currentMods: new Map()
    };
}

function getCurrentDateTime() {
    return new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
}

// Handle ✅ / ❎ Replies
module.exports.handleReply = async function({ api, event, handleReply }) {
    const { author, name, robloxUser, timeAndDate } = handleReply;
    const threadID = event.threadID;
    const senderID = event.senderID;
    const message = event.body.trim();

    if (senderID !== author) return;

    const data = global.modSystemData;

    if (message === '✅') {
        if (data.currentMods.size >= data.maxMods) {
            return api.sendMessage(`❌ Sorry, the maximum number of moderators (${data.maxMods}) has already been reached.`, threadID, event.messageID);
        }

        data.currentMods.set(senderID, { name, robloxUser, time: timeAndDate });
        const currentCount = data.currentMods.size;

        const confirmMsg = `Account update [Confirmed] Congratulations you are now officially an moderator ${currentCount}/${data.maxMods}\n` +
                           `📛Name: ${name}\n` +
                           `🪪Id: Secret\n` +
                           `🧾Uid: ${senderID}\n` +
                           `🗝️Role: Moderator\n` +
                           `💳Rbxl user: ${robloxUser}\n` +
                           `⏰Time & date: ${timeAndDate}\n` +
                           `----------------------------------\n` +
                           `Made by: Xdrg Moderator Service\n` +
                           `Sending to: Dev Xdragon`;

        api.sendMessage(confirmMsg, threadID);

        api.changeNickname(`[Moderator🔨] ${name}`, threadID, senderID, (err) => {
            if (err) console.error("Could not change nickname:", err);
        });

        api.unsendMessage(handleReply.messageID);

    } else if (message === '❎') {
        data.cooldowns.set(senderID, Date.now() + 300000); // 5 minutes

        const rejectMsg = `${name} try again in 5 minutes to cooldown the system/xdrg service system try type again👇\n` +
                          `------------------------------\n` +
                          `~mod apply\n` +
                          `Name:${name}\n` +
                          `Id:Secret<-bot reply this sa nag apply\n` +
                          `Roblox username:${robloxUser}`;

        api.sendMessage(rejectMsg, threadID);
        api.unsendMessage(handleReply.messageID);
    }
};

// Main Command Runner
module.exports.run = async function({ api, event, args, permssion }) {
    const { threadID, senderID, body } = event;
    const data = global.modSystemData;
    const subCommand = args[0] ? args[0].toLowerCase() : "";

    // ADMIN COMMAND: Adjust limit
    if (subCommand === "add") {
        if (permssion < 1) {
            return api.sendMessage("❌ You don't have admin permissions for this command.", threadID, event.messageID);
        }
        const newMax = parseInt(args[1], 10);
        if (isNaN(newMax) || newMax < 1) {
            return api.sendMessage("⚠️ Use format: !mod add <number> (e.g., !mod add 5)", threadID, event.messageID);
        }
        data.maxMods = newMax;
        return api.sendMessage(`✅ The moderator limit has been updated to ${data.maxMods} successfully.`, threadID, event.messageID);
    }

    // ADMIN COMMAND: View mod list
    if (subCommand === "list") {
        if (permssion < 1) {
            return api.sendMessage("❌ You don't have admin permissions for this command.", threadID, event.messageID);
        }
        if (data.currentMods.size === 0) {
            return api.sendMessage("📋 There are currently no moderators.", threadID, event.messageID);
        }

        let listMsg = `📋 CURRENT MODERATORS (${data.currentMods.size}/${data.maxMods})\n\n`;
        let index = 1;
        for (const [uid, modData] of data.currentMods.entries()) {
            listMsg += `${index}. ${modData.name}\n   💳 Rbxl: ${modData.robloxUser}\n   🧾 Uid: ${uid}\n   ⏰ Promoted: ${modData.time}\n\n`;
            index++;
        }
        return api.sendMessage(listMsg.trim(), threadID, event.messageID);
    }

    // USER COMMAND: Tutorial
    if (subCommand === "tutorial") {
        const tutorialMsg = `📖 MODERATOR APPLICATION TUTORIAL 📖\n\n` +
                            `To apply, type:\n\n` +
                            `~mod apply\n` +
                            `Name: {Your Name}\n` +
                            `Roblox username: {Your Roblox User}\n\n` +
                            `Notes:\n` +
                            `* Reply with ✅ to confirm or ❎ to cancel.\n` +
                            `* Canceling triggers a 5-minute cooldown.`;
        return api.sendMessage(tutorialMsg, threadID, event.messageID);
    }

    // USER COMMAND: Apply
    if (subCommand === "apply") {
        if (data.currentMods.size >= data.maxMods) {
            return api.sendMessage(`❌ The application is closed. Max limit of ${data.maxMods} moderators reached.`, threadID, event.messageID);
        }

        if (data.cooldowns.has(senderID)) {
            const exp = data.cooldowns.get(senderID);
            if (Date.now() < exp) {
                const timeLeft = Math.ceil((exp - Date.now()) / 60000);
                return api.sendMessage(`⏳ Please wait ${timeLeft} minute(s) before applying again.`, threadID, event.messageID);
            } else {
                data.cooldowns.delete(senderID);
            }
        }

        const lines = body.split('\n');
        let name = "Unknown";
        let robloxUser = "Unknown";

        lines.forEach(line => {
            const lower = line.toLowerCase();
            if (lower.includes('name:')) {
                name = line.substring(line.toLowerCase().indexOf('name:') + 5).trim();
            } else if (lower.includes('roblox username:')) {
                robloxUser = line.substring(line.toLowerCase().indexOf('roblox username:') + 16).trim();
            }
        });

        if (name === "Unknown" && robloxUser === "Unknown") {
            return api.sendMessage("⚠️ Invalid format! Type `~mod tutorial` or `!mod tutorial` for instructions.", threadID, event.messageID);
        }

        const timeAndDate = getCurrentDateTime();
        const replyMsg = `Confirmision🧾\n` +
                         `📛Name: ${name}\n` +
                         `🪪Id: Secret\n` +
                         `🧾Uid: ${senderID}\n` +
                         `🗝️Role: Moderator\n` +
                         `💳Rbxl user: ${robloxUser}\n` +
                         `⏰Time & date: ${timeAndDate}\n` +
                         `----------------------------------\n` +
                         `Made by: Xdrg Moderator Service\n` +
                         `Sending to: Dev Xdragon\n\n` +
                         `Reply with ✅ to confirm or ❎ to cancel.`;

        return api.sendMessage(replyMsg, threadID, (err, info) => {
            if (!err) {
                global.client.handleReply.push({
                    name: this.config.name,
                    messageID: info.messageID,
                    author: senderID,
                    name: name,
                    robloxUser: robloxUser,
                    timeAndDate: timeAndDate
                });
            }
        });
    }

    return api.sendMessage("⚠️ Usage:\n• ~mod apply\n• ~mod tutorial\n• !mod add <number>\n• !mod list", threadID, event.messageID);
};
