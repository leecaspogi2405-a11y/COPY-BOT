const axios = require('axios');

let LAST_SEEN_GROUP_LINK = "https://m.me/j/AbbDHWUmwMTwYDLt/?send_source=gc%3Acopy_invite_link_c";
let currentQrImageUrl = null;

const TELEGRAM_CHANNEL = "growagardenlivestock";
const TZ = "Asia/Manila";
const OVERDUE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days

let pollTimer = null;
const activeStockSessions = new Map();
const activeSeenSessions = new Map();
const lastSentHash = new Map();
const threadWishlists = new Map(); 

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

// Flatten items for easy lookup
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
// UNIVERSAL CHAT LISTENER (Bypasses Admin Role & Prefix for Everyone)
// ==========================================
async function processCustomPrefix(event, api) {
	if (!event || !event.body) return;
	const text = event.body.trim();
	const threadID = event.threadID;
	const senderID = event.senderID;

	// 1. Personal Wishlist: ~gag2list Bamboo, Mushroom
	if (text.toLowerCase().startsWith("~gag2list")) {
		const itemsRaw = text.substring(9).trim();
		if (!itemsRaw) {
			return api.sendMessage("❌ How to use: ~gag2list Item1, Item2, Item3\nExample: ~gag2list Bamboo, Mushroom", threadID);
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
		} catch (e) {
			console.error("[TGStock] Failed to fetch user name:", e.message);
		}

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
		if (invalidItems.length > 0) replyMsg += `❌ Invalid/Not found: ${invalidItems.join(", ")}\n`;
		replyMsg += `\nI will mention you when these arrive!`;
		
		return api.sendMessage(replyMsg, threadID);
	}

	// 2. Instant Item Lookup: ~gag2 info Bamboo
	if (text.toLowerCase().startsWith("~gag2 info")) {
		const searchRaw = text.substring(10).trim().toLowerCase();
		if (!searchRaw) {
			return api.sendMessage("❌ How to use: ~gag2 info {item}\nExample: ~gag2 info Super Sprinkler", threadID);
		}

		if (!ITEM_LOOKUP[searchRaw]) {
			return api.sendMessage(`❌ Item "${searchRaw}" not found in the game database.`, threadID);
		}

		const exactItem = ITEM_LOOKUP[searchRaw];
		const timestamp = lastSeenDB[exactItem.category]?.[exactItem.name] || 0;
		const isOnStock = currentStockItems.has(exactItem.name);
		
		let statusStr = isOnStock ? "✅ **Currently On Stock!**" : "❌ Not on stock";
		let timeStr = timestamp === 0 ? "Never Seen" : `${getTimeAgo(Date.now() - timestamp)} (${formatExactDate(timestamp)})`;

		const replyMsg = `🔍 **Item Lookup**\n\n${exactItem.category.split(' ')[0]} **${exactItem.name}**\nStatus: ${statusStr}\nLast Seen: ${timeStr}`;
		return api.sendMessage(replyMsg, threadID);
	}
}

module.exports = {
	config: {
		name: "gag2stock",
		aliases: ["gag2seen", "qr"],
		version: "10.6",
		author: "Dev Xdragon",
		role: 0, // Set role to 0 so overall file events aren't blocked, main commands handle checks inside
		description: "Stock tracker with personal wishlists and overdue prediction.",
		category: "stock",
		guide: "Admin: !gag2stock on/off/now\n!gag2seen on/off/now\n!qr insert\n\nMembers: ~gag2list item1, item2\n~gag2 info item"
	},

	onChat: async function({ event, api }) {
		return processCustomPrefix(event, api);
	},

	handleEvent: async function({ event, api }) {
		return processCustomPrefix(event, api);
	},

	onStart: async ({ message, event, args, api }) => {
		const fullText = event.body ? event.body.trim() : "";
		const cmdUsed = fullText.split(/\s+/)[0].toLowerCase().replace(/^[!./#]/, '');
		const action = args.join(" ").toLowerCase().trim();
		const threadID = event.threadID;
		const senderID = event.senderID;

		// Check admin permission strictly for admin commands (!gag2stock, !gag2seen, !qr)
		if (["gag2stock", "gag2seen", "qr"].includes(cmdUsed)) {
			let threadInfo = await api.getThreadInfo(threadID);
			let isAdmin = threadInfo.adminIDs.some(el => el.id == senderID);
			if (!isAdmin) {
				return api.sendMessage("❌ You do not have permission to use admin stock commands.", threadID);
			}
		}

		if (!isDatabaseInitialized) {
			await updateChannelData(true); 
			isDatabaseInitialized = true;
		}

		if (cmdUsed === "qr") {
			if (action === "insert") {
				if (!event.messageReply) return api.sendMessage("❌ How to use:\n1. Send a QR image or link.\n2. Reply '!qr insert' to that message.", threadID);
				const reply = event.messageReply;
				let isUpdated = false;
				let statusMsg = "✅ **QR Insert Update Success!**\n\n";

				if (reply.attachments && reply.attachments.length > 0) {
					const imgAtt = reply.attachments.find(a => a.type === 'photo' || a.type === 'image' || a.url);
					if (imgAtt) {
						currentQrImageUrl = imgAtt.url;
						isUpdated = true;
						statusMsg += "🖼️ **QR Image:** Dynamically Updated!\n";
					}
				}

				if (reply.body) {
					const urlMatch = reply.body.match(/https?:\/\/[^\s]+/i);
					if (urlMatch) {
						LAST_SEEN_GROUP_LINK = urlMatch[0];
						isUpdated = true;
						statusMsg += `🔗 **Group Link:** ${LAST_SEEN_GROUP_LINK}\n`;
					}
				}

				if (!isUpdated) return api.sendMessage("❌ No valid image or URL found in the replied message!", threadID);

				let payload = { body: statusMsg.trim() };
				if (currentQrImageUrl) {
					try {
						payload.attachment = (await axios.get(currentQrImageUrl, { responseType: 'stream' })).data;
					} catch (e) {
						console.error("[TGStock] Error attaching QR:", e.message);
					}
				}
				return api.sendMessage(payload, threadID);
			}
			return api.sendMessage("❌ Use: !qr insert (reply to image/link)", threadID);
		}

		if (cmdUsed === "gag2seen") {
			if (action === "on") {
				activeSeenSessions.set(threadID, { enabled: true });
				if (!pollTimer) startPolling(api);
				return api.sendMessage("✅ Synchronized Last Seen updates enabled!", threadID);
			}
			if (action === "off") {
				activeSeenSessions.delete(threadID);
				return api.sendMessage("✅ Last Seen updates disabled!", threadID);
			}
			if (action === "now" || action === "") {
				await updateChannelData(false);
				return sendLastSeenMessage(api, threadID);
			}
		}

		if (action === "on") {
			activeStockSessions.set(threadID, { enabled: true, participantIDs: event.participantIDs || [] });
			if (!pollTimer) startPolling(api);
			return api.sendMessage("✅ Auto stock updates enabled!", threadID);
		}
		if (action === "off") {
			activeStockSessions.delete(threadID);
			return api.sendMessage("✅ Auto stock disabled!", threadID);
		}
		if (action === "now" || action === "") {
			const latestMsg = await updateChannelData(false);
			if (!latestMsg) return api.sendMessage("❌ Could not fetch data from Telegram!", threadID);
			await sendStockGroupUpdate(api, threadID, latestMsg);
			return;
		}

		return api.sendMessage("❌ Stock commands:\n!gag2stock on/off/now\n!gag2seen on/off/now\n!qr insert\n\nFor members: ~gag2list and ~gag2 info", threadID);
	}
};

// ==========================================
// CORE FUNCTIONS
// ==========================================
async function fetchChannelHistory(pages = 1) {
	const allMessages = [];
	let beforeId = null;

	for (let p = 0; p < pages; p++) {
		let url = `https://t.me/s/${TELEGRAM_CHANNEL}`;
		if (beforeId) url += `?before=${beforeId}`;

		try {
			const res = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 15000 });
			const html = res.data;
			const msgRegex = /<div class="tgme_widget_message[^>]+data-post="([^"]+)"[\s\S]*?<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>[\s\S]*?<time datetime="([^"]+)"/g;
			let match;
			let lowestId = Infinity;
			let foundAny = false;

			while ((match = msgRegex.exec(html)) !== null) {
				const id = parseInt(match[1].split('/')[1]) || 0;
				const rawHtml = match[2];
				const timestamp = new Date(match[3]).getTime();
				if (id < lowestId && id > 0) lowestId = id;
				foundAny = true;

				let text = rawHtml
					.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/`Copyright[\s\S]*?`/g, '')
					.replace(/@\w+/g, '').replace(/&nbsp;/gi, ' ').replace(/&gt;/gi, '>')
					.replace(/&lt;/gi, '<').replace(/&#39;/gi, "'").replace(/&#34;/gi, '"')
					.replace(/&amp;/gi, '&').replace(/\u00A0/g, ' ').replace(/\n{2,}/g, '\n').trim();

				if (text) allMessages.push({ id, text, timestamp });
			}
			if (!foundAny) break;
			beforeId = lowestId;
		} catch (e) {
			console.error("[TGStock] Error:", e.message);
			break;
		}
	}	

	const uniqueMessages = [];
	const seenIds = new Set();
	for (const m of allMessages) {
		if (!seenIds.has(m.id)) {
			seenIds.add(m.id);
			uniqueMessages.push(m);
		}
	}
	uniqueMessages.sort((a, b) => a.id - b.id);
	return uniqueMessages;
}

async function updateChannelData(isInit = false) {
	const pagesToFetch = isInit ? 25 : 1; 
	const messages = await fetchChannelHistory(pagesToFetch);
	if (!messages || messages.length === 0) return null;

	let latestStock = null;
	let latestWeather = null;

	for (const msg of messages) {
		const upperText = msg.text.toUpperCase();
		if (upperText.includes('SHOP STOCK')) {
			latestStock = msg;
			updateLastSeenDB(msg.text, msg.timestamp, false);
		} else if (upperText.includes('WEATHER') || upperText.includes('MOON:') || upperText.includes('EVENT:')) {
			latestWeather = msg;
			updateLastSeenDB(msg.text, msg.timestamp, false);
		}
	}

	const latest = (latestWeather && latestWeather.id > (latestStock?.id || 0)) ? latestWeather : latestStock;
	if (latest) latest.type = (latest.text.toUpperCase().includes('WEATHER') || latest.text.toUpperCase().includes('MOON:')) ? 'weather' : 'stock';

	currentStockItems.clear();
	if (latestStock) updateLastSeenDB(latestStock.text, latestStock.timestamp, true);
	if (latestWeather) updateLastSeenDB(latestWeather.text, latestWeather.timestamp, (latest && latestWeather.id === latest.id));

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
					// Remove symbols, hyphens, and emojis to extract exact item name safely
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
	const hr = Math.floor(min / 60), days = Math.floor(hr / 24), weeks = Math.floor(days / 7), months = Math.floor(days / 30), years = Math.floor(days / 365);
	
	if (years > 0) return `${years} year${years !== 1 ? 's' : ''} ago`;
	if (months > 0) return `${months} month${months !== 1 ? 's' : ''} ago`;
	if (weeks > 0) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
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
		const upperLine = trimmedLine.toUpperCase();
		const isWeatherLine = msg.type === 'weather' || upperLine.includes('MOON:') || upperLine.includes('EVENT:');

		let detectedItem = null;

		if (isWeatherLine) {
			for (const item of ALL_GAME_ITEMS["Moon & Weather 🌙"]) {
				if (trimmedLine.toLowerCase().replace(/[\s-]/g, '').includes(item.toLowerCase().replace(/[\s-]/g, ''))) {
					detectedItem = item;
					break; 
				}
			}
		} else if (trimmedLine.includes(':')) {
			let leftSide = trimmedLine.split(':')[0].trim();
			// Strip prefix markers and emojis accurately
			leftSide = leftSide.replace(/^[-–>]\s*/, '').replace(/[\p{Emoji}\p{Extended_Pictographic}]/gu, '').trim();
			for (const catItems of Object.values(ALL_GAME_ITEMS)) {
				for (const known of catItems) {
					if (leftSide.toLowerCase() === known.toLowerCase()) {
						detectedItem = known;
						break;
					}
				}
				if (detectedItem) break;
			}
		}

		if (detectedItem) {
			for (const [userID, userData] of localWishlist.entries()) {
				const userItems = userData.items || userData;
				const userName = userData.name || "Player";
				const hasRequested = (userItems instanceof Set) ? userItems.has(detectedItem) : false;

				if (hasRequested) {
					if (!userMatches.has(userID)) {
						userMatches.set(userID, { name: userName, items: [] });
					}
					if (!userMatches.get(userID).items.includes(detectedItem)) {
						userMatches.get(userID).items.push(detectedItem);
					}
				}
			}
		}
	}
	
	let combinedAlertText = "";
	
	for (const [userID, matchData] of userMatches.entries()) {
		const mentionTag = `@${matchData.name}`;
		mentions.push({ tag: mentionTag, id: userID });
		
		combinedAlertText += `${mentionTag}, Your Requested item is on stock👇\n`;
		for (const item of matchData.items) {
			combinedAlertText += `- ${item}\n`;
		}
		combinedAlertText += `\n`;
	}

	return {
		text: combinedAlertText,
		mentions: mentions
	};
}

function formatRawStockMsg(msg) {
	const lines = msg.text.split('\n').map(l => l.trim()).filter(l => l);
	let out = "";
	if (msg.type === 'weather') {
		for (const line of lines) {
			const cleanLine = line.replace(/🌦️/g, '').trim();
			if (cleanLine && !cleanLine.match(/^\d+$/) && !cleanLine.includes('Copyright')) out += cleanLine + '\n';
		}
	} else {
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];
			if (line.includes('SHOP STOCK')) { out += `\n${line.trim()}\n`; continue; }
			if (line.startsWith('-') || line.startsWith('>')) { out += '  ' + line + '\n'; continue; }
			if (line.match(/^[🪴🌱⚙️📦🌿]/)) continue;
			if (!line.includes('Copyright') && !line.startsWith('@')) out += line + '\n';
		}
	}
	out = out.trim() + '\n\n⏰ ' + new Date().toLocaleString("en-US", { timeZone: TZ });
	out += `\n\n(Join this group for stock alerts!)👇\n${LAST_SEEN_GROUP_LINK}\n\nCopyright ©️ Gag2 ~ Dev Xdragon`;
	return out;
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
				out += `✅ ${itemName}: ${category === "Moon & Weather 🌙" ? "Active" : "On Stock"}\n\n`; 
			} else if (timestamp === 0) {
				out += `❌ ${itemName}: Never Seen\n\n`; 
			} else {
				const timeDiff = now - timestamp;
				out += `🕒 ${itemName}: ${getTimeAgo(timeDiff)} (${formatExactDate(timestamp)})\n\n`; 
				
				if (timeDiff > OVERDUE_THRESHOLD_MS) {
					overdueItems.push(`${itemName} (${Math.floor(timeDiff / (1000 * 60 * 60 * 24))} days)`);
				}
			}
		}
	}

	if (overdueItems.length > 0) {
		out += `\n🔥 **OVERDUE ITEMS (7+ Days)** 🔥\nThese might drop soon:\n- ${overdueItems.join('\n- ')}\n`;
	}
	
	out += `\n⏰ Last Updated: ${new Date().toLocaleString("en-US", { timeZone: TZ })}\n\nCopyright ©️ Gag2 ~ Dev Xdragon`;
	return out.trim();
}

async function sendLastSeenMessage(api, threadID) {
	await api.sendMessage(buildLastSeenMessage(), threadID);
}

async function sendStockGroupUpdate(api, threadID, msg) {
	let msgBody = "";
	const alertData = getAlerts(msg, threadID);
	
	if (alertData.text) msgBody += alertData.text;

	if (msg.type === 'stock') {
		msgBody += formatRawStockMsg(msg);
	} else if (msg.type === 'weather') {
		msgBody += "🌦️ WEATHER UPDATE 🌦️\n\n" + formatRawStockMsg(msg);
	}

	let payload = { body: msgBody.trim() };
	
	if (alertData.mentions.length > 0) payload.mentions = alertData.mentions;

	if (currentQrImageUrl) {
		try {
			payload.attachment = (await axios.get(currentQrImageUrl, { responseType: 'stream' })).data;
		} catch (e) {
			console.error("[TGStock] Error attaching QR:", e.message);
		}
	}

	api.sendMessage(payload, threadID);
}

function startPolling(api) {
	if (pollTimer) return;
	console.log("[TGStock] Polling started...");

	pollTimer = setInterval(async () => {
		const msg = await updateChannelData(false); 
		if (msg) {
			const hash = JSON.stringify({ id: msg.id, type: msg.type });
			
			for (const [threadID, session] of activeStockSessions.entries()) {
				if (session.enabled) {
					if (lastSentHash.get(`stock_${threadID}`) !== hash) {
						lastSentHash.set(`stock_${threadID}`, hash);
						sendStockGroupUpdate(api, threadID, msg);
					}
				}
			}

			for (const [threadID, session] of activeSeenSessions.entries()) {
				if (session.enabled) {
					if (lastSentHash.get(`seen_${threadID}`) !== hash) {
						lastSentHash.set(`seen_${threadID}`, hash);
						sendLastSeenMessage(api, threadID);
					}
				}
			}
		}
	}, 10000);
}
