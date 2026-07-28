const axios = require('axios');
const crypto = require('crypto');
const { createCanvas, loadImage } = require('canvas');

let LAST_SEEN_GROUP_LINK = "https://m.me/j/AbbDHWUmwMTwYDLt/?send_source=gc%3Acopy_invite_link_c";
let currentQrImageUrl = null;

// NEW API ENDPOINT
const CUSTOM_API_URL = "https://api.growagarden2stock.com/";
const TZ = "Asia/Manila";
const OVERDUE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days

let pollTimer = null;
const activeStockSessions = new Map();
const activeSeenSessions = new Map();
const lastSentHash = new Map();
const threadWishlists = new Map(); 

// Replace these URLs with Discord Links when you upload your custom icons.
const ITEM_IMAGES = {
	"Carrot": "https://growagarden2.fandom.com/wiki/File:CarrotSeed.png",
	"Strawberry": "https://growagarden2.fandom.com/wiki/File:StrawberrySeed.png",
	"Blueberry": "https://growagarden2.fandom.com/wiki/File:BlueberrySeed.png",
	"Tulip": "https://growagarden2.fandom.com/wiki/File:TulipSeed.png",
	"Tomato": "https://growagarden2.fandom.com/wiki/File:TomatoSeed.png",
	"Apple": "https://growagarden2.fandom.com/wiki/File:AppleSeed.png",
	"Bamboo": "https://growagarden2.fandom.com/wiki/File:BambooSeed.png",
	"Corn": "https://growagarden2.fandom.com/wiki/File:CornSeed.png",
	"Cactus": "https://growagarden2.fandom.com/wiki/File:CactusSeed.png",
	"Pineapple": "https://growagarden2.fandom.com/wiki/File:PineappleSeed.png",
	"Mushroom": "https://growagarden2.fandom.com/wiki/File:MushroomSeed.png",
	"Green Bean": "https://growagarden2.fandom.com/wiki/File:GreenBeanSeed.png",
	"Banana": "https://growagarden2.fandom.com/wiki/File:BananaSeed.png",
	"Grape": "https://growagarden2.fandom.com/wiki/File:GrapeSeed.png",
	"Coconut": "https://growagarden2.fandom.com/wiki/File:CoconutSeed.png",
	"Mango": "https://growagarden2.fandom.com/wiki/File:MangoSeed.png",
	"Rocket Pop": "https://growagarden2.fandom.com/wiki/File:RocketPopSeed.png",
	"Dragon Fruit": "https://growagarden2.fandom.com/wiki/File:DragonFruitSeed.png",
	"Acorn": "https://growagarden2.fandom.com/wiki/File:AcornSeed.png",
	"Cherry": "https://growagarden2.fandom.com/wiki/File:CherrySeed.png",
	"Sunflower": "https://growagarden2.fandom.com/wiki/File:SunflowerSeed.png",
	"Fire Fern": "https://growagarden2.fandom.com/wiki/File:FireFernSeed.png",
	"Venus Fly Trap": "https://growagarden2.fandom.com/wiki/File:VenusFlyTrapSeed.png",
	"Pomegranate": "https://growagarden2.fandom.com/wiki/File:PomegranateSeed.png",
	"Poison Apple": "https://growagarden2.fandom.com/wiki/File:PoisonAppleSeed.png",
	"Venom Spitter": "https://growagarden2.fandom.com/wiki/File:VenomSpitterSeed.png",
	"Moon Bloom": "https://growagarden2.fandom.com/wiki/File:MoonBloomSeed.png",
	"Hypno Bloom": "https://growagarden2.fandom.com/wiki/File:HypnoBloomSeed.png",
	"Dragon's Breath": "https://growagarden2.fandom.com/wiki/File:Dragon'sBreathSeed.png",
	"Sun Bloom": "https://growagarden2.fandom.com/wiki/File:SunBloomSeed.png",
	"Star Fruit": "https://growagarden2.fandom.com/wiki/File:StarFruitSeed.png"
};

const CREDIT_IMAGE_URL = "https://cdn.discordapp.com/attachments/1515213930870472724/1531659533628342523/orca-image-1568852075.jpeg.jpg?ex=6a6a0499&is=6a68b319&hm=44f07ee1bcd76f34fd682bb35f91251467078d9e8700fba2575921d3aec1714c&";

const ALL_GAME_ITEMS = {
	"Seed 🌱": [
		"Carrot", "Strawberry", "Blueberry", "Tulip", "Tomato", "Bamboo", "Corn", "Banana", 
		"Apple", "Grape", "Pineapple", "Sun Bloom", "Poison Apple", "Coconut", "Mango", 
		"Cactus", "Cherry", "Green Bean", "Acorn", "Venom Spitter", "Mushroom", 
		"Dragon's Breath", "Star Fruit", "Moon Bloom", "Hypno Bloom", "Fire Fern", "Sunflower",
		"Venus Fly Trap", "Pomegranate"
	],
	"Gear ⚙️": [
		"Common Watering Can", "Common Sprinkler", "Uncommon Sprinkler", "Jump Mushroom", 
		"Trowel", "Invisibility Mushroom", "Rare Sprinkler", "Shrink Mushroom", 
		"Speed Mushroom", "Gnome", "Super Watering Can", "Super Sprinkler", "Legendary Sprinkler", 
		"Basic Pot"
	],
	"Crate 📦": [
		"Bench Crate", "Ladder Crate", "Light Crate", "Arch Crate", "Sign Crate", 
		"Owner Door Crate", "Spring Crate", "Bridge Crate", "Roleplay Crate", "Picture Frame Crate", 
		"Seesaw Crate", "Conveyor Crate", "Boombox Crate", "Teleporter Pad Crate", "Fence Crate",
		"Bear Trap Crate", "Cobblestone Crate", "Fall Structure Crate"
	],
	"Moon & Weather 🌙": [
		"Rainbowmoon", "Mega Moon", "Bloodmoon", "Goldmoon", "Sunburst", 
		"Snowfall", "Rainbow", "Meteor", "Aurora", "Rain", "Snow", "Lightning", "Blizzard"
	]
};

const ITEM_LOOKUP = {};
for (const [cat, items] of Object.entries(ALL_GAME_ITEMS)) {
	for (const item of items) {
		ITEM_LOOKUP[item.toLowerCase()] = { name: item, category: cat };
	}
}

const lastSeenDB = {};
for (const [category, items] of Object.entries(ALL_GAME_ITEMS)) {
	lastSeenDB[category] = {};
	for (const item of items) {
		lastSeenDB[category][item] = 0;
	}
}

let currentStockItems = new Set();
let isDatabaseInitialized = false;

// ==========================================
// UNIVERSAL CHAT LISTENER (Bypasses Admin Role)
// ==========================================
async function processCustomPrefix(event, api) {
	if (!event || !event.body) return;
	const text = event.body.trim();
	const threadID = event.threadID;
	const senderID = event.senderID;

	if (text.toLowerCase().startsWith("~gag2list")) {
		const itemsRaw = text.substring(9).trim();
		if (!itemsRaw) {
			return api.sendMessage("❌ How to use: ~gag2list Item1, Item2\nExample: ~gag2list Bamboo, Mushroom", threadID);
		}

		const requestedItems = itemsRaw.split(",").map(i => i.trim().toLowerCase());
		const addedItems = [];
		const invalidItems = [];

		if (!threadWishlists.has(threadID)) threadWishlists.set(threadID, new Map());
		const threadList = threadWishlists.get(threadID);

		let userName = "Player";
		try {
			const userInfo = await api.getUserInfo(senderID);
			if (userInfo && userInfo[senderID] && userInfo[senderID].name) {
				userName = userInfo[senderID].name;
			}
		} catch (e) {}

		if (!threadList.has(senderID)) {
			threadList.set(senderID, { name: userName, items: new Set() });
		}
		
		const userData = threadList.get(senderID);
		userData.name = userName;

		for (const req of requestedItems) {
			if (ITEM_LOOKUP[req]) {
				userData.items.add(ITEM_LOOKUP[req].name);
				addedItems.push(ITEM_LOOKUP[req].name);
			} else {
				invalidItems.push(req);
			}
		}

		let replyMsg = `🎯 **Personal Wishlist Updated for ${userName}!**\n\n`;
		if (addedItems.length > 0) replyMsg += `✅ Added: ${addedItems.join(", ")}\n`;
		if (invalidItems.length > 0) replyMsg += `❌ Invalid: ${invalidItems.join(", ")}\n`;
		replyMsg += `\nI will mention you when these arrive!`;
		
		return api.sendMessage(replyMsg, threadID);
	}

	if (text.toLowerCase().startsWith("~gag2 info")) {
		const searchRaw = text.substring(10).trim().toLowerCase();
		if (!searchRaw) return api.sendMessage("❌ Use: ~gag2 info {item}", threadID);

		if (!ITEM_LOOKUP[searchRaw]) return api.sendMessage(`❌ Item "${searchRaw}" not found.`, threadID);

		const exactItem = ITEM_LOOKUP[searchRaw];
		const timestamp = lastSeenDB[exactItem.category]?.[exactItem.name] || 0;
		const isOnStock = currentStockItems.has(exactItem.name);
		
		let statusStr = isOnStock ? "✅ **Currently On Stock!**" : "❌ Not on stock";
		let timeStr = timestamp === 0 ? "Never Seen" : `${getTimeAgo(Date.now() - timestamp)} (${formatExactDate(timestamp)})`;

		return api.sendMessage(`🔍 **Item Lookup**\n\n${exactItem.category.split(' ')[0]} **${exactItem.name}**\nStatus: ${statusStr}\nLast Seen: ${timeStr}`, threadID);
	}
}

module.exports = {
	config: {
		name: "gag2stock",
		aliases: ["gag2seen", "qr"],
		version: "12.0",
		author: "Dev Xdragon",
		role: 0,
		description: "Stock tracker strictly using Custom API with full image generation.",
		category: "stock",
		guide: "Admin: !gag2stock on/off/now\n!gag2seen on/off/now\n!qr insert\nMembers: ~gag2list item1\n~gag2 info item"
	},

	onChat: async function({ event, api }) { return processCustomPrefix(event, api); },
	handleEvent: async function({ event, api }) { return processCustomPrefix(event, api); },

	onStart: async ({ message, event, args, api }) => {
		const fullText = event.body ? event.body.trim() : "";
		const cmdUsed = fullText.split(/\s+/)[0].toLowerCase().replace(/^[!./#]/, '');
		const action = args.join(" ").toLowerCase().trim();
		const threadID = event.threadID;
		const senderID = event.senderID;

		if (["gag2stock", "gag2seen", "qr"].includes(cmdUsed)) {
			let threadInfo = await api.getThreadInfo(threadID);
			let isAdmin = threadInfo.adminIDs.some(el => el.id == senderID);
			if (!isAdmin) return api.sendMessage("❌ Admin permission required.", threadID);
		}

		if (!isDatabaseInitialized) {
			await updateChannelData(); 
			isDatabaseInitialized = true;
		}

		if (cmdUsed === "qr") {
			if (action === "insert") {
				if (!event.messageReply) return api.sendMessage("❌ Reply to a QR image/link with '!qr insert'.", threadID);
				const reply = event.messageReply;
				let isUpdated = false;
				let statusMsg = "✅ **QR Insert Success!**\n\n";

				if (reply.attachments && reply.attachments.length > 0) {
					const imgAtt = reply.attachments.find(a => a.type === 'photo' || a.type === 'image' || a.url);
					if (imgAtt) {
						currentQrImageUrl = imgAtt.url;
						isUpdated = true;
						statusMsg += "🖼️ **QR Image Added!**\n";
					}
				}

				if (reply.body) {
					const urlMatch = reply.body.match(/https?:\/\/[^\s]+/i);
					if (urlMatch) {
						LAST_SEEN_GROUP_LINK = urlMatch[0];
						isUpdated = true;
						statusMsg += `🔗 **Link:** ${LAST_SEEN_GROUP_LINK}\n`;
					}
				}

				if (!isUpdated) return api.sendMessage("❌ No image or URL found!", threadID);
				return api.sendMessage(statusMsg.trim(), threadID);
			}
		}

		if (cmdUsed === "gag2seen") {
			if (action === "on") {
				activeSeenSessions.set(threadID, { enabled: true });
				if (!pollTimer) startPolling(api);
				return api.sendMessage("✅ Last Seen updates enabled!", threadID);
			}
			if (action === "off") {
				activeSeenSessions.delete(threadID);
				return api.sendMessage("✅ Last Seen updates disabled!", threadID);
			}
			if (action === "now" || action === "") {
				await updateChannelData();
				return sendLastSeenMessage(api, threadID);
			}
		}

		if (action === "on") {
			activeStockSessions.set(threadID, { enabled: true });
			if (!pollTimer) startPolling(api);
			return api.sendMessage("✅ Auto stock updates enabled!", threadID);
		}
		if (action === "off") {
			activeStockSessions.delete(threadID);
			return api.sendMessage("✅ Auto stock disabled!", threadID);
		}
		if (action === "now" || action === "") {
			const latestMsg = await updateChannelData();
			if (!latestMsg) return api.sendMessage("❌ Could not fetch data from Custom API!", threadID);
			await sendStockGroupUpdate(api, threadID, latestMsg);
			return;
		}

		return api.sendMessage("❌ Commands:\n!gag2stock on/off/now\n!gag2seen on/off/now\n!qr insert", threadID);
	}
};

// ==========================================
// CUSTOM API DATA FETCHER
// ==========================================
async function fetchChannelHistory() {
	try {
		const res = await axios.get(CUSTOM_API_URL, { timeout: 15000 });
		
		let rawText = "";
		if (typeof res.data === 'string') {
			rawText = res.data;
		} else if (res.data && typeof res.data === 'object') {
			rawText = res.data.text || res.data.content || res.data.message || res.data.stock || JSON.stringify(res.data);
		}

		if (!rawText || rawText.trim() === "") return null;

		// Clean HTML if API sends raw HTML blocks by mistake
		rawText = rawText.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();

		const hashId = crypto.createHash('md5').update(rawText).digest('hex');
		
		let type = 'stock';
		if (rawText.toUpperCase().includes('WEATHER') || rawText.toUpperCase().includes('MOON:') || rawText.toUpperCase().includes('EVENT:')) {
			type = 'weather';
		}

		return {
			id: hashId,
			text: rawText,
			timestamp: Date.now(),
			type: type
		};
	} catch (e) {
		console.error("[TGStock] Custom API Error:", e.message);
		return null;
	}
}

async function updateChannelData() {
	const latest = await fetchChannelHistory();
	if (!latest) return null;

	currentStockItems.clear();
	updateLastSeenDB(latest.text, latest.timestamp, true);
	return latest;
}

function updateLastSeenDB(text, timestamp, addToCurrent = false) {
	const lines = text.split('\n');
	let currentCategory = null;

	if (text.toUpperCase().includes('WEATHER') || text.toUpperCase().includes('MOON:')) currentCategory = 'Moon & Weather 🌙';

	for (const line of lines) {
		const upperLine = line.toUpperCase();
		if (upperLine.includes('SEED SHOP')) currentCategory = 'Seed 🌱';
		else if (upperLine.includes('GEAR SHOP')) currentCategory = 'Gear ⚙️';
		else if (upperLine.includes('CRATE SHOP')) currentCategory = 'Crate 📦';
		else if (upperLine.includes('MOON:') || upperLine.includes('EVENT:')) currentCategory = 'Moon & Weather 🌙';
		else if (currentCategory) {
			let itemName = "";
			if (currentCategory === 'Moon & Weather 🌙') {
				for (const knownItem of ALL_GAME_ITEMS[currentCategory]) {
					if (line.toLowerCase().replace(/[\s-]/g, '').includes(knownItem.toLowerCase().replace(/[\s-]/g, ''))) {
						itemName = knownItem; break;
					}
				}
			} else {
				if (line.includes(':')) {
					let rawName = line.split(':')[0].trim();
					rawName = rawName.replace(/^[-–>]\s*/, '').replace(/[\p{Emoji}\p{Extended_Pictographic}]/gu, '').trim();
					for (const knownItem of ALL_GAME_ITEMS[currentCategory]) {
						if (rawName.toLowerCase() === knownItem.toLowerCase()) { itemName = knownItem; break; }
					}
				}
			}
			if (itemName && lastSeenDB[currentCategory] !== undefined) {
				lastSeenDB[currentCategory][itemName] = Math.max(lastSeenDB[currentCategory][itemName] || 0, timestamp);
				if (addToCurrent) currentStockItems.add(itemName);
			}
		}
	}
}

function formatExactDate(ms) {
	if (ms <= 0) return "";
	return new Date(ms).toLocaleString("en-US", { timeZone: TZ, month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

function getTimeAgo(ms) {
	if (ms <= 0) return "Never Seen";
	const min = Math.floor(ms / 60000);
	if (min < 1) return "just now";
	const hr = Math.floor(min / 60), days = Math.floor(hr / 24);
	if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
	if (hr > 0) return `${hr} hr${hr !== 1 ? 's' : ''} ago`;
	return `${min} min${min !== 1 ? 's' : ''} ago`;
}

function getAlerts(msg, threadID) {
	if (!msg || !msg.text) return { text: "", mentions: [] };
	const lines = msg.text.split('\n');
	
	const mentions = [];
	const userMatches = new Map();
	const localWishlist = threadWishlists.get(threadID) || new Map();

	for (const line of lines) {
		const trimmedLine = line.trim();
		const isWeatherLine = msg.type === 'weather' || trimmedLine.toUpperCase().includes('MOON:');
		let detectedItem = null;

		if (isWeatherLine) {
			for (const item of ALL_GAME_ITEMS["Moon & Weather 🌙"]) {
				if (trimmedLine.toLowerCase().replace(/[\s-]/g, '').includes(item.toLowerCase().replace(/[\s-]/g, ''))) {
					detectedItem = item; break; 
				}
			}
		} else if (trimmedLine.includes(':')) {
			let leftSide = trimmedLine.split(':')[0].trim().replace(/^[-–>]\s*/, '').replace(/[\p{Emoji}\p{Extended_Pictographic}]/gu, '').trim();
			for (const catItems of Object.values(ALL_GAME_ITEMS)) {
				for (const known of catItems) {
					if (leftSide.toLowerCase() === known.toLowerCase()) { detectedItem = known; break; }
				}
				if (detectedItem) break;
			}
		}

		if (detectedItem) {
			for (const [userID, userData] of localWishlist.entries()) {
				if ((userData.items || userData).has(detectedItem)) {
					if (!userMatches.has(userID)) userMatches.set(userID, { name: userData.name || "Player", items: [] });
					if (!userMatches.get(userID).items.includes(detectedItem)) userMatches.get(userID).items.push(detectedItem);
				}
			}
		}
	}
	
	let combinedAlertText = "";
	for (const [userID, matchData] of userMatches.entries()) {
		const mentionTag = `@${matchData.name}`;
		mentions.push({ tag: mentionTag, id: userID });
		combinedAlertText += `${mentionTag}, Your Requested item is on stock👇\n`;
		for (const item of matchData.items) combinedAlertText += `- ${item}\n`;
		combinedAlertText += `\n`;
	}

	return { text: combinedAlertText, mentions: mentions };
}

// ==========================================
// ALL-IN-ONE IMAGE GENERATION via CANVAS
// ==========================================
async function generateStockImage(msg) {
	// Filter out empty lines to correctly calculate height
	const lines = msg.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
	
	const width = 600;
	const padding = 30;
	const lineSpacing = 35;
	const creditHeight = 150;
	
	// Dynamic Height: Lines height + top padding + bottom padding + credit image space
	const height = (lines.length * lineSpacing) + (padding * 3) + creditHeight; 

	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	// 1. Draw beautiful Dark Blue Background
	ctx.fillStyle = '#0a192f'; 
	ctx.fillRect(0, 0, width, height);

	// 2. Setup Fonts (Including Emojis as fallback)
	ctx.fillStyle = '#ffffff';
	// Apple Color Emoji and Segoe UI Emoji will render API emojis natively if PNG fails
	ctx.font = 'bold 22px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Arial"';
	
	let y = padding + 20;

	// 3. Draw text and fetch/draw exact API Emojis / PNGs
	for (let line of lines) {
		let matchedItem = null;
		// Clean the line solely to find the item name, but we will draw the RAW line
		let cleanLine = line.replace(/^[-–>]\s*/, '').replace(/[\p{Emoji}\p{Extended_Pictographic}]/gu, '').trim();
		let rawName = cleanLine.split(':')[0].trim();
		
		for (const catItems of Object.values(ALL_GAME_ITEMS)) {
			for (const known of catItems) {
				if (rawName.toLowerCase() === known.toLowerCase()) {
					matchedItem = known;
					break;
				}
			}
			if (matchedItem) break;
		}

		if (matchedItem && ITEM_IMAGES[matchedItem]) {
			try {
				const img = await loadImage(ITEM_IMAGES[matchedItem]);
				ctx.drawImage(img, padding, y - 24, 30, 30);
				
				// Draw the exact line (containing text and API emojis) next to it
				ctx.fillText(line, padding + 45, y);
			} catch (e) {
				// Fallback: If PNG fails, just draw the text (which uses Canvas Emoji Font)
				ctx.fillText(line, padding, y); 
			}
		} else {
			// No PNG defined? Draw exact API line (Canvas will render the emoji from the API)
			ctx.fillText(line, padding, y);
		}
		y += lineSpacing;
	}

	// 4. Draw the Credit Image at the bottom (Inside the same picture!)
	try {
		const creditImg = await loadImage(CREDIT_IMAGE_URL);
		const cWidth = 350;
		ctx.drawImage(creditImg, (width/2) - (cWidth/2), height - creditHeight - padding, cWidth, creditHeight);
	} catch (e) {
		console.error("[TGStock] Failed to load Credit Image:", e.message);
	}

	return canvas.toBuffer('image/png');
}

async function sendStockGroupUpdate(api, threadID, msg) {
	const alertData = getAlerts(msg, threadID);
	
	// Message body is strictly for Mentions now (Image handles everything else)
	let payload = { body: alertData.text || "🟢 **STOCK UPDATE**" };
	if (alertData.mentions.length > 0) payload.mentions = alertData.mentions;

	try {
		// Generate the All-In-One Blue Image
		const generatedImageBuffer = await generateStockImage(msg);
		payload.attachment = [generatedImageBuffer];
		
		// Attach QR Code if user configured it
		if (currentQrImageUrl) {
			const qrBuffer = (await axios.get(currentQrImageUrl, { responseType: 'stream' })).data;
			payload.attachment.push(qrBuffer);
		}
	} catch (e) {
		console.error("[TGStock] Canvas Error:", e);
		payload.body += `\n\n${msg.text}`; // Failsafe
	}

	api.sendMessage(payload, threadID);
}

function buildLastSeenMessage() {
	let out = "🟢 LIVE STOCK & LAST SEEN 🟢\n";
	const overdueItems = [];
	const now = Date.now();
	
	for (const [category, itemsList] of Object.entries(ALL_GAME_ITEMS)) {
		out += `\n【 ${category} 】\n\n`;
		for (const itemName of itemsList) {
			const timestamp = lastSeenDB[category]?.[itemName] || 0;
			if (currentStockItems.has(itemName)) {
				out += `✅ ${itemName}: Active\n\n`; 
			} else if (timestamp === 0) {
				out += `❌ ${itemName}: Never Seen\n\n`; 
			} else {
				const timeDiff = now - timestamp;
				out += `🕒 ${itemName}: ${getTimeAgo(timeDiff)}\n\n`; 
				if (timeDiff > OVERDUE_THRESHOLD_MS) overdueItems.push(`${itemName}`);
			}
		}
	}

	if (overdueItems.length > 0) out += `\n🔥 **OVERDUE (7+ Days)** 🔥\n- ${overdueItems.join('\n- ')}\n`;
	out += `\n⏰ Last Updated: ${new Date().toLocaleString("en-US", { timeZone: TZ })}\n\nCopyright ©️ Gag2 ~ Dev Xdragon`;
	return out.trim();
}

async function sendLastSeenMessage(api, threadID) {
	await api.sendMessage(buildLastSeenMessage(), threadID);
}

function startPolling(api) {
	if (pollTimer) return;
	console.log("[TGStock] Polling started from Custom API...");

	pollTimer = setInterval(async () => {
		const msg = await updateChannelData(); 
		if (msg) {
			// Compare hashes to see if the custom API sent new data
			if (lastSentHash.get("global_api_hash") !== msg.id) {
				lastSentHash.set("global_api_hash", msg.id);
				
				for (const [threadID, session] of activeStockSessions.entries()) {
					if (session.enabled) sendStockGroupUpdate(api, threadID, msg);
				}
				for (const [threadID, session] of activeSeenSessions.entries()) {
					if (session.enabled) sendLastSeenMessage(api, threadID);
				}
			}
		}
	}, 10000);
}
