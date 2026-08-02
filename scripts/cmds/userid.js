const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// Database path for user info storage
const DB_FILE = path.join(__dirname, 'userData.json');

function loadData() {
	if (!fs.existsSync(DB_FILE)) return {};
	try {
		return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
	} catch (err) {
		return {};
	}
}

function saveData(data) {
	fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Dynamically detects the exact role of the user (Bot Admin / Group Admin / Member)
async function getUserRole(api, threadID, targetID) {
	try {
		// Check if target is a Bot Admin from global GoatBot config
		if (global.GoatBot && global.GoatBot.config && Array.isArray(global.GoatBot.config.adminBot)) {
			if (global.GoatBot.config.adminBot.includes(targetID)) {
				return "Bot Admin";
			}
		}

		// Check if target is a Group Chat Admin
		const threadInfo = await api.getThreadInfo(threadID);
		if (threadInfo && Array.isArray(threadInfo.adminIDs)) {
			const isGroupAdmin = threadInfo.adminIDs.some(admin => admin.id === targetID);
			if (isGroupAdmin) return "Group Admin";
		}
	} catch (e) {
		// Fallback if API call fails
	}
	return "Member";
}

module.exports = {
	config: {
		name: "userId",
		aliases: ["id", "add"],
		version: "5.0.0",
		author: "DEV XDRAGON",
		countDown: 3,
		role: 0,
		description: "Sends user details as text with Asia/Manila sync time and dynamic role detection",
		category: "utility",
		guide: {
			en: "!add @mention {number} {rbxluser}\n~id\n~id @mention"
		}
	},

	onChat: async function ({ api, event, message }) {
		await handleCommands({ api, event, message });
	},

	onStart: async function ({ api, event, message, args }) {
		await handleCommands({ api, event, message, args });
	}
};

async function handleCommands({ api, event, message }) {
	if (!event.body) return;
	const body = event.body.trim();
	const senderID = event.senderID;
	const threadID = event.threadID;

	// =========================================================
	// 1. ADMIN COMMAND: !add @mention {number} {rbxluser}
	// =========================================================
	if (body.toLowerCase().startsWith("!add")) {
		const mentions = event.mentions || {};
		const mentionedIDs = Object.keys(mentions);

		if (mentionedIDs.length === 0) {
			const replyMsg = "❌ Usage: !add @mention {number} {rbxluser}";
			return message ? message.reply(replyMsg) : api.sendMessage(replyMsg, threadID, event.messageID);
		}

		const targetID = mentionedIDs[0];
		const mentionedName = mentions[targetID];

		const rawArgs = body.replace(/!add/i, "").replace(mentionedName, "").trim();
		const args = rawArgs.split(/ +/).filter(Boolean);

		if (args.length < 2) {
			const replyMsg = "❌ Missing parameters!\n\n📌 Usage: !add @mention {number} {rbxluser}";
			return message ? message.reply(replyMsg) : api.sendMessage(replyMsg, threadID, event.messageID);
		}

		const number = args[0];
		const rbxluser = args.slice(1).join(" ");

		const db = loadData();
		db[targetID] = { number, rbxluser };
		saveData(db);

		const successMsg = `✅ Saved user details!\n👤 UID: ${targetID}\n📱 Number: ${number}\n🎮 Roblox Username: ${rbxluser}`;
		return message ? message.reply(successMsg) : api.sendMessage(successMsg, threadID, event.messageID);
	}

	// =========================================================
	// 2. USER COMMAND: ~id OR ~id @mention
	// =========================================================
	if (body.toLowerCase().startsWith("~id")) {
		const mentions = event.mentions || {};
		const mentionedIDs = Object.keys(mentions);
		const targetID = mentionedIDs.length > 0 ? mentionedIDs[0] : senderID;

		try {
			const userInfoMap = await api.getUserInfo(targetID);
			const userInfo = userInfoMap[targetID] || {};

			const name = userInfo.name || "Facebook User";

			// Dynamically detect user role (Bot Admin / Group Admin / Member)
			const role = await getUserRole(api, threadID, targetID);

			const db = loadData();
			const userData = db[targetID] || {};

			const number = userData.number || "(not available)";
			const rbxluser = userData.rbxluser || "(not available)";
			const uid = targetID;

			// Exact Asia/Manila (Philippines) local date and time formatting
			const syncTime = new Date().toLocaleString("en-US", {
				timeZone: "Asia/Manila",
				dateStyle: "medium",
				timeStyle: "short"
			});

			// Plain text message body
			const textMessage = 
				`Name:${name}\n` +
				`Role:${role}\n` +
				`Number:${number}\n` +
				`Rbxl username:${rbxluser}\n` +
				`Uid:${uid}\n` +
				`Sync:${syncTime}\n\n` +
				`POWERED BY:DEV XDRAGON`;

			// Canvas processing strictly for the Profile Avatar
			const canvas = createCanvas(300, 300);
			const ctx = canvas.getContext("2d");

			// Canvas Avatar Frame Background
			ctx.fillStyle = "#1e1e2e";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// Render Profile Avatar
			try {
				const avatarUrl = `https://graph.facebook.com/${targetID}/picture?height=500&width=500&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
				const response = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
				const avatar = await loadImage(Buffer.from(response.data));

				ctx.save();
				ctx.beginPath();
				ctx.arc(150, 150, 120, 0, Math.PI * 2, true);
				ctx.closePath();
				ctx.clip();
				ctx.drawImage(avatar, 30, 30, 240, 240);
				ctx.restore();

				// Outer Circular Accent Border
				ctx.strokeStyle = "#89b4fa";
				ctx.lineWidth = 8;
				ctx.beginPath();
				ctx.arc(150, 150, 120, 0, Math.PI * 2, true);
				ctx.stroke();
			} catch (e) {
				console.error("[Avatar Canvas Error]:", e.message);
			}

			// Save cached Canvas image
			const cacheDir = path.join(__dirname, 'cache');
			if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

			const imagePath = path.join(cacheDir, `profile_${targetID}.png`);
			const imageBuffer = await canvas.encode("png");
			fs.writeFileSync(imagePath, imageBuffer);

			const attachment = fs.createReadStream(imagePath);

			const msgPayload = {
				body: textMessage,
				attachment: attachment
			};

			if (message) {
				await message.reply(msgPayload);
			} else {
				await api.sendMessage(msgPayload, threadID, event.messageID);
			}

			// Clean up cached image
			if (fs.existsSync(imagePath)) {
				fs.unlinkSync(imagePath);
			}

		} catch (error) {
			console.error("[ID Command Error]:", error);
			const errReply = "❌ An error occurred while fetching user data.";
			return message ? message.reply(errReply) : api.sendMessage(errReply, threadID, event.messageID);
		}
	}
}
