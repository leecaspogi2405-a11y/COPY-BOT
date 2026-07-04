const exemptedUIDs = [
    "61585471672439",  // Bot UID
    "61578056887855",  // Admin 1
    "100059484207000", // Admin 2
    "61589047318104",  // Admin 3
    "61591725114394",  // Admin 4
    "61583174657283"   // Admin 5
];

module.exports = {
    config: {
        name: "autowarn",
        version: "2.8",
        author: "Xdragon Bot",
        role: 1,
        description: {
            en: "Auto warn members who chat or spam. (3 warnings = kick)"
        },
        category: "admin",
        guide: {
            en: "{pn} on | off | show | reset all | reset @user"
        }
    },

    onStart: async function ({ message, api, event, args, threadsData, usersData }) {
        const { threadID } = event;
        const cmd = args[0]?.toLowerCase();

        // Get or Create thread data natively in GoatBot DB
        const threadData = global.db.allThreadData.find(t => t.threadID === threadID) || await threadsData.create(threadID);
        let autoWarnData = threadData.data?.autoWarn || { enabled: false, warnedUsers: {} };

        // Turn ON autowarn
        if (cmd === "on") {
            autoWarnData.enabled = true;
            await threadsData.set(threadID, autoWarnData, "data.autoWarn");
            return message.reply("✅ Autowarn is now ON for this group.\n\nChatting is currently prohibited! Anyone who messages will receive a warning.\n(Note: Allowed Admins are exempt).");
        }

        // Turn OFF autowarn
        if (cmd === "off") {
            autoWarnData.enabled = false;
            autoWarnData.warnedUsers = {}; // Reset all records
            await threadsData.set(threadID, autoWarnData, "data.autoWarn");
            return message.reply("❎ Autowarn is now OFF.\n\nEveryone can chat again. All previous warnings in this group have been reset.");
        }

        // SHOW current warnings
        if (cmd === "show") {
            const users = autoWarnData.warnedUsers || {};
            if (Object.keys(users).length === 0) {
                return message.reply("✅ No one has any warnings in this group currently.");
            }
            
            let msg = "⚠️ **CURRENT WARNINGS** ⚠️\n\n";
            for (const [uid, count] of Object.entries(users)) {
                let name = uid;
                try { name = await usersData.getName(uid); } catch (e) { }
                msg += `📛 ${name}\n🪪 UID: ${uid}\n⚠️ Warnings: ${count}/3\n\n`;
            }
            return message.reply(msg.trim());
        }

        // RESET warnings
        if (cmd === "reset") {
            const target = args[1]?.toLowerCase();
            const users = autoWarnData.warnedUsers || {};

            if (Object.keys(users).length === 0) {
                return message.reply("✅ There are no warnings to reset in this group.");
            }

            // Reset ALL users
            if (target === "all") {
                autoWarnData.warnedUsers = {};
                await threadsData.set(threadID, autoWarnData, "data.autoWarn");
                return message.reply("✅ All warnings in this group have been successfully reset.");
            }

            // Reset SPECIFIC users via mention
            const mentions = Object.keys(event.mentions || {});
            if (mentions.length > 0) {
                let resetNames = [];
                for (const uid of mentions) {
                    if (autoWarnData.warnedUsers[uid]) {
                        let name = uid;
                        try { name = await usersData.getName(uid); } catch (e) { }
                        resetNames.push(name);
                        delete autoWarnData.warnedUsers[uid];
                    }
                }
                
                if (resetNames.length > 0) {
                    await threadsData.set(threadID, autoWarnData, "data.autoWarn");
                    return message.reply(`✅ Successfully reset warnings for: ${resetNames.join(", ")}`);
                } else {
                    return message.reply("❎ The mentioned user(s) do not currently have any warnings.");
                }
            }

            return message.reply("❌ Invalid format!\n\nUse:\nautowarn reset all\nautowarn reset @mention");
        }

        // Default invalid command response
        return message.reply("❌ Invalid command!\n\nHow to use:\nautowarn on - Turn on lockdown\nautowarn off - Turn off lockdown\nautowarn show - List warned users\nautowarn reset all - Reset all warnings\nautowarn reset @mention - Reset warning for specific user");
    },

    onChat: async function ({ message, api, event, threadsData, usersData }) {
        if (!event.body) return;
        const { threadID, senderID } = event;

        // Check if thread data exists
        const threadData = global.db.allThreadData.find(t => t.threadID === threadID);
        if (!threadData) return;

        // Check if autowarn is ON
        const autoWarnData = threadData.data?.autoWarn;
        if (!autoWarnData || !autoWarnData.enabled) return;

        // EXEMPTION CHECK: Bot & Admins
        if (exemptedUIDs.includes(String(senderID))) return;

        // Get Name
        let name = "Member";
        try { name = await usersData.getName(senderID); } catch (e) { name = senderID; }

        // Setup warning DB for the user
        if (!autoWarnData.warnedUsers) autoWarnData.warnedUsers = {};
        if (!autoWarnData.warnedUsers[senderID]) autoWarnData.warnedUsers[senderID] = 0;

        // Add 1 to count
        autoWarnData.warnedUsers[senderID] += 1;
        const count = autoWarnData.warnedUsers[senderID];

        // Save immediately to Native DB
        await threadsData.set(threadID, autoWarnData, "data.autoWarn");

        // Format Date natively (No moment-timezone module needed to prevent errors)
        const time = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });

        // Warning Message Format
        const msg = `⚠️ Warnings: ${count}/3\n` +
                    `❎ Reason: Sending a message while Autowarn is ON!\n` +
                    `🪪 UID: ${senderID}\n` +
                    `📛 Name: ${name}\n` +
                    `⏰ Time: ${time}\n` +
                    `⚠️ Warned by: Xdragon Bot`;

        message.reply(msg);

        // KICK FUNCTION
        if (count >= 3) {
            api.removeUserFromGroup(senderID, threadID, async (err) => {
                if (!err) {
                    message.reply(`🚷 ${name} has been kicked from the group for reaching 3 warnings!`);
                    // Reset their count after kicking
                    delete autoWarnData.warnedUsers[senderID];
                    await threadsData.set(threadID, autoWarnData, "data.autoWarn");
                } else {
                    message.reply(`⚠️ ${name} reached 3 warnings but couldn't be kicked because the bot is not a Group Admin.`);
                }
            });
        }
    }
};
