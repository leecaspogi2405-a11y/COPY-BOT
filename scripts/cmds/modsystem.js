const { config } = global.GoatBot;

if (!global.modSystemData) {
	global.modSystemData = {
		maxMods: 2,
		moderators: new Map(),
		cooldowns: new Map()
	};
}

function getCurrentDateTime() {
	return new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
}

module.exports = {
	config: {
		name: "modsystem",
		aliases: ["mod"],
		version: "4.0.0",
		author: "Dev Xdragon",
		role: 0,
		description: {
			en: "Moderator application system integrated with GoatBot admin system"
		},
		category: "system",
		guide: {
			en: "   {pn} apply\nName:{name}\nRoblox username:{user}\n   {pn} tutorial: Show tutorial\n   {pn} add <number>: Set moderator limit (Admin only)\n   {pn} list: List active moderators (Admin only)"
		}
	},

	onStart: async function ({ args, message, event, role }) {
		const senderID = event.senderID;
		const threadID = event.threadID;
		const state = global.modSystemData;
		const subCommand = (args[0] || "").toLowerCase();

		// Check GoatBot Admin (role == 2 or listed in config.adminBot)
		const isAdmin = role >= 2 || (config.adminBot && config.adminBot.includes(senderID));

		// ==========================================
		// 1. ADMIN COMMAND: !mod add <number>
		// ==========================================
		if (subCommand === "add" || subCommand === "limit" || subCommand === "setlimit") {
			if (!isAdmin) {
				return message.reply("❌ Only Bot Admins can change the moderator limit.");
			}
			const newLimit = parseInt(args[1]);
			if (isNaN(newLimit) || newLimit < 1) {
				return message.reply("❌ Usage: !mod add <number> (Example: !mod add 5)");
			}
			state.maxMods = newLimit;
			return message.reply(`✅ **System Update:** Moderator limit successfully changed to **${state.maxMods}**.`);
		}

		// ==========================================
		// 2. ADMIN COMMAND: !mod list
		// ==========================================
		if (subCommand === "list") {
			if (!isAdmin) {
				return message.reply("❌ Only Bot Admins can view the moderator list.");
			}
			if (state.moderators.size === 0) {
				return message.reply(`🛡️ **Moderator List** (0/${state.maxMods}):\nNo active moderators registered yet.`);
			}
			let listMsg = `🛡️ **ACTIVE MODERATORS** (${state.moderators.size}/${state.maxMods})\n----------------------------------\n`;
			let index = 1;
			for (const [uid, mod] of state.moderators.entries()) {
				listMsg += `${index}. 📛 Name: ${mod.name}\n` +
					`   💳 Roblox: ${mod.robloxUser}\n` +
					`   🧾 UID: ${uid}\n` +
					`   ⏰ Joined: ${mod.approvedAt}\n\n`;
				index++;
			}
			return message.reply(listMsg.trim());
		}

		// ==========================================
		// 3. USER COMMAND: !mod tutorial
		// ==========================================
		if (subCommand === "tutorial") {
			const tutorialMsg = `📖 **MODERATOR APPLICATION TUTORIAL**\n` +
				`----------------------------------\n` +
				`To apply for Moderator, send this exact command format:\n\n` +
				`!mod apply\n` +
				`Name:{Your Name}\n` +
				`Id:Secret\n` +
				`Roblox username:{Your Roblox Username}\n\n` +
				`📌 **Example:**\n` +
				`!mod apply\n` +
				`Name:Alex\n` +
				`Id:Secret\n` +
				`Roblox username:AlexPlayz123\n\n` +
				`----------------------------------\n` +
				`⚠️ Reply to the bot's preview message with ✅ to confirm or ❎ to cancel.`;
			return message.reply(tutorialMsg);
		}

		// ==========================================
		// 4. USER COMMAND: !mod apply
		// ==========================================
		if (subCommand === "apply") {
			if (state.moderators.size >= state.maxMods) {
				return message.reply(`❌ Application closed! Maximum limit of ${state.maxMods} moderators has been reached.`);
			}

			if (state.moderators.has(senderID)) {
				return message.reply("⚠️ You are already registered as a Moderator!");
			}

			if (state.cooldowns.has(senderID)) {
				const expirationTime = state.cooldowns.get(senderID);
				if (Date.now() < expirationTime) {
					const minutesLeft = Math.ceil((expirationTime - Date.now()) / 60000);
					return message.reply(`⏳ Cooldown Active: Please wait ${minutesLeft} minute(s) before applying again.`);
				} else {
					state.cooldowns.delete(senderID);
				}
			}

			const fullText = event.body || "";
			const lines = fullText.split('\n');
			let name = "Unknown";
			let robloxUser = "Unknown";

			lines.forEach(line => {
				const lower = line.toLowerCase().trim();
				if (lower.startsWith('name:')) {
					name = line.substring(line.indexOf(':') + 1).trim();
				} else if (lower.startsWith('roblox username:')) {
					robloxUser = line.substring(line.indexOf(':') + 1).trim();
				}
			});

			if (name === "Unknown" || robloxUser === "Unknown") {
				return message.reply("❌ Invalid application format!\n\nUse:\n!mod apply\nName:{name}\nId:Secret\nRoblox username:{Roblox username}\n\n(Type `!mod tutorial` for details)");
			}

			const timeAndDate = getCurrentDateTime();

			const confirmMsg = `Confirmision🧾\n` +
				`📛Name: ${name}\n` +
				`🪪Id: Secret\n` +
				`🧾Uid: ${senderID}\n` +
				`🗝️Role: Moderator\n` +
				`💳Rbxl user: ${robloxUser}\n` +
				`⏰Time & date: ${timeAndDate}\n` +
				`----------------------------------\n` +
				`Made by: Xdrg Moderator Service\n` +
				`Sending to: Dev Xdragon\n\n` +
				`👉 Reply to this message with ✅ to confirm or ❎ to cancel.`;

			return message.reply(confirmMsg, (err, info) => {
				if (err) return;
				// Register for GoatBot native reply listener
				global.GoatBot.onReply.set(info.messageID, {
					commandName: "modsystem",
					author: senderID,
					name: name,
					robloxUser: robloxUser,
					time: timeAndDate
				});
			});
		}

		return message.reply("❌ Command Syntax:\n• !mod apply\n• !mod tutorial\n• !mod add <number> (Admin)\n• !mod list (Admin)");
	},

	// ==========================================
	// GoatBot Native Reply Handler (✅ / ❎)
	// ==========================================
	onReply: async function ({ api, event, Reply, message }) {
		const { author, name, robloxUser, time } = Reply;
		const senderID = event.senderID;
		const threadID = event.threadID;
		const state = global.modSystemData;

		if (senderID !== author) {
			return message.reply("❌ Only the original applicant can confirm or cancel this application.");
		}

		const body = (event.body || "").trim();

		if (body === "✅") {
			if (state.moderators.size >= state.maxMods) {
				message.reply(`❌ Sorry, maximum number of moderators (${state.maxMods}) has been reached.`);
				global.GoatBot.onReply.delete(event.messageReply.messageID);
				return;
			}

			state.moderators.set(senderID, {
				name: name,
				robloxUser: robloxUser,
				approvedAt: time
			});

			const confirmMsg = `Account update [Confirmed] Congratulations you are now officially an moderator ${state.moderators.size}/${state.maxMods}\n` +
				`📛Name: ${name}\n` +
				`🪪Id: Secret\n` +
				`🧾Uid: ${senderID}\n` +
				`🗝️Role: Moderator\n` +
				`💳Rbxl user: ${robloxUser}\n` +
				`⏰Time & date: ${time}\n` +
				`----------------------------------\n` +
				`Made by: Xdrg Moderator Service\n` +
				`Sending to: Dev Xdragon`;

			message.reply(confirmMsg);

			api.changeNickname(`[Moderator🔨] ${name}`, threadID, senderID, (err) => {
				if (err) console.error("Could not change nickname:", err);
			});

			global.GoatBot.onReply.delete(event.messageReply.messageID);
			return;
		}

		if (body === "❎") {
			state.cooldowns.set(senderID, Date.now() + 300000);

			const rejectMsg = `${name} try again in 5 minutes to cooldown the system/xdrg service system try type again👇\n` +
				`------------------------------\n` +
				`!mod apply\n` +
				`Name:${name}\n` +
				`Id:Secret\n` +
				`Roblox username:${robloxUser}`;

			message.reply(rejectMsg);
			global.GoatBot.onReply.delete(event.messageReply.messageID);
			return;
		}
	}
};
