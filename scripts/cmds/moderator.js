/**
 * Command: Moderator.js
 * Author: Dev Xdragon
 * Custom UID Permission Enforcement
 */

// Registered Moderator UIDs
const MODERATOR_UIDS = new Set([
	"61565656114305",
	"61589047318104",
	"61583174657283",
	"100059484207000"
]);

// In-memory databases
const mutedUsers = new Map();
const suspendedUsers = new Map();
const autoWarnSettings = new Map();
const rankupSettings = new Map();
const userWarnings = new Map();

module.exports = {
	config: {
		name: "moderator",
		aliases: ["mod", "kick", "mute", "unmute", "suspend", "rankup", "autowarn", "warn", "unwarn", "purge"],
		version: "2.1.0",
		author: "Dev Xdragon",
		role: 0, // Handled via internal UID check
		description: "Moderation suite restricted to authorized Moderator UIDs.",
		category: "moderation",
		guide: "*moderator add @mention\n*kick @mention [reason]\n*mute @mention [reason] [duration]\n*unmute @mention\n*suspend @mention [reason] [hours]\n*rankup xdrg on/off\n*autowarn on/off\n*warn @mention [reason]\n*help moderator"
	},

	onStart: async ({ api, event, args, message }) => {
		try {
			const { threadID, senderID, mentions, messageReply } = event;

			// Enforce strict Moderator UID authorization check
			if (!MODERATOR_UIDS.has(String(senderID))) {
				return message.reply("❌ Access Denied: Your UID is not registered in the Moderator list.");
			}

			const fullText = event.body ? event.body.trim() : "";
			const inputCmd = fullText.split(/\s+/)[0].toLowerCase().replace(/^\*/, '');
			
			let subCommand = (inputCmd === "moderator" || inputCmd === "mod") ? (args[0] || "").toLowerCase() : inputCmd;
			let actionArgs = (inputCmd === "moderator" || inputCmd === "mod") ? args.slice(1) : args;

			if (subCommand === "help" || (args[0] && args[0].toLowerCase() === "moderator" && subCommand === "help")) {
				return sendHelpMenu(message);
			}

			// Target user extraction logic
			let targetID = null;
			let targetName = "User";

			if (mentions && Object.keys(mentions).length > 0) {
				targetID = Object.keys(mentions)[0];
				targetName = mentions[targetID].replace("@", "");
			} else if (messageReply) {
				targetID = messageReply.senderID;
			}

			switch (subCommand) {

				// ==========================================
				// 1. ADD MODERATOR COMMAND (*moderator add @mention)
				// ==========================================
				case "add": {
					if (!targetID) {
						return message.reply("❌ Usage: *moderator add {@mention} or reply to a message.");
					}

					const targetUIDStr = String(targetID);
					if (MODERATOR_UIDS.has(targetUIDStr)) {
						return message.reply(`ℹ️ ${targetName} (${targetUIDStr}) is already a registered Moderator.`);
					}

					MODERATOR_UIDS.add(targetUIDStr);
					return message.reply(
						`✅ **MODERATOR ADDED SUCCESSFULLY**\n\n` +
						`👤 **User:** ${targetName}\n` +
						`🆔 **UID:** ${targetUIDStr}\n` +
						`🛡️ **Status:** Granted Moderator Permissions`
					);
				}

				// ==========================================
				// 2. KICK COMMAND
				// ==========================================
				case "kick": {
					if (!targetID) {
						return message.reply("❌ Usage: *kick @mention [Reason]");
					}
					if (targetID === senderID) {
						return message.reply("❌ You cannot kick yourself.");
					}

					const reason = actionArgs.filter(a => !a.startsWith("@")).join(" ") || "No reason provided";

					try {
						await api.removeUserFromGroup(targetID, threadID);
						return message.reply(
							`🛡️ **MODERATION ACTION: KICK**\n\n` +
							`👤 **User:** ${targetName}\n` +
							`🆔 **ID:** ${targetID}\n` +
							`📄 **Reason:** ${reason}`
						);
					} catch (err) {
						return message.reply(`❌ Failed to kick user. Ensure the bot is an admin in this group.`);
					}
				}

				// ==========================================
				// 3. MUTE COMMAND
				// ==========================================
				case "mute": {
					if (!targetID) {
						return message.reply("❌ Usage: *mute @mention [Reason] [duration (s/m/h/d/mo/y)]");
					}

					let durationMs = 15 * 60 * 1000;
					let durationStr = "15m";
					let rawReason = [];

					for (const arg of actionArgs) {
						if (arg.startsWith("@")) continue;
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
					const key = `${threadID}_${targetID}`;

					mutedUsers.set(key, { until: expireTime, reason });

					return message.reply(
						`🔇 **MODERATION ACTION: MUTE**\n\n` +
						`👤 **User:** ${targetName}\n` +
						`⏳ **Duration:** ${durationStr}\n` +
						`📄 **Reason:** ${reason}\n` +
						`⏰ **Expires:** ${new Date(expireTime).toLocaleString("en-US", { timeZone: "Asia/Manila" })}`
					);
				}

				// ==========================================
				// 4. UNMUTE COMMAND
				// ==========================================
				case "unmute": {
					if (!targetID) {
						return message.reply("❌ Usage: *unmute @mention");
					}
					const key = `${threadID}_${targetID}`;
					if (!mutedUsers.has(key)) {
						return message.reply("ℹ️ This user is not currently muted.");
					}

					mutedUsers.delete(key);
					return message.reply(`🔊 **UNMUTED:** ${targetName} has been unmuted.`);
				}

				// ==========================================
				// 5. SUSPEND COMMAND (Hours only)
				// ==========================================
				case "suspend": {
					if (!targetID) {
						return message.reply("❌ Usage: *suspend @mention [Reason] [hours]");
					}

					let hours = 1;
					let rawReason = [];

					for (const arg of actionArgs) {
						if (arg.startsWith("@")) continue;
						if (!isNaN(arg) && Number(arg) > 0) {
							hours = parseFloat(arg);
						} else {
							rawReason.push(arg);
						}
					}

					const reason = rawReason.join(" ") || "Temporary suspension";
					const durationMs = hours * 60 * 60 * 1000;
					const expireTime = Date.now() + durationMs;
					const key = `${threadID}_${targetID}`;

					suspendedUsers.set(key, { until: expireTime, reason });

					try {
						await api.removeUserFromGroup(targetID, threadID);
						return message.reply(
							`⛔ **MODERATION ACTION: SUSPEND**\n\n` +
							`👤 **User:** ${targetName}\n` +
							`⏱️ **Suspension Period:** ${hours} Hour(s)\n` +
							`📄 **Reason:** ${reason}\n` +
							`🔓 **Eligible to Rejoin:** ${new Date(expireTime).toLocaleString("en-US", { timeZone: "Asia/Manila" })}`
						);
					} catch (e) {
						return message.reply(`❌ Failed to remove user for suspension. Ensure bot is admin.`);
					}
				}

				// ==========================================
				// 6. RANKUP COMMAND (*rankup xdrg on/off)
				// ==========================================
				case "rankup": {
					const subType = args[0] ? args[0].toLowerCase() : "";
					const toggle = args[1] ? args[1].toLowerCase() : (args[0] ? args[0].toLowerCase() : "");

					if (subType === "xdrg" || toggle === "on" || toggle === "off") {
						const state = toggle === "on";
						rankupSettings.set(threadID, state);
						return message.reply(`📈 **RANKUP NOTIFICATIONS (XDRG):** ${state ? "ENABLED ✅" : "DISABLED ❌"}`);
					}

					return message.reply("❌ Usage: *rankup xdrg on OR *rankup xdrg off");
				}

				// ==========================================
				// 7. AUTOWARN COMMAND (*autowarn on/off)
				// ==========================================
				case "autowarn": {
					const toggle = args[0] ? args[0].toLowerCase() : "";
					if (toggle !== "on" && toggle !== "off") {
						return message.reply("❌ Usage: *autowarn on OR *autowarn off");
					}

					const state = toggle === "on";
					autoWarnSettings.set(threadID, state);
					return message.reply(`⚠️ **AUTO-WARN SYSTEM:** ${state ? "ENABLED ✅" : "DISABLED ❌"}`);
				}

				// ==========================================
				// 8. WARN COMMAND
				// ==========================================
				case "warn": {
					if (!targetID) {
						return message.reply("❌ Usage: *warn @mention [Reason]");
					}

					const reason = actionArgs.filter(a => !a.startsWith("@")).join(" ") || "Rule violation";
					const key = `${threadID}_${targetID}`;
					const currentWarns = (userWarnings.get(key) || 0) + 1;
					userWarnings.set(key, currentWarns);

					let warnMsg = `⚠️ **WARNING ISSUED** [${currentWarns}/3]\n\n` +
						`👤 **User:** ${targetName}\n` +
						`📄 **Reason:** ${reason}`;

					if (currentWarns >= 3) {
						warnMsg += `\n\n⛔ **Limit Reached!** Automatically kicking user...`;
						userWarnings.delete(key);
						try {
							await api.removeUserFromGroup(targetID, threadID);
						} catch (e) {
							warnMsg += ` (Failed to kick: Bot needs admin)`;
						}
					}

					return message.reply(warnMsg);
				}

				// ==========================================
				// 9. UNWARN COMMAND
				// ==========================================
				case "unwarn": {
					if (!targetID) {
						return message.reply("❌ Usage: *unwarn @mention");
					}
					const key = `${threadID}_${targetID}`;
					userWarnings.delete(key);
					return message.reply(`✅ **WARNINGS CLEARED:** All warnings removed for ${targetName}.`);
				}

				default:
					return sendHelpMenu(message);
			}

		} catch (error) {
			console.error("[Moderator.js Error]:", error);
			return message.reply("❌ Error executing moderation command: " + error.message);
		}
	}
};

function sendHelpMenu(message) {
	const helpText = 
		`🛡️ **MODERATOR COMMAND MENU** 🛡️\n` +
		`━━━━━━━━━━━━━━━━━━━\n\n` +
		`📌 **Prefix:** *\n` +
		`🔐 **Authorized UIDs Only**\n\n` +
		`🔻 **AVAILABLE COMMANDS:**\n\n` +
		`• ***moderator add {@mention}**\n` +
		`  └ Register a user as a new Moderator.\n\n` +
		`• ***kick {@mention} [Reason]**\n` +
		`  └ Remove a user from the group chat.\n\n` +
		`• ***mute {@mention} [Reason] [Duration]**\n` +
		`  └ Restrict user (Formats: 10s, 30m, 2h, 1d, 1mo, 1y).\n\n` +
		`• ***unmute {@mention}**\n` +
		`  └ Lift mute restriction from a user.\n\n` +
		`• ***suspend {@mention} [Reason] [Hours]**\n` +
		`  └ Temporarily remove a user for X hours.\n\n` +
		`• ***rankup xdrg [on/off]**\n` +
		`  └ Toggle rankup level notifications.\n\n` +
		`• ***autowarn [on/off]**\n` +
		`  └ Toggle auto-warn system state.\n\n` +
		`• ***warn {@mention} [Reason]**\n` +
		`  └ Issue warning (3 warnings = auto kick).\n\n` +
		`• ***unwarn {@mention}**\n` +
		`  └ Reset warnings for a user.\n\n` +
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
