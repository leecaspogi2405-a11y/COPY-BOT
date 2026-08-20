/**
 * Command: Moderator.js
 * Author: Dev Xdragon
 * Version: 3.2.0
 */

// Registered Moderator UIDs
const MODERATOR_UIDS = new Set([
	"61565656114305",
	"61589047318104",
	"61583174657283",
	"100059484207000"
]);

// In-memory state tracking
const mutedUsers = new Map();       // `${threadID}_${userID}` => { until, reason }
const suspendedUsers = new Map();   // `${threadID}_${userID}` => { until, originalName, reason }
const autoWarnSettings = new Map(); // threadID => boolean
const userWarnings = new Map();     // `${threadID}_${userID}` => count

// Words that trigger Auto-Warn when enabled
const BAD_WORDS = ["gago", "tanga", "bobo", "inutil", "ulol", "puke", "titi", "kantot", "fuck", "shit", "bitch"];

module.exports = {
	config: {
		name: "moderator",
		aliases: ["mod"],
		version: "3.2.0",
		author: "Dev Xdragon",
		role: 0,
		usePrefix: false,
		hasPrefix: false,
		description: "Complete moderation suite with real-time mute, suspend nickname handling, auto-warn enforcement, and kick commands.",
		category: "moderation",
		guide: "Prefix: *\nCommands: *kick, *mute, *unmute, *suspend, *unsuspend, *warn, *unwarn, *autowarn xdrg [on/off]"
	},

	onStart: async function ({ message }) {
		return message.reply("🛡️ Moderator system active! All moderation listeners, auto-warn filters, and nickname controls are running.");
	},

	onChat: async function ({ api, event, message, role }) {
		try {
			if (!event.body) return;
			const { threadID, senderID, mentions, messageReply, messageID } = event;
			const fullText = event.body.trim();
			const key = `${threadID}_${senderID}`;
			const isMod = role >= 3 || MODERATOR_UIDS.has(String(senderID));

			// =========================================================
			// 1. MUTE ENFORCEMENT
			// =========================================================
			if (mutedUsers.has(key)) {
				const muteData = mutedUsers.get(key);
				if (Date.now() < muteData.until) {
					if (typeof api.unsendMessage === "function") {
						api.unsendMessage(messageID);
					}
					return message.reply(`🔇 <@${senderID}> is currently muted and cannot chat. Reason: ${muteData.reason}`);
				} else {
					mutedUsers.delete(key);
				}
			}

			// =========================================================
			// 2. SUSPEND ENFORCEMENT & AUTOMATIC NICKNAME RESTORE
			// =========================================================
			if (suspendedUsers.has(key)) {
				const suspendData = suspendedUsers.get(key);
				if (Date.now() < suspendData.until) {
					if (typeof api.unsendMessage === "function") {
						api.unsendMessage(messageID);
					}
					return message.reply(`⛔ <@${senderID}> is suspended from chatting.`);
				} else {
					// Restore nickname upon suspension expiration
					try {
						await api.changeNickname(suspendData.originalName || "", threadID, senderID);
					} catch (e) {
						console.error("[Suspend Restore Error]:", e);
					}
					suspendedUsers.delete(key);
				}
			}

			// =========================================================
			// 3. AUTO-WARN REAL-TIME CHAT FILTER
			// =========================================================
			if (autoWarnSettings.get(threadID) === true && !isMod && !fullText.startsWith("*")) {
				const containsBadWord = BAD_WORDS.some(word => fullText.toLowerCase().includes(word));
				if (containsBadWord) {
					const currentWarns = (userWarnings.get(key) || 0) + 1;
					userWarnings.set(key, currentWarns);

					if (typeof api.unsendMessage === "function") {
						api.unsendMessage(messageID);
					}

					if (currentWarns >= 3) {
						userWarnings.delete(key);
						await message.reply(`⛔ **AUTO-WARN LIMIT REACHED (3/3)**\nKicking <@${senderID}> from group...`);
						try {
							await api.removeUserFromGroup(senderID, threadID);
						} catch (e) {
							message.reply("❌ Failed to kick user. Ensure bot has admin permissions.");
						}
						return;
					} else {
						return message.reply(`⚠️ **AUTO-WARN TRIGGERED** [${currentWarns}/3]\n👤 **User:** <@${senderID}>\n📄 **Reason:** Inappropriate content detected.`);
					}
				}
			}

			// =========================================================
			// 4. COMMAND EXECUTION (Requires '*' prefix)
			// =========================================================
			if (!fullText.startsWith("*")) return;

			if (!isMod) {
				return message.reply("❌ Access Denied: Moderation commands require Role 3 or Moderator UID status.");
			}

			const cleanText = fullText.slice(1).trim();
			const parts = cleanText.split(/\s+/);
			const inputCmd = parts[0] ? parts[0].toLowerCase() : "";

			if (!inputCmd) return;

			let subCommand = inputCmd;
			let actionArgs = parts.slice(1);

			if (inputCmd === "moderator" || inputCmd === "mod") {
				subCommand = (parts[1] || "").toLowerCase();
				actionArgs = parts.slice(2);
			}

			const validCmds = ["kick", "mute", "unmute", "suspend", "unsuspend", "autowarn", "warn", "unwarn", "add", "help"];
			if (!validCmds.includes(subCommand)) return;

			if (subCommand === "help") {
				return sendHelpMenu(message);
			}

			// Target user extraction (Mentions, reply, or manual UID)
			let targetID = null;
			let targetName = "User";

			if (mentions && Object.keys(mentions).length > 0) {
				targetID = Object.keys(mentions)[0];
				targetName = mentions[targetID].replace("@", "");
			} else if (messageReply) {
				targetID = messageReply.senderID;
				targetName = "Replied User";
			} else if (actionArgs[0] && !isNaN(actionArgs[0])) {
				targetID = actionArgs[0];
			}

			switch (subCommand) {

				// --- ADD MODERATOR ---
				case "add": {
					if (!targetID) return message.reply("❌ Usage: *moderator add @mention or reply to a message.");
					const targetUIDStr = String(targetID);
					if (MODERATOR_UIDS.has(targetUIDStr)) return message.reply(`ℹ️ ${targetName} is already a Moderator.`);
					MODERATOR_UIDS.add(targetUIDStr);
					return message.reply(`✅ **MODERATOR ADDED**\n👤 User: ${targetName}\n🆔 UID: ${targetUIDStr}`);
				}

				// --- KICK COMMAND ---
				case "kick": {
					if (!targetID) return message.reply("❌ Usage: *kick @mention [Reason]");
					if (targetID === senderID) return message.reply("❌ You cannot kick yourself.");
					const reason = actionArgs.filter(a => !a.startsWith("@") && a !== targetID).join(" ") || "No reason provided";

					try {
						await api.removeUserFromGroup(targetID, threadID);
						return message.reply(`🛡️ **KICKED**\n👤 User: ${targetName}\n🆔 ID: ${targetID}\n📄 Reason: ${reason}`);
					} catch (err) {
						return message.reply("❌ Failed to kick user. Ensure the bot is an admin in this group.");
					}
				}

				// --- MUTE COMMAND ---
				case "mute": {
					if (!targetID) return message.reply("❌ Usage: *mute @mention [Reason] [Duration e.g., 15m, 1h]");
					let durationMs = 15 * 60 * 1000;
					let durationStr = "15m";
					let rawReason = [];

					for (const arg of actionArgs) {
						if (arg.startsWith("@") || arg === targetID) continue;
						const parsed = parseDuration(arg);
						if (parsed) {
							durationMs = parsed.ms;
							durationStr = arg;
						} else {
							rawReason.push(arg);
						}
					}

					const reason = rawReason.join(" ") || "Violation of chat rules";
					const expireTime = Date.now() + durationMs;
					const targetKey = `${threadID}_${targetID}`;

					mutedUsers.set(targetKey, { until: expireTime, reason });
					return message.reply(`🔇 **MUTED**\n👤 User: ${targetName}\n⏳ Duration: ${durationStr}\n📄 Reason: ${reason}`);
				}

				// --- UNMUTE COMMAND ---
				case "unmute": {
					if (!targetID) return message.reply("❌ Usage: *unmute @mention");
					const targetKey = `${threadID}_${targetID}`;
					if (!mutedUsers.has(targetKey)) return message.reply("ℹ️ User is not currently muted.");
					mutedUsers.delete(targetKey);
					return message.reply(`🔊 **UNMUTED**: ${targetName} has been unmuted.`);
				}

				// --- SUSPEND COMMAND (Changes Nickname & Blocks Chat) ---
				case "suspend": {
					if (!targetID) return message.reply("❌ Usage: *suspend @mention [Reason] [Hours e.g., 1h]");
					let hours = 1;
					let rawReason = [];

					for (const arg of actionArgs) {
						if (arg.startsWith("@") || arg === targetID) continue;
						if (!isNaN(arg) && Number(arg) > 0) {
							hours = parseFloat(arg);
						} else {
							rawReason.push(arg);
						}
					}

					const reason = rawReason.join(" ") || "Temporary suspension";
					const durationMs = hours * 60 * 60 * 1000;
					const expireTime = Date.now() + durationMs;
					const targetKey = `${threadID}_${targetID}`;

					// Update nickname to Suspended
					try {
						await api.changeNickname(`Suspended | ${targetName}`, threadID, targetID);
					} catch (e) {
						console.error("[Suspend Nickname Error]:", e);
					}

					suspendedUsers.set(targetKey, { until: expireTime, originalName: targetName, reason });
					return message.reply(`⛔ **SUSPENDED**\n👤 User: ${targetName}\n🏷️ New Nickname: Suspended | ${targetName}\n⏱️ Duration: ${hours} Hour(s)\n📄 Reason: ${reason}`);
				}

				// --- UNSUSPEND COMMAND (Restores Nickname) ---
				case "unsuspend": {
					if (!targetID) return message.reply("❌ Usage: *unsuspend @mention");
					const targetKey = `${threadID}_${targetID}`;
					if (!suspendedUsers.has(targetKey)) return message.reply("ℹ️ User is not currently suspended.");

					const suspendData = suspendedUsers.get(targetKey);
					try {
						await api.changeNickname(suspendData.originalName || "", threadID, targetID);
					} catch (e) {
						console.error("[Unsuspend Nickname Error]:", e);
					}

					suspendedUsers.delete(targetKey);
					return message.reply(`🔓 **UNSUSPENDED**: Restored original nickname for ${targetName}.`);
				}

				// --- AUTOWARN COMMAND ---
				case "autowarn": {
					let toggle = actionArgs[0] ? actionArgs[0].toLowerCase() : "";
					if (toggle === "xdrg" && actionArgs[1]) {
						toggle = actionArgs[1].toLowerCase();
					}

					if (toggle !== "on" && toggle !== "off") return message.reply("❌ Usage: *autowarn on/off OR *autowarn xdrg on/off");
					const state = toggle === "on";
					autoWarnSettings.set(threadID, state);
					return message.reply(`⚠️ **AUTO-WARN SYSTEM**: ${state ? "ENABLED ✅ (Active bad word filtering)" : "DISABLED ❌"}`);
				}

				// --- WARN COMMAND ---
				case "warn": {
					if (!targetID) return message.reply("❌ Usage: *warn @mention [Reason]");
					const reason = actionArgs.filter(a => !a.startsWith("@") && a !== targetID).join(" ") || "Rule violation";
					const targetKey = `${threadID}_${targetID}`;
					const currentWarns = (userWarnings.get(targetKey) || 0) + 1;
					userWarnings.set(targetKey, currentWarns);

					let warnMsg = `⚠️ **WARNING ISSUED** [${currentWarns}/3]\n👤 User: ${targetName}\n📄 Reason: ${reason}`;
					if (currentWarns >= 3) {
						warnMsg += `\n\n⛔ **Limit Reached!** Automatically kicking user...`;
						userWarnings.delete(targetKey);
						try {
							await api.removeUserFromGroup(targetID, threadID);
						} catch (e) {
							warnMsg += ` (Failed to kick: Bot needs admin rights)`;
						}
					}
					return message.reply(warnMsg);
				}

				// --- UNWARN COMMAND ---
				case "unwarn": {
					if (!targetID) return message.reply("❌ Usage: *unwarn @mention");
					const targetKey = `${threadID}_${targetID}`;
					userWarnings.delete(targetKey);
					return message.reply(`✅ **WARNINGS CLEARED**: Reset warnings for ${targetName}.`);
				}
			}

		} catch (error) {
			console.error("[Moderator.js Error]:", error);
		}
	}
};

function sendHelpMenu(message) {
	const helpText = 
		`🛡️ **MODERATOR COMMAND MENU** 🛡️\n` +
		`━━━━━━━━━━━━━━━━━━━\n\n` +
		`📌 **Prefix:** Strictly *\n` +
		`🔐 **Role 3 / Moderator Restricted**\n\n` +
		`🔻 **AVAILABLE COMMANDS:**\n\n` +
		`• ***moderator add {@mention}**\n` +
		`• ***autowarn [on/off]** or ***autowarn xdrg [on/off]**\n` +
		`• ***kick {@mention} [Reason]**\n` +
		`• ***mute {@mention} [Reason] [Duration]**\n` +
		`• ***unmute {@mention}**\n` +
		`• ***suspend {@mention} [Reason] [Hours]**\n` +
		`• ***unsuspend {@mention}**\n` +
		`• ***warn {@mention} [Reason]**\n` +
		`• ***unwarn {@mention}**\n` +
		`━━━━━━━━━━━━━━━━━━━\n` +
		`Copyright ©️ Dev Xdragon`;

	return message.reply(helpText);
}

function parseDuration(str) {
	if (!str) return null;
	const match = str.match(/^(\d+)(s|m|h|d|mo|y)$/i);
	if (!match) return null;

	const val = parseInt(match[1]);
	const unit = match[2].toLowerCase();

	let ms = 0;
	switch (unit) {
		case 's': ms = val * 1000; break;
		case 'm': ms = val * 60 * 1000; break;
		case 'h': ms = val * 60 * 60 * 1000; break;
		case 'd': ms = val * 24 * 60 * 60 * 1000; break;
		case 'mo': ms = val * 30 * 24 * 60 * 60 * 1000; break;
		case 'y': ms = val * 365 * 24 * 60 * 60 * 1000; break;
	}

	return { ms, unit, val };
}
