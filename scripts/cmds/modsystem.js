const pendingApplications = new Map();
const cooldowns = new Map();
const currentMods = new Map(); // Stores actual moderator data for the list
let maxMods = 2; // Default maximum moderators

// Helper function to get the current date and time
function getCurrentDateTime() {
    return new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
}

// ==========================================
// MAIN MESSAGE HANDLER
// ==========================================
// If your bot passes `isAdmin` (boolean), it hooks right in here.
function handleMessage(api, event, isAdmin = false) {
    if (!event.body) return; // Ignore if there's no text
    
    const message = event.body.trim();
    const senderID = event.senderID;
    const threadID = event.threadID;

    // ------------------------------------------
    // 1. HANDLE REPLIES (✅ or ❎)
    // ------------------------------------------
    if (pendingApplications.has(senderID)) {
        const app = pendingApplications.get(senderID);

        if (message === '✅') {
            if (currentMods.size >= maxMods) {
                api.sendMessage(`❌ Sorry, the maximum number of moderators (${maxMods}) has already been reached.`, threadID);
                pendingApplications.delete(senderID);
                return;
            }

            // Save them to the official moderator list
            currentMods.set(senderID, {
                name: app.name,
                robloxUser: app.robloxUser,
                time: app.timeAndDate
            });

            const currentCount = currentMods.size;
            const confirmMsg = `Account update [Confirmed] Congratulations you are now officially an moderator ${currentCount}/${maxMods}\n` +
                               `📛Name: ${app.name}\n` +
                               `🪪Id: Secret\n` +
                               `🧾Uid: ${senderID}\n` +
                               `🗝️Role: Moderator\n` +
                               `💳Rbxl user: ${app.robloxUser}\n` +
                               `⏰Time & date: ${app.timeAndDate}\n` +
                               `----------------------------------\n` +
                               `Made by: Xdrg Moderator Service\n` +
                               `Sending to: Dev Xdragon`;

            api.sendMessage(confirmMsg, threadID);

            // Change nickname
            const newNickname = `[Moderator🔨] ${app.name}`;
            api.changeNickname(newNickname, threadID, senderID, (err) => {
                if (err) console.error("Could not change nickname", err);
            });

            pendingApplications.delete(senderID);
            return;

        } else if (message === '❎') {
            // 5-minute cooldown (300,000 ms)
            cooldowns.set(senderID, Date.now() + 300000);

            const rejectMsg = `${app.name} try again in 5 minutes to cooldown the system/xdrg service system try type again👇\n` +
                              `------------------------------\n` +
                              `~mod apply\n` +
                              `Name:${app.name}\n` +
                              `Id:Secret<-bot reply this sa nag apply\n` +
                              `Roblox username:${app.robloxUser}`;

            api.sendMessage(rejectMsg, threadID);
            pendingApplications.delete(senderID);
            return;
        }
    }

    // ------------------------------------------
    // 2. ADMIN COMMANDS (Prefix: !)
    // ------------------------------------------
    if (message.startsWith('!add mod ')) {
        if (!isAdmin) return api.sendMessage("❌ You don't have permission to use this admin command.", threadID);
        
        const numStr = message.replace('!add mod ', '').trim();
        const newMax = parseInt(numStr, 10);
        
        if (isNaN(newMax) || newMax < 1) {
            return api.sendMessage("⚠️ Please provide a valid number. Example: !add mod 5", threadID);
        }
        
        maxMods = newMax;
        return api.sendMessage(`✅ The moderator limit has been updated to ${maxMods} successfully.`, threadID);
    }

    if (message === '!mod list') {
        if (!isAdmin) return api.sendMessage("❌ You don't have permission to use this admin command.", threadID);
        
        if (currentMods.size === 0) {
            return api.sendMessage("📋 There are currently no moderators.", threadID);
        }

        let listMsg = `📋 CURRENT MODERATORS (${currentMods.size}/${maxMods})\n\n`;
        let index = 1;
        
        // Loop through saved moderators
        for (const [uid, modData] of currentMods.entries()) {
            listMsg += `${index}. ${modData.name}\n` +
                       `   💳 Rbxl: ${modData.robloxUser}\n` +
                       `   🧾 Uid: ${uid}\n` +
                       `   ⏰ Promoted: ${modData.time}\n\n`;
            index++;
        }
        
        return api.sendMessage(listMsg.trim(), threadID);
    }

    // ------------------------------------------
    // 3. USER COMMANDS (Prefix: ~)
    // ------------------------------------------
    if (message === '~mod tutorial') {
        const tutorialMsg = `📖 MODERATOR APPLICATION TUTORIAL 📖\n\n` +
                            `To apply for the moderator role, send a message using the exact format below:\n\n` +
                            `~mod apply\n` +
                            `Name: {Your Name}\n` +
                            `Roblox username: {Your Roblox User}\n\n` +
                            `Example:\n` +
                            `~mod apply\n` +
                            `Name: John Doe\n` +
                            `Roblox username: JohnGamer123\n\n` +
                            `Notes:\n` +
                            `* Do not include the { } brackets.\n` +
                            `* You must reply with ✅ to confirm or ❎ to cancel after the bot responds.\n` +
                            `* Canceling gives you a 5-minute cooldown.`;
        return api.sendMessage(tutorialMsg, threadID);
    }

    if (message.startsWith('~mod apply')) {
        if (currentMods.size >= maxMods) {
            return api.sendMessage(`❌ The application is closed. We already reached the maximum limit of ${maxMods} moderators.`, threadID);
        }

        if (cooldowns.has(senderID)) {
            const expirationTime = cooldowns.get(senderID);
            if (Date.now() < expirationTime) {
                const timeLeft = Math.ceil((expirationTime - Date.now()) / 60000); // Convert to minutes
                return api.sendMessage(`⏳ Please wait ${timeLeft} minute(s) before applying again.`, threadID);
            } else {
                cooldowns.delete(senderID);
            }
        }

        // Extract Name and Roblox Username safely
        const lines = message.split('\n');
        let name = "Unknown";
        let robloxUser = "Unknown";

        lines.forEach(line => {
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('name:')) {
                name = line.substring(line.toLowerCase().indexOf('name:') + 5).trim();
            } else if (lowerLine.includes('roblox username:')) {
                robloxUser = line.substring(line.toLowerCase().indexOf('roblox username:') + 16).trim();
            }
        });

        if (name === "Unknown" && robloxUser === "Unknown") {
            return api.sendMessage("⚠️ Invalid format! Type `~mod tutorial` to see the correct format.", threadID);
        }

        const timeAndDate = getCurrentDateTime();

        // Save their application state
        pendingApplications.set(senderID, {
            name: name,
            robloxUser: robloxUser,
            timeAndDate: timeAndDate
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

        api.sendMessage(replyMsg, threadID);
    }
}
