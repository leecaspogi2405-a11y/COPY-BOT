module.exports = {
    config: {
        name: "autowarn",
        version: "1.0",
        author: "Developer",
        countDown: 5,
        role: 0,
        description: {
            en: "Auto warn members when they chat in group (5 warnings = kick)"
        },
        category: "box chat",
        guide: {
            en: "   {pn} on: enable auto warn\n"
                + "   {pn} off: disable auto warn\n"
                + "   {pn} status: check current status\n"
                + "   {pn} reset: reset all auto warn data for this thread\n"
                + "\n⚠ When enabled, users will receive 1 warning for each message they send.\n"
                + "After 5 warnings, they will be automatically kicked from the group."
        }
    },

    langs: {
        en: {
            enabled: "✅ Auto warn has been enabled for this group.\n\n"
                + "Users will receive 1 warning for each message they send.\n"
                + "After 5 warnings, they will be automatically kicked from the group.",
            disabled: "✅ Auto warn has been disabled for this group.",
            alreadyEnabled: "⚠ Auto warn is already enabled for this group.",
            alreadyDisabled: "⚠ Auto warn is already disabled for this group.",
            statusEnabled: "🔔 Auto warn is currently ENABLED in this group.",
            statusDisabled: "🔕 Auto warn is currently DISABLED in this group.",
            resetSuccess: "✅ Auto warn data has been reset for this group.",
            noPermission: "⚠ Only group administrators can use this command.",
            warnAdded: "⚠ %1 has been warned (%2/5)\nReason: Auto warn - posting in group\nIf you reach 5 warnings, you will be kicked from the group.",
            kicked: "⚠ %1 has been kicked from the group (5/5 warnings)\nReason: Auto warn - excessive messaging in group",
            adminExempt: "⚠ Auto warn is enabled but you are an admin, so you won't be warned.",
            notInGroup: "⚠ User %1 is not in this group"
        }
    },

    onStart: async function ({ message, api, event, args, threadsData, role, getLang }) {
        const { threadID, senderID } = event;

        // Only admins can use this command
        if (role < 1)
            return message.reply(getLang("noPermission"));

        // Get thread data
        const threadData = global.db.allThreadData.find(t => t.threadID === threadID) || await threadsData.create(threadID);
        const autoWarnData = threadData.data?.autoWarn || {
            enabled: false,
            warnedUsers: []
        };

        const action = args[0]?.toLowerCase();

        switch (action) {
            case "on": {
                if (autoWarnData.enabled) {
                    return message.reply(getLang("alreadyEnabled"));
                }
                autoWarnData.enabled = true;
                if (!threadData.data) threadData.data = {};
                threadData.data.autoWarn = autoWarnData;
                await threadsData.set(threadID, autoWarnData, "data.autoWarn");
                return message.reply(getLang("enabled"));
            }

            case "off": {
                if (!autoWarnData.enabled) {
                    return message.reply(getLang("alreadyDisabled"));
                }
                autoWarnData.enabled = false;
                await threadsData.set(threadID, autoWarnData, "data.autoWarn");
                return message.reply(getLang("disabled"));
            }

            case "status": {
                const status = autoWarnData.enabled ? getLang("statusEnabled") : getLang("statusDisabled");
                return message.reply(status);
            }

            case "reset": {
                autoWarnData.warnedUsers = [];
                await threadsData.set(threadID, autoWarnData, "data.autoWarn");
                return message.reply(getLang("resetSuccess"));
            }

            default:
                return message.SyntaxError();
        }
    },

    onChat: async function ({ message, api, event, threadsData, usersData, getLang, globalDb }) {
        // Only process text messages
        if (!event.body)
            return;

        const { threadID, senderID } = event;

        // Don't warn the bot itself
        if (senderID === api.getCurrentUserID())
            return;

        // Get thread data
        const threadData = global.db.allThreadData.find(t => t.threadID === threadID);
        if (!threadData)
            return;

        const autoWarnData = threadData.data?.autoWarn;
        if (!autoWarnData || !autoWarnData.enabled)
            return;

        // Check if sender is admin (check thread adminIDs, bot admins, dev users, premium users)
        const config = global.GoatBot.config;
        const threadAdminIDs = threadData.adminIDs || [];
        const adminBot = config.adminBot || [];
        const devUsers = config.devUsers || [];
        const premiumUsers = config.premiumUsers || [];

        // Get user role level (same logic as handlerEvents.js)
        let userRole = 0;
        if (devUsers.includes(senderID)) userRole = 4;
        else if (premiumUsers.includes(senderID)) userRole = 3;
        else if (adminBot.includes(senderID)) userRole = 2;
        else if (threadAdminIDs.includes(senderID)) userRole = 1;

        // Skip if user is admin or above (role >= 1)
        if (userRole >= 1)
            return;

        // Get or create warn data for user
        let warnedUsers = autoWarnData.warnedUsers || [];
        let userWarnData = warnedUsers.find(u => u.uid == senderID);

        if (!userWarnData) {
            userWarnData = {
                uid: senderID,
                list: [],
                warnedAt: Date.now()
            };
            warnedUsers.push(userWarnData);
        }

        // Add warning
        const dateTime = new Date().toLocaleString("en-US", { timeZone: config.timeZone || "Asia/Manila" });
        userWarnData.list.push({
            reason: "Auto warn - posting in group",
            dateTime: dateTime,
            warnBy: "Auto System"
        });

        const warningCount = userWarnData.list.length;

        // Get user name
        let userName;
        try {
            userName = await usersData.getName(senderID);
        } catch (e) {
            userName = senderID;
        }

        if (warningCount >= 5) {
            // Kick user
            api.removeUserFromGroup(senderID, threadID, async (err) => {
                if (!err) {
                    // Remove from warned list after kick
                    warnedUsers = warnedUsers.filter(u => u.uid != senderID);
                    autoWarnData.warnedUsers = warnedUsers;
                    await threadsData.set(threadID, autoWarnData, "data.autoWarn");

                    message.reply(getLang("kicked", userName));
                } else {
                    // Try to get user info to check if they're in group
                    message.reply(getLang("notInGroup", userName));
                }
            });
        } else {
            // Just warn and save
            autoWarnData.warnedUsers = warnedUsers;
            await threadsData.set(threadID, autoWarnData, "data.autoWarn");
            message.reply(getLang("warnAdded", userName, warningCount));
        }
    }
};
