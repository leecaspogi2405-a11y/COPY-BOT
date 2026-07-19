Const axios = require('axios');

const TELEGRAM_CHANNEL = "growagardenlivestock";
const TZ = "Asia/Manila";
let pollTimer = null;

const activeSessions = new Map();
const lastSentHash = new Map();

const ALL_GAME_ITEMS = {
	"Seed 🌱": [
		"Carrot", "Strawberry", "Blueberry", "Tulip", "Tomato", "Bamboo", "Corn", "Banana", 
		"Apple", "Grape", "Pineapple", "Sun Bloom", "Poison Apple", "Coconut", "Mango", 
		"Cactus", "Cherry", "Green Bean", "Acorn", "Venom Spitter", "Mushroom", 
		"Dragon's Breath", "Star Fruit", "Moon Bloom", "Hypno Bloom", "Fire Fern"
	],
	"Gear ⚙️": [
		"Common Watering Can", "Common Sprinkler", "Uncommon Sprinkler", "Jump Mushroom", 
		"Trowel", "Invisibility Mushroom", "Invisible Mushroom", "Rare Sprinkler", "Shrink Mushroom", 
		"Speed Mushroom", "Gnome", "Super Watering Can", "Super Sprinkler", "Legendary Sprinkler", 
		"Basic Pot", "Strawberry Sniper"
	],
	"Crate 📦": [
		"Bench Crate", "Ladder Crate", "Light Crate", "Arch Crate", "Sign Crate", 
		"Owner Door Crate", "Spring Crate", "Bridge Crate", "Roleplay Crate", "Picture Frame Crate", 
		"Seesaw Crate", "Conveyor Crate", "Boombox Crate", "Teleporter Pad Crate", "Fence Crate"
	],
	"Moon & Weather 🌙": [
		// Longest items first for accurate parsing!
		"Rainbowmoon", "Megamoon", "Bloodmoon", "Goldmoon", "Sunburst", 
		"Snowfall", "Rainbow", "Meteor", "Aurora", "Rain", "Snow"
	]
};

// Dynamically generate the DB structure based on ALL_GAME_ITEMS
const lastSeenDB = {};
for (const [category, items] of Object.entries(ALL_GAME_ITEMS)) {
	lastSeenDB[category] = {};
	for (const item of items) {
		lastSeenDB[category][item] = 0;
	}
}

let currentStockItems = new Set();
let isDatabaseInitialized = false;

const TARGET_ITEMS = [
	"Dragon's Breath", "Venom Spitter", "Star Fruit", "Moon Bloom", "Hypno Bloom", "Sun Bloom",
	"Super Watering Can", "Super Sprinkler", "Legendary Sprinkler", "Rare Sprinkler", "Poison Apple",
	"Mushroom", "Cherry", "Fire Fern", "Basic Pot", "Strawberry Sniper", "Owner Door Crate",
	"Teleporter Pad Crate", "Fence Crate"
];

module.exports = {
	config: {
		name: "gag2stock",
		version: "5.3",
		author: "Dev Xdragon",
		role: 1,
		description: "Auto stock & Last seen tracker for Grow A Garden",
		category: "stock",
		guide: "{pn} on - Enable auto stock\n{pn} off - Disable auto stock\n{pn} now - View live stock & last seen dashboard"
	},

	onStart: async ({ message, event, args, api }) => {
		const body = args.join(" ").toLowerCase();
		const threadID = event.threadID;

		if (!isDatabaseInitialized) {
			await updateChannelData();
			isDatabaseInitialized = true;
		}

		if (body === "on") {
			activeSessions.set(threadID, { enabled: true, participantIDs: event.participantIDs || [] });
			if (!pollTimer) startPolling(api);
			return message.reply("✅ Auto stock & Last Seen tracker enabled for this chat!");
		}

		if (body === "off") {
			activeSessions.delete(threadID);
			if (activeSessions.size === 0 && pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
			return message.reply("✅ Auto stock disabled!");
		}

		if (body === "now" || body === "") {
			const latestMsg = await updateChannelData();
			if (!latestMsg) return message.reply("❌ Could not fetch data from Telegram!");
			
			// Send message 1 (Stock), then message 2 (Last Seen)
			sendUpdates(api, threadID, latestMsg, event.participantIDs || []);
			return;
		}

		message.reply("❌ Commands: on, off, now");
	}
};

async function fetchChannelHistory() {
	try {
		const res = await axios.get(`https://t.me/s/${TELEGRAM_CHANNEL}`, {
			headers: { "User-Agent": "Mozilla/5.0" },
			timeout: 15000
		});

		const html = res.data;
		const messages = [];
		const msgRegex = /data-post="([^"]+)"[\s\S]*?<div class="[^"]*js-message_text[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<time datetime="([^"]+)"/g;

		let match;
		while ((match = msgRegex.exec(html)) !== null) {
			const postId = match[1];
			const id = parseInt(postId.split('/')[1]) || 0;
			const rawHtml = match[2];
			const timestamp = new Date(match[3]).getTime();

			let text = rawHtml
				.replace(/<br\s*\/?>/gi, '\n')
				.replace(/<[^>]+>/g, '')
				.replace(/`Copyright[\s\S]*?`/g, '')
				.replace(/@\w+/g, '')
				.replace(/&nbsp;/gi, ' ')
				.replace(/&gt;/gi, '>')
				.replace(/&lt;/gi, '<')
				.replace(/&#39;/gi, "'")
				.replace(/&#34;/gi, '"')
				.replace(/&amp;/gi, '&')
				.replace(/\u00A0/g, ' ')
				.replace(/\n{2,}/g, '\n')
				.trim();

			if (text) messages.push({ id, text, timestamp });
		}
        
		messages.sort((a, b) => a.id - b.id);
		return messages;
	} catch (e) {
		return [];
	}
}

async function updateChannelData() {
	const messages = await fetchChannelHistory();
	if (!messages || messages.length === 0) return null;

	let latestStock = null;
	let latestWeather = null;

	// Process all historical messages to build correct timestamps
	for (const msg of messages) {
		const upperText = msg.text.toUpperCase();
		
		if (upperText.includes('SHOP STOCK')) {
			latestStock = msg;
			updateLastSeenDB(msg.text, msg.timestamp, false);
		}
		
		if (upperText.includes('WEATHER')) {
			latestWeather = msg;
			updateLastSeenDB(msg.text, msg.timestamp, false);
		}
	}

	// Determine the absolute newest message in the channel
	const latest = (latestWeather && latestWeather.id > (latestStock?.id || 0)) ? latestWeather : latestStock;
	if (latest) {
		latest.type = latest.text.toUpperCase().includes('WEATHER') ? 'weather' : 'stock';
	}

	// Reset current items
	currentStockItems.clear();
	
	// Shop Stock items are ALWAYS added to current stock until the next Shop Stock
	if (latestStock) {
		updateLastSeenDB(latestStock.text, latestStock.timestamp, true);
	}
	
	// Weather is ONLY set to "Active" (added to current) IF it is the absolute newest message
	if (latestWeather) {
		const isWeatherActive = (latest && latestWeather.id === latest.id);
		updateLastSeenDB(latestWeather.text, latestWeather.timestamp, isWeatherActive);
	}

	return latest;
}

function updateLastSeenDB(text, timestamp, addToCurrent = false) {
	const lines = text.split('\n');
	let currentCategory = null;

	// Set category explicitly if the message is a Weather update
	const upperText = text.toUpperCase();
	if (upperText.includes('WEATHER')) {
		currentCategory = 'Moon & Weather 🌙';
	}

	for (const line of lines) {
		const upperLine = line.toUpperCase();
		
		if (upperLine.includes('SEED SHOP')) currentCategory = 'Seed 🌱';
		else if (upperLine.includes('GEAR SHOP')) currentCategory = 'Gear ⚙️';
		else if (upperLine.includes('CRATE SHOP')) currentCategory = 'Crate 📦';
		else if (upperLine.includes('MOON') || upperLine.includes('EVENT') || upperLine.includes('WEATHER')) {
			currentCategory = 'Moon & Weather 🌙';
		}
		else if (currentCategory) {
			let itemName = "";
			
			// --- FIX: Stronger Moon & Weather detection ---
			if (currentCategory === 'Moon & Weather 🌙') {
				for (const knownItem of ALL_GAME_ITEMS[currentCategory]) {
					// Removes spaces/dashes to catch variations like "Blood Moon", "Bloodmoon", etc.
					const normalizedLine = line.toLowerCase().replace(/[\s-]/g, '');
					const normalizedKnown = knownItem.toLowerCase().replace(/[\s-]/g, '');
					if (normalizedLine.includes(normalizedKnown)) {
						itemName = knownItem;
						break;
					}
				}
			} else {
				// Normal Shop detection
				if (line.includes(':')) {
					itemName = line.split(':')[0].replace(/^[^a-zA-Z0-9]+/, '').replace(/^[✅❌🕒]\s*/, '').trim();
				} else {
					for (const knownItem of ALL_GAME_ITEMS[currentCategory]) {
						if (line.toLowerCase().includes(knownItem.toLowerCase())) {
							itemName = knownItem;
							break;
						}
					}
				}
			}

			if (itemName && lastSeenDB[currentCategory] !== undefined) {
				if (lastSeenDB[currentCategory][itemName] === undefined) {
					lastSeenDB[currentCategory][itemName] = 0; 
				}
				
				lastSeenDB[currentCategory][itemName] = Math.max(lastSeenDB[currentCategory][itemName], timestamp);
				
				if (addToCurrent) {
					currentStockItems.add(itemName);
				}
			}
		}
	}
}

function getTimeAgo(ms) {
	if (ms <= 0) return "Never Seen";
	
	const min = Math.floor(ms / 60000);
	if (min < 1) return "Just now";
	
	const hr = Math.floor(min / 60);
	const days = Math.floor(hr / 24);
	const weeks = Math.floor(days / 7);
	const months = Math.floor(days / 30);
	const years = Math.floor(days / 365);
	
	if (years > 0) return `${years} Year${years !== 1 ? 's' : ''} ago`;
	if (months > 0) return `${months} Month${months !== 1 ? 's' : ''} ago`;
	if (weeks > 0) return `${weeks} Week${weeks !== 1 ? 's' : ''} ago`;
	if (days > 0) return `${days} Day${days !== 1 ? 's' : ''} ago`;
	
	if (hr > 0) {
		const remMin = min % 60;
		return `${hr} Hour${hr !== 1 ? 's' : ''}${remMin > 0 ? ` ${remMin} Minute${remMin !== 1 ? 's' : ''}` : ''} ago`;
	}
	return `${min} Minute${min !== 1 ? 's' : ''} ago`;
}

function getAlerts(text) {
	if (!text) return "";
	const alerts = [];
	const lines = text.split('\n');

	for (const line of lines) {
		if (!line.includes(':')) continue;
		let realItemName = line.split(':')[0].replace(/^[^a-zA-Z0-9]+/, '').trim();

		for (const item of TARGET_ITEMS) {
			if (realItemName.toLowerCase() === item.toLowerCase()) {
				const qtyMatch = line.match(/:\s*x?(\d+)/i);
				const pcs = qtyMatch ? qtyMatch[1] + "x" : "1x";
				alerts.push(`${pcs} ${realItemName} on Stock!`);
				break;
			}
		}
	}
	const uniqueAlerts = [...new Set(alerts)];
	return uniqueAlerts.length > 0 ? "@everyone\n" + uniqueAlerts.join('\n') + '\n\n' : "";
}

function buildMentions(participantIDs) {
	let mentions = [];
	for (const uid of participantIDs) {
		mentions.push({ tag: "@everyone", id: uid });
	}
	return mentions;
}

function formatRawStockMsg(msg) {
	const lines = msg.text.split('\n').map(l => l.trim()).filter(l => l);
	let out = "";
	const isWeather = msg.type === 'weather';

	if (isWeather) {
		for (const line of lines) {
			const cleanLine = line.replace(/🌦️/g, '').trim();
			if (cleanLine && !cleanLine.match(/^\d+$/) && !cleanLine.includes('Copyright')) {
				out += cleanLine + '\n';
			}
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
	const time = new Date().toLocaleString("en-US", { timeZone: TZ });
	return out.trim() + '\n\n⏰ ' + time;
}

function buildLastSeenMessage() {
	let out = "🟢 LIVE STOCK & LAST SEEN 🟢\n";
	
	for (const [category, itemsList] of Object.entries(ALL_GAME_ITEMS)) {
		out += `\n【 ${category} 】\n`;
		for (const itemName of itemsList) {
			const timestamp = lastSeenDB[category][itemName];
			if (currentStockItems.has(itemName)) {
				if (category === "Moon & Weather 🌙") {
					out += `✅ ${itemName}: Active\n`;
				} else {
					out += `✅ ${itemName}: On Stock\n`;
				}
			} else if (timestamp === 0) {
				out += `❌ ${itemName}: Never Seen\n`;
			} else {
				out += `🕒 ${itemName}: ${getTimeAgo(Date.now() - timestamp)}\n`;
			}
		}
	}
	
	const time = new Date().toLocaleString("en-US", { timeZone: TZ });
	out += `\n⏰ Last Updated: ${time}`;
	return out.trim();
}

function sendUpdates(api, threadID, msg, participantIDs) {
	let msg1 = "";
	let hasAlerts = false;
	
	if (msg.type === 'stock') {
		const alerts = getAlerts(msg.text);
		if (alerts) {
			msg1 += alerts;
			hasAlerts = true;
		}
		msg1 += formatRawStockMsg(msg);
	} else if (msg.type === 'weather') {
		msg1 += "🌦️ WEATHER UPDATE 🌦️\n\n" + formatRawStockMsg(msg);
	}

	const msg2 = buildLastSeenMessage();
	const sendPayload = hasAlerts ? { body: msg1.trim(), mentions: buildMentions(participantIDs) } : msg1.trim();

	api.sendMessage(sendPayload, threadID, (err) => {
		if (!err) {
			api.sendMessage(msg2, threadID);
		} else {
			console.error("[TGStock] Error sending Message 1:", err);
		}
	});
}

function startPolling(api) {
	if (pollTimer) return;
	console.log("[TGStock] Started polling Telegram channel...");

	pollTimer = setInterval(async () => {
		const msg = await updateChannelData(); 
		if (msg) {
			const hash = JSON.stringify({ id: msg.id, type: msg.type });
			
			for (const [threadID, session] of activeSessions.entries()) {
				if (session.enabled) {
					const lastHash = lastSentHash.get(threadID);
					if (lastHash !== hash) {
						lastSentHash.set(threadID, hash);
						sendUpdates(api, threadID, msg, session.participantIDs || []);
					}
				}
			}
		}
	}, 10000);
}
