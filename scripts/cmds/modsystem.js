const pendingApplications = new Map();
const cooldowns = new Map();
const moderatorsList = new Map();

let MAX_MODERATORS = 2; // Default limit

function getCurrentDateTime() {
    return new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
}

// Function para i-check kung Admin ang nag-command gamit ang global config ng bot
function isBotAdmin(senderID) {
    if (global.config && Array.isArray(global.config.ADMINBOT)) {
        return global.config.ADMINBOT.includes(senderID);
    }
    return false;
}

function handleMessage(api, event) {
    const message = event.body ? event.body.trim() : "";
    const senderID = event.senderID;
    const threadID = event.threadID;

    // ==========================================
    // 1. HANDLE REPLIES (✅ or ❎)
    // ==========================================
    if (pendingApplications.has(senderID)) {
        const app = pendingApplications.get(senderID);

        if (message === '✅') {
            if (moderatorsList.size >= MAX_MODERATORS) {
                api.sendMessage(`❌ Sorry, maximum number of moderators (${MAX_MODERATORS}) reached already.`, threadID);
                pendingApplications.delete(senderID);
                return;
            }

            moderatorsList.set(senderID, {
                name: app.name,
                robloxUser: app.robloxUser,
                approvedAt: app.time
            });

            const currentCount = moderatorsList.size;
            const confirmMsg = `Account update [Confirmed] Congratulations you are now officially an moderator ${currentCount}/${MAX_MODERATORS}\n` +
                               `📛Name: ${app.name}\n` +
                               `🪪Id: Secret\n` +
                               `🧾Uid: ${senderID}\n` +
                               `🗝️Role: Moderator\n` +
                               `💳Rbxl user: ${app.robloxUser}\n` +
                               `⏰Time & date: ${app.time}\n` +
                               `----------------------------------\n` +
                               `Made by: Xdrg Moderator Service\n` +
                               `Sending to: Dev Xdragon`;

            api.sendMessage(confirmMsg, threadID);

            const newNickname = `[Moderator🔨] ${app.name}`;
            api.changeNickname(newNickname, threadID, senderID, (err) => {
                if (err) console.error("Could not change nickname:", err);
            });

            pendingApplications.delete(senderID);
            return;
        } 
        
        else if (message === '❎') {
            cooldowns.set(senderID, Date.now() + 300000); // 5 minutes cooldown

            const rejectMsg = `${app.name} try again in 5 minutes to cooldown the system/xdrg service system try type again👇\n` +
                              `------------------------------\n` +
                              `~mod apply\n` +
                              `Name:${app.name}\n` +
                              `Id:Secret\n` +
                              `Roblox username:${app.robloxUser}`;

            api.sendMessage(rejectMsg, threadID);
            pendingApplications.delete(senderID);
            return;
        }
    }

    // ==========================================
    // 2. ADMIN COMMANDS (Prefix: !)
    // ==========================================
    if (message.startsWith('!')) {
        const isAdmin = isBotAdmin(senderID);

        // Command: !add mod {number}
        if (message.toLowerCase().startsWith('!add mod')) {
            if (!isAdmin) {
                return api.sendMessage("❌ Only Bot Admins can use this command.", threadID);
            }

            const args = message.split(/\s+/);
            const newLimit = parseInt(args[2]);

            if (isNaN(newLimit) || newLimit < 1) {
                return api.sendMessage("❌ Usage: !add mod {number} (e.g., !add mod 5)", threadID);
            }

            MAX_MODERATORS = newLimit;
            return api.sendMessage(`✅ **System Update:** Required moderator limit adjusted to **${MAX_MODERATORS}**.`, threadID);
        }

        // Command: !mod list
        if (message.toLowerCase() === '!mod list') {
            if (!isAdmin) {
                return api.sendMessage("❌ Only Bot Admins can view the moderator list.", threadID);
            }

            if (moderatorsList.size === 0) {
                return api.sendMessage(`🛡️ **Moderator List** (0/${MAX_MODERATORS}):\nNo active moderators registered yet.`, threadID);
            }

            let listMsg = `🛡️ **ACTIVE MODERATORS** (${moderatorsList.size}/${MAX_MODERATORS})\n----------------------------------\n`;
            let index = 1;

            moderatorsList.forEach((mod, uid) => {
                listMsg += `${index}. 📛 Name: ${mod.name}\n` +
                           `   💳 Roblox: ${mod.robloxUser}\n` +
                           `   🧾 UID: ${uid}\n` +
                           `   ⏰ Joined: ${mod.approvedAt}\n\n`;
                index++;
            });

            return api.sendMessage(listMsg.trim(), threadID);
        }
    }

    // ==========================================
    // 3. USER COMMANDS (Prefix: ~)
    // ==========================================
    if (message.startsWith('~')) {

        // Command: ~mod tutorial
        if (message.toLowerCase() === '~mod tutorial') {
            const tutorialMsg = `📖 **MODERATOR APPLICATION TUTORIAL**\n` +
                                `----------------------------------\n` +
                                `To apply for Moderator, send this exact format:\n\n` +
                                `~mod apply\n` +
                                `Name:{Your Name}\n` +
                                `Id:Secret\n` +
                                `Roblox username:{Your Roblox Username}\n\n` +
                                `📌 **Example:**\n` +
                                `~mod apply\n` +
                                `Name:Alex\n` +
                                `Id:Secret\n` +
                                `Roblox username:AlexPlayz123\n\n` +
                                `----------------------------------\n` +
                                `⚠️ Reply with ✅ to confirm or ❎ to cancel when prompted.`;

            return api.sendMessage(tutorialMsg, threadID);
        }

        // Command: ~mod apply
        if (message.toLowerCase().startsWith('~mod apply')) {
            if (moderatorsList.size >= MAX_MODERATORS) {
                return api.sendMessage(`❌ Application closed! Maximum limit of ${MAX_MODERATORS} moderators reached.`, threadID);
            }

            if (moderatorsList.has(senderID)) {
                return api.sendMessage("⚠️ You are already an official Moderator!", threadID);
            }

            if (cooldowns.has(senderID)) {
                const expirationTime = cooldowns.get(senderID);
                if (Date.now() < expirationTime) {
                    const minutesLeft = Math.ceil((expirationTime - Date.now()) / 60000);
                    return api.sendMessage(`⏳ Please wait ${minutesLeft} minute(s) before applying again.`, threadID);
                } else {
                    cooldowns.delete(senderID);
                }
            }

            const lines = message.split('\n');
            let name = "Unknown";
            let robloxUser = "Unknown";

            lines.forEach(line => {
                const lowerLine = line.toLowerCase();
                if (lowerLine.startsWith('name:')) {
                    name = line.substring(5).trim();
                } else if (lowerLine.startsWith('roblox username:')) {
                    robloxUser = line.substring(16).trim();
                }
            });

            if (name === "Unknown" || robloxUser === "Unknown") {
                return api.sendMessage("❌ Invalid format! Type `~mod tutorial` for instructions.", threadID);
            }

            const timeAndDate = getCurrentDateTime();

            pendingApplications.set(senderID, {
                name: name,
                robloxUser: robloxUser,
                time: timeAndDate
            });

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

            return api.sendMessage(replyMsg, threadID);
        }
    }
}
