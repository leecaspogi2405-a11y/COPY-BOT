const axios = require('axios');

const TELEGRAM_CHANNEL = "growagardenlivestock";
const TZ = "Asia/Manila";
let pollTimer = null;

const activeSessions = new Map();
const lastSentHash = new Map();

// Exactly ordered as the real game's shop lineup
const ALL_GAME_ITEMS = {
	"Seed 🌱": [
		"Carrot", "Strawberry", "Blueberry", "Tulip", "Tomato", "Bamboo", "Corn", "Banana", 
		"Cactus", "Grape", "Pineapple", "Mushroom", "Apple", "Dragon's Breath", "Venum Spitter", 
		"Star Fruit", "Moon Bloom", "Hypno Bloom", "Sun Bloom", "Poison Apple", "Cherry", "Fire Fern"
	],
	"Gear ⚙️": [
		"Common Watering Can", "Trowel", "Common Sprinkler", "Rare Sprinkler", "Super Watering Can", 
		"Super Sprinkler", "Legendary Sprinkler", "Gnome", "Shrink Mushroom", "Invisible Mushroom", 
		"Jump Mushroom", "Speed Mushroom", "Basic Pot", "Strawberry Sniper"
	],
	"Crate 📦": [
		"Bench Crate", "Bridge Crate", "Seesaw Crate", "Sign Crate", "Ladder Crate", "Light Crate", 
		"Owner Door Crate", "Roleplay Crate", "Spring Crate", "Teleporter Pad Crate", "Fence Crate"
	],
	"Moon & Event 🌙": [
		"Gold Moon", "Blood Moon", "Sun Burst", "Rain", 
		"Rainbow", "Meteor Shower", "Snow", "Aurora"
	]
};

const lastSeenDB = {
	"Seed 🌱": {},
	"Gear ⚙️": {},
	"Crate 📦": {},
	"Moon & Event 🌙": {}
};

for (const [category, items] of Object.entries(ALL_GAME_ITEMS)) {
	for (const item of items) {
		lastSeenDB[category][item] = 0;
	}
}

let currentStockItems = new Set();
let isDatabaseInitialized = false;

const TARGET_ITEMS = [
	"Dragon's Breath", "Venum Spitter", "Star Fruit", "Moon Bloom", "Hypno Bloom", "Sun Bloom",
	"Super Watering Can", "Super Sprinkler", "Legendary Sprinkler", "Rare Sprinkler", "Poison Apple",
	"Mushroom", "Cherry", "Fire Fern", "Basic Pot", "Strawberry Sniper", "Owner Door Crate",
	"Teleporter Pad Crate", "Fence Crate"
];

module.exports = {
	config: {
		name: "gag2stock",
		version: "5.1",
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
			return message.reply("✅ Auto stock + Last Seen tracker enabled in this chat!");
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
			if (!latestMsg) return message.reply("❌ Could not fetch data!");
			
			const updateData = buildFullUpdate(latestMsg);
			return message.reply(updateData.hasAlerts ? 
				{ body: updateData.text, mentions: buildMentions(event.participantIDs || []) } : 
				updateData.text
			);
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
				.replace(/\n{3,}/g, '\n\n')
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

	for (const msg of messages) {
		if (msg.text.includes('SHOP STOCK')) {
			updateLastSeenDB(msg.text, msg.timestamp, false);
			latestStock = msg;
		}
		if (msg.text.includes('Weather')) latestWeather = msg;
	}

	if (latestStock) updateLastSeenDB(latestStock.text, latestStock.timestamp, true);

	const latest = latestWeather && latestWeather.id > (latestStock?.id || 0) ? latestWeather : latestStock;
	if (latest) latest.type = latest.text.includes('Weather') ? 'weather' : 'stock';

	return latest;
}

function updateLastSeenDB(text, timestamp, isLatest) {
	const lines = text.split('\n');
	let currentCategory = null;
	let tempStock = new Set();

	for (const line of lines) {
		if (line.includes('SEED SHOP')) currentCategory = 'Seed 🌱';
		else if (line.includes('GEAR SHOP')) currentCategory = 'Gear ⚙️';
		else if (line.includes('CRATE SHOP')) currentCategory = 'Crate 📦';
		else if (line.includes('MOON') || line.includes('EVENT')) currentCategory = 'Moon & Event 🌙';
		else if (line.includes(':') && currentCategory) {
			let itemName = line.split(':')[0].replace(/^[^a-zA-Z0-9]+/, '').replace(/^[🪴🌱⚙️📦🌿💧🚿🧙‍♂️💡🏛️🪑⚖️🪧🪜🚪🎭]+/, '').trim();
			if (itemName) {
				if (lastSeenDB[currentCategory][itemName] === undefined) lastSeenDB[currentCategory][itemName] = 0; 
				lastSeenDB[currentCategory][itemName] = timestamp;
				tempStock.add(itemName);
			}
		}
	}

	if (isLatest) currentStockItems = tempStock;
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

function buildFullUpdate(msg) {
	let out = "";
	let hasAlerts = false;
	const currentTime = new Date().toLocaleString("en-US", { timeZone: TZ });

	// 1. ADD ALERTS
	if (msg && msg.type === 'stock') {
		const alerts = getAlerts(msg.text);
		if (alerts) {
			out += alerts;
			hasAlerts = true;
		}
	} 

	// 2. ADD RAW STOCK MESSAGE EXACTLY AS IT IS
	if (msg) {
		if (msg.type === 'weather') {
			out += "🌦️ WEATHER UPDATE 🌦️\n";
		}
		
		const rawLines = msg.text.split('\n');
		for (const line of rawLines) {
			if (!line.includes('Copyright') && line.trim() !== '') {
				out += line + '\n';
			}
		}
		out += `\n⏰ ${currentTime}\n\n`;
	}

	// 3. ADD LIVE STOCK & LAST SEEN DASHBOARD
	out += "🟢 LIVE STOCK & LAST SEEN 🟢\n";
	
	for (const [category, itemsList] of Object.entries(ALL_GAME_ITEMS)) {
		out += `\n【 ${category} 】\n`;
		for (const itemName of itemsList) {
			const timestamp = lastSeenDB[category][itemName];
			if (currentStockItems.has(itemName)) {
				out += `✅ ${itemName}: On Stock\n`;
			} else if (timestamp === 0) {
				out += `❌ ${itemName}: Never Seen\n`;
			} else {
				out += `🕒 ${itemName}: ${getTimeAgo(Date.now() - timestamp)}\n`;
			}
		}
	}
	
	out += `\n⏰ Last Updated: ${currentTime}`;

	// Failsafe to protect Messenger 2000 character limit constraint
	if (out.length > 1999) {
		out = out.substring(0, 1995) + "...";
	}

	return { text: out.trim(), hasAlerts };
}

function getAlerts(text) {
	if (!text) return "";
	const alerts = [];
	const lines = text.split('\n');

	for (const line of lines) {
		if (!line.includes(':')) continue;
		let realItemName = line.split(':')[0].replace(/^[^a-zA-Z0-9]+/, '').replace(/^[🪴🌱⚙️📦🌿💧🚿🧙‍♂️💡🏛️🪑⚖️🪧🪜🚪🎭]+/, '').trim();

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
						
						const updateData = buildFullUpdate(msg);
						if (updateData.hasAlerts) {
							api.sendMessage({ body: updateData.text, mentions: buildMentions(session.participantIDs || []) }, threadID);
						} else {
							api.sendMessage(updateData.text, threadID);
						}
					}
				}
			}
		}
	}, 10000);
}
