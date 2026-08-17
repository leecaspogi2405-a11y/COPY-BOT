if (!global.modSystem) {
    global.modSystem = {
        maxMods: 2,
        moderators: new Map(),
        pending: new Map(),
        cooldowns: new Map()
    };
}

function getCurrentDateTime() {
    return new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
}

function isBotAdmin(senderID) {
    if (global.config && Array.isArray(global.config.ADMINBOT)) {
        return global.config.ADMINBOT.includes(senderID);
    }
    return false;
}

module.exports = {
    config: {
        name: "modsystem",
        aliases: ["mod", "add"],
        version: "3.0.0",
        author: "Dev Xdragon",
        role: 0,
        description: "Moderator application and admin system",
        category: "system",
        guide: "{pn} apply\n!add mod {number}\n!mod list"
    },

    onStart: async function ({ api, event, args, message }) {
        return this.onChat({ api, event, message });
    },

    onChat: async function ({ api, event, message }) {
        if (!event.body) return;
        const body = event.body.trim();
        const senderID = event.senderID;
        const threadID = event.threadID;
        const state = global.modSystem;

        // ==========================================
        // 1. REPLIES (✅ or ❎)
        // ==========================================
        if (state.pending.has(senderID)) {
            const app = state.pending.get(senderID);

            if (body === '✅') {
                if (state.moderators.size >= state.maxMods) {
                    message.reply(`❌ Sorry, maximum number of moderators (${state.maxMods}) reached already.`);
                    state.pending.delete(senderID);
                    return;
                }

                state.moderators.set(senderID, {
                    name: app.name,
                    robloxUser: app.robloxUser,
                    approvedAt: app.time
                });

                const confirmMsg = `Account update [Confirmed] Congratulations you are now officially an moderator ${state.moderators.size}/${state.maxMods}\n` +
                                   `📛Name: ${app.name}\n` +
                                   `🪪Id: Secret\n` +
                                   `🧾Uid: ${senderID}\n` +
                                   `🗝️Role: Moderator\n` +
                                   `💳Rbxl user: ${app.robloxUser}\n` +
                                   `⏰Time & date: ${app.time}\n` +
                                   `----------------------------------\n` +
                                   `Made by: Xdrg Moderator Service\n` +
                                   `Sending to: Dev Xdragon`;

                message.reply(confirmMsg);

                api.changeNickname(`[Moderator🔨] ${app.name}`, threadID, senderID, (err) => {
                    if (err) console.error("Could not change nickname:", err);
                });

                state.pending.delete(senderID);
                return;
            }

            if (body === '❎') {
                state.cooldowns.set(senderID, Date.now() + 300000);

                const rejectMsg = `${app.name} try again in 5 minutes to cooldown the system/xdrg service system try type again👇\n` +
                                  `------------------------------\n` +
                                  `~mod apply\n` +
                                  `Name:${app.name}\n` +
                                  `Id:Secret\n` +
                                  `Roblox username:${app.robloxUser}`;

                message.reply(rejectMsg);
                state.pending.delete(senderID);
                return;
            }
        }

        const lowerBody = body.toLowerCase();

        // ==========================================
        // 2. ADMIN COMMANDS (! Prefix or Direct)
        // ==========================================
        if (lowerBody.startsWith('!add mod') || lowerBody.startsWith('add mod')) {
            if (!isBotAdmin(senderID)) {
                return message.reply("❌ Only Bot Admins can use this command.");
            }

            const parts = body.split(/\s+/);
            const newLimit = parseInt(parts[2] || parts[3]);

            if (isNaN(newLimit) || newLimit < 1) {
                return message.reply("❌ Usage: !add mod {number} (e.g., !add mod 5)");
            }

            state.maxMods = newLimit;
            return message.reply(`✅ **System Update:** Required moderator limit adjusted to **${state.maxMods}**.`);
        }

        if (lowerBody === '!mod list' || lowerBody === 'mod list' || lowerBody === '!modsystem list') {
            if (!isBotAdmin(senderID)) {
                return message.reply("❌ Only Bot Admins can view the moderator list.");
            }

            if (state.moderators.size === 0) {
                return message.reply(`🛡️ **Moderator List** (0/${state.maxMods}):\nNo active moderators registered yet.`);
            }

            let listMsg = `🛡️ **ACTIVE MODERATORS** (${state.moderators.size}/${state.maxMods})\n----------------------------------\n`;
            let index = 1;

            state.moderators.forEach((mod, uid) => {
                listMsg += `${index}. 📛 Name: ${mod.name}\n` +
                           `   💳 Roblox: ${mod.robloxUser}\n` +
                           `   🧾 UID: ${uid}\n` +
                           `   ⏰ Joined: ${mod.approvedAt}\n\n`;
                index++;
            });

            return message.reply(listMsg.trim());
        }

        // ==========================================
        // 3. USER COMMANDS (~ or ! Prefix)
        // ==========================================
        if (lowerBody === '~mod tutorial' || lowerBody === '!mod tutorial') {
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

            return message.reply(tutorialMsg);
        }

        if (lowerBody.startsWith('~mod apply') || lowerBody.startsWith('!mod apply')) {
            if (state.moderators.size >= state.maxMods) {
                return message.reply(`❌ Application closed! Maximum limit of ${state.maxMods} moderators reached.`);
            }

            if (state.moderators.has(senderID)) {
                return message.reply("⚠️ You are already an official Moderator!");
            }

            if (state.cooldowns.has(senderID)) {
                const expirationTime = state.cooldowns.get(senderID);
                if (Date.now() < expirationTime) {
                    const minutesLeft = Math.ceil((expirationTime - Date.now()) / 60000);
                    return message.reply(`⏳ Please wait ${minutesLeft} minute(s) before applying again.`);
                } else {
                    state.cooldowns.delete(senderID);
                }
            }

            const lines = body.split('\n');
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
                return message.reply("❌ Invalid format! Type `~mod tutorial` for instructions.");
            }

            const timeAndDate = getCurrentDateTime();

            state.pending.set(senderID, {
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

            return message.reply(replyMsg);
        }
    }
};
