const axios = require('axios');

const TELEGRAM_CHANNEL = "growagardenlivestock";
const TZ = "Asia/Manila";
let pollTimer = null;
let seenEditTimer = null;

const activeSessions = new Map();
const lastSentHash = new Map();
const activeSeenMsgs = new Map();

// Added all missing Moon & Event items (Sun Burst, Rain, Rainbow, etc.)
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
		"Gold Moon", "Red Moon", "Blue Moon", "Blood Moon",
		"Sun Burst", "Rain", "Rainbow", "Meteor Shower", "Snow"
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
		version: "3.0",
		author: "Dev Xdragon",
		role: 1,
		description: "Auto stock Grow A Garden from public Telegram channel",
		category: "stock",
		guide: "{pn} on - Enable auto stock\n{pn} off - Disable auto stock\n{pn} now - View latest raw stock msg\n{pn} seen - View combined live stock and last seen dashboard"
	},

	onStart: async ({ message, event, args, api }) => {
		const body = args.join(" ").toLowerCase();
		const threadID = event.threadID;

		// Initialize historical data on first command run if not yet done
		if (!isDatabaseInitialized) {
			await updateChannelData();
			isDatabaseInitialized = true;
		}

		if (body === "on") {
			activeSessions.set(threadID, { enabled: true, participantIDs: event.participantIDs || [] });
			if (!pollTimer) startPolling(api);
			return message.reply("✅ Auto stock from GAG2 enabled!");
		}

		if (body === "off") {
			activeSessions.delete(threadID);
			if (activeSessions.size === 0 && pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
			return message.reply("✅ Auto stock disabled!");
		}

		if (body === "now") {
			const latestMsg = await updateChannelData();
			if (!latestMsg) return message.reply("❌ Could not fetch stock data!");
			
			let formatted = formatMessage(latestMsg);
			let hasAlerts = false;

			if (latestMsg.type === 'stock') {
				const alerts = getAlerts(latestMsg.text);
				if (alerts) {
					formatted = alerts + formatted;
					hasAlerts = true;
				}
			}
			return message.reply(hasAlerts ? { body: formatted, mentions: buildMentions(event.participantIDs || []) } : formatted);
		}

		if (body === "seen" || body === "") {
			await updateChannelData(); // Ensure fresh data before showing
			const seenText = buildCombinedSeenMessage();
			
			api.sendMessage(seenText, threadID, (err, info) => {
				if (!err && info) {
					activeSeenMsgs.set(info.messageID, threadID);
					startSeenEditor(api);
				}
			});
			return;
		}

		message.reply("❌ Commands: on, off, now, seen");
	}
};

/**
 * Acts as the public API parser: 
 * Fetches the HTML page and extracts all historical messages to prevent starting from "Never Seen".
 */
async function fetchChannelHistory() {
	try {
		const res = await axios.get(`https://t.me/s/${TELEGRAM_CHANNEL}`, {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
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
			const datetime = match[3];
			const timestamp = new Date(datetime).getTime();

			let text = rawHtml
				.replace(/<br\s*\/?>/gi, '\n')
				.replace(/<[^>]+>/g, '')
				.replace(/`Copyright[\s\S]*?`/g, '')
				.replace(/@\w+/g, '')
				.replace(/&nbsp;/gi, ' ')
				.replace(/&gt;/gi, '>')
				.replace(/&lt;/gi, '<')
				.replace(/&#39;/gi, "'")
				.replace(/&#33;/gi, '!')
				.replace(/&#34;/gi, '"')
				.replace(/&#(\d+);/gi, (_, n) => String.fromCharCode(n))
				.replace(/&amp;/gi, '&')
				.replace(/\u00A0/g, ' ')
				.replace(/\n{3,}/g, '\n\n')
				.replace(/[ \t]+\n/g, '\n')
				.replace(/\n[ \t]+/g, '\n')
				.replace(/\d+\s*views?\s*\d*:\d*/gi, '')
				.trim();

			if (text) messages.push({ id, text, timestamp });
		}
        
		messages.sort((a, b) => a.id - b.id);
		return messages;
	} catch (e) {
		console.error("[TGStock] Error:", e.message);
		return [];
	}
}

/**
 * Updates DB and extracts current stock logically based on message history.
 */
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
		if (msg.text.includes('Weather')) {
			latestWeather = msg;
		}
	}

	if (latestStock) {
		updateLastSeenDB(latestStock.text, latestStock.timestamp, true);
	}

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
			let itemName = line.split(':')[0].replace(/^[^a-zA-Z0-9]+/, '').trim();
			if (itemName) {
				if (lastSeenDB[currentCategory][itemName] === undefined) {
					lastSeenDB[currentCategory][itemName] = 0; // Dynamic add if completely new
				}
				lastSeenDB[currentCategory][itemName] = timestamp;
				tempStock.add(itemName);
			}
		}
	}

	if (isLatest) {
		currentStockItems = tempStock;
	}
}

function getTimeAgo(ms) {
	if (ms <= 0) return "Never Seen";
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec} Second${sec !== 1 ? 's' : ''} ago`;
	
	const min = Math.floor(sec / 60);
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

/**
 * Combines both current stock and last seen into a single clean lineup.
 */
function buildCombinedSeenMessage() {
	let out = "🟢 LIVE STOCK & LAST SEEN 🟢\n\n";
	
	for (const [category, items] of Object.entries(lastSeenDB)) {
		if (Object.keys(items).length === 0) continue;
		out += `【 ${category} 】\n`;
		
		// Sort: On Stock at the top, then sorted by newest timestamp, never seen at the bottom.
		const sortedItems = Object.entries(items).sort((a, b) => {
			const aStock = currentStockItems.has(a[0]);
			const bStock = currentStockItems.has(b[0]);
			if (aStock && !bStock) return -1;
			if (!aStock && bStock) return 1;
			return b[1] - a[1];
		});

		for (const [itemName, timestamp] of sortedItems) {
			if (currentStockItems.has(itemName)) {
				out += `✅ ${itemName}: On Stock\n`;
			} else if (timestamp === 0) {
				out += `❌ ${itemName}: Never Seen\n`;
			} else {
				out += `🕒 ${itemName}: ${getTimeAgo(Date.now() - timestamp)}\n`;
			}
		}
		out += "\n";
	}
	
	const time = new Date().toLocaleString("en-US", { timeZone: TZ });
	out += `⏰ Last Updated: ${time}`;
	return out.trim();
}

function formatMessage(data) {
	if (!data) return "❌ No data available!";
	const lines = data.text.split('\n').map(l => l.trim()).filter(l => l);
	const isWeather = data.type === 'weather';
	let out = "";

	if (isWeather) {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].replace(/🌦️/g, '').trim();
			if (line && !line.match(/^\d+$/) && !line.includes('Copyright')) out += line + '\n';
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

function startSeenEditor(api) {
	if (seenEditTimer) return;
	
	// Edits the last seen dashboard live every 15 seconds
	seenEditTimer = setInterval(() => {
		if (activeSeenMsgs.size === 0) {
			clearInterval(seenEditTimer);
			seenEditTimer = null;
			return;
		}

		const updatedText = buildCombinedSeenMessage();
		
		for (const [messageID, threadID] of activeSeenMsgs.entries()) {
			try {
				if (typeof api.editMessage === "function") {
					api.editMessage(updatedText, messageID, (err) => {
						if (err && err.error === 'Message not found') activeSeenMsgs.delete(messageID);
					});
				}
			} catch (e) {
				// Safely ignore minor edit skips
			}
		}
	}, 15000); 
}

function startPolling(api) {
	if (pollTimer) return;
	console.log("[TGStock] Started polling Telegram channel...");

	pollTimer = setInterval(async () => {
		const msg = await updateChannelData(); // Will refresh stock silently in DB
		if (msg) {
			const hash = JSON.stringify({ id: msg.id, type: msg.type });
			
			for (const [threadID, session] of activeSessions.entries()) {
				if (session.enabled) {
					const lastHash = lastSentHash.get(threadID);
					if (lastHash !== hash) {
						lastSentHash.set(threadID, hash);
						
						let formatted = formatMessage(msg);
						let hasAlerts = false;

						if (msg.type === 'stock') {
							const alerts = getAlerts(msg.text);
							if (alerts) {
								formatted = alerts + formatted;
								hasAlerts = true;
							}
						}
						
						if (hasAlerts) {
							api.sendMessage({ body: formatted, mentions: buildMentions(session.participantIDs || []) }, threadID);
						} else {
							api.sendMessage(formatted, threadID);
						}
					}
				}
			}
		}
	}, 10000);
}
