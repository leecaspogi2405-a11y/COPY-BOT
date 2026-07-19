const axios = require('axios');

const TELEGRAM_CHANNEL = "growagardenlivestock";
const TZ = "Asia/Manila";
let pollTimer = null;
let seenEditTimer = null;

const activeSessions = new Map();
const lastSentHash = new Map();
const activeSeenMsgs = new Map();

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
		"Gold Moon", "Red Moon", "Blue Moon", "Blood Moon"
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

const TARGET_ITEMS = [
	"Dragon's Breath",
	"Venum Spitter",
	"Star Fruit",
	"Moon Bloom",
	"Hypno Bloom",
	"Sun Bloom",
	"Super Watering Can",
	"Super Sprinkler",
	"Legendary Sprinkler",
	"Rare Sprinkler",
	"Poison Apple",
	"Mushroom",
	"Cherry",
	"Fire Fern",
	"Basic Pot",
	"Strawberry Sniper",
	"Owner Door Crate",
	"Teleporter Pad Crate",
	"Fence Crate"
];

module.exports = {
	config: {
		name: "gag2stock",
		version: "2.5",
		author: "Dev Xdragon",
		role: 1,
		description: "Auto stock Grow A Garden from public Telegram channel",
		category: "stock",
		guide: "{pn} on - Enable auto stock\n{pn} off - Disable auto stock\n{pn} now - View current stock\n{pn} seen - View live last seen items"
	},

	onStart: async ({ message, event, args, api }) => {
		const body = args.join(" ").toLowerCase();
		const threadID = event.threadID;

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

		if (body === "now" || body === "") {
			const stockMsg = await fetchLatestMessage();
			if (!stockMsg) return message.reply("❌ Could not fetch stock!");
			
			let formatted = formatMessage(stockMsg);
			let hasAlerts = false;

			if (stockMsg.type === 'stock') {
				const alerts = getAlerts(stockMsg.text);
				if (alerts) {
					formatted = alerts + formatted;
					hasAlerts = true;
				}
			}
			
			if (hasAlerts) {
				const mentions = buildMentions(event.participantIDs || []);
				return message.reply({
					body: formatted,
					mentions: mentions
				});
			} else {
				return message.reply(formatted);
			}
		}

		if (body === "seen") {
			const stockMsg = await fetchLatestMessage();
			if (stockMsg && stockMsg.type === 'stock') {
				updateLastSeenDB(stockMsg.text);
			}
			
			const seenText = buildSeenMessage();
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

async function fetchLatestMessage() {
	try {
		const res = await axios.get(`https://t.me/s/${TELEGRAM_CHANNEL}`, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
			},
			timeout: 15000
		});

		const html = res.data;
		const messages = [];
		const msgRegex = /<div class="tgme_widget_message[^"]*"[^>]*data-post="([^"]+)"[\s\S]*?<div class="[^"]*js-message_text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;

		let match;
		while ((match = msgRegex.exec(html)) !== null) {
			const rawHtml = match[2];
			const postId = match[1];
			const id = parseInt(postId.split('/')[1]) || 0;

			if (!rawHtml || !rawHtml.trim()) continue;

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

			if (!text) continue;

			messages.push({ id, text });
		}

		if (messages.length === 0) return null;

		let latestStock = null;
		let latestWeather = null;
		let maxStockId = 0;
		let maxWeatherId = 0;

		for (const msg of messages) {
			if (msg.text.includes('SHOP STOCK') && msg.id > maxStockId) {
				maxStockId = msg.id;
				latestStock = msg;
			}
			if (msg.text.includes('Weather') && msg.id > maxWeatherId) {
				maxWeatherId = msg.id;
				latestWeather = msg;
			}
		}

		const latest = latestWeather && latestWeather.id > (latestStock?.id || 0)
			? latestWeather
			: latestStock;

		if (latest) {
			latest.type = latest.text.includes('Weather') ? 'weather' : 'stock';
		}

		return latest;
	} catch (e) {
		console.error("[TGStock] Error:", e.message);
		return null;
	}
}

function updateLastSeenDB(text) {
	const lines = text.split('\n');
	let currentCategory = null;
	let newStock = new Set();
	const now = Date.now();

	for (const line of lines) {
		if (line.includes('SEED SHOP')) currentCategory = 'Seed 🌱';
		else if (line.includes('GEAR SHOP')) currentCategory = 'Gear ⚙️';
		else if (line.includes('CRATE SHOP')) currentCategory = 'Crate 📦';
		else if (line.includes('MOON') || line.includes('EVENT')) currentCategory = 'Moon & Event 🌙';
		else if (line.includes(':') && currentCategory) {
			let itemName = line.split(':')[0].replace(/^[^a-zA-Z0-9]+/, '').trim();
			if (itemName) {
				newStock.add(itemName);
				lastSeenDB[currentCategory][itemName] = now;
			}
		}
	}
	currentStockItems = newStock;
}

function getTimeAgo(ms) {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec} Second ago`;
	
	const min = Math.floor(sec / 60);
	const hr = Math.floor(min / 60);
	const days = Math.floor(hr / 24);
	const weeks = Math.floor(days / 7);
	const months = Math.floor(days / 30);
	const years = Math.floor(days / 365);
	
	if (years > 0) return `${years} Year ago`;
	if (months > 0) return `${months} Month ago`;
	if (weeks > 0) return `${weeks} Week ago`;
	if (days > 0) return `${days} Day ago`;
	
	if (hr > 0) {
		const remMin = min % 60;
		return `${hr} Hour${remMin > 0 ? `,${remMin} Minute` : ''} ago`;
	}
	return `${min} Minute ago`;
}

function buildSeenMessage() {
	let out = "Last seen\n\n";
	
	for (const [category, items] of Object.entries(lastSeenDB)) {
		if (Object.keys(items).length === 0) continue;
		out += `${category}:\n`;
		
		for (const [itemName, timestamp] of Object.entries(items)) {
			if (currentStockItems.has(itemName)) {
				out += `${itemName}:On Stock\n`;
			} else if (timestamp === 0) {
				out += `${itemName}:Never Seen\n`;
			} else {
				out += `${itemName}:${getTimeAgo(Date.now() - timestamp)}\n`;
			}
		}
		out += "\n";
	}
	
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
			if (line && !line.match(/^\d+$/) && !line.includes('Copyright')) {
				out += line + '\n';
			}
		}
	} else {
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];

			if (line.includes('SHOP STOCK')) {
				out += `\n${line.trim()}\n`;
				continue;
			}

			if (line.startsWith('-') || line.startsWith('>')) {
				out += '  ' + line + '\n';
				continue;
			}

			if (line.match(/^[🪴🌱⚙️📦🌿]/)) {
				continue;
			}

			if (!line.includes('Copyright') && !line.startsWith('@')) {
				out += line + '\n';
			}
		}
	}

	out = out.trim();
	const time = new Date().toLocaleString("en-US", { timeZone: TZ });
	out += '\n\n⏰ ' + time;

	return out;
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
		mentions.push({
			tag: "@everyone",
			id: uid
		});
	}
	return mentions;
}

function startSeenEditor(api) {
	if (seenEditTimer) return;
	
	seenEditTimer = setInterval(() => {
		if (activeSeenMsgs.size === 0) {
			clearInterval(seenEditTimer);
			seenEditTimer = null;
			return;
		}

		const updatedText = buildSeenMessage();
		
		for (const [messageID, threadID] of activeSeenMsgs.entries()) {
			try {
				if (typeof api.editMessage === "function") {
					api.editMessage(updatedText, messageID, (err) => {
						if (err) activeSeenMsgs.delete(messageID);
					});
				}
			} catch (e) {
				activeSeenMsgs.delete(messageID);
			}
		}
	}, 15000); 
}

function startPolling(api) {
	if (pollTimer) return;
	console.log("[TGStock] Started polling Telegram channel...");

	pollTimer = setInterval(async () => {
		const msg = await fetchLatestMessage();
		if (msg) {
			const hash = JSON.stringify({ id: msg.id, type: msg.type });
			
			if (msg.type === 'stock') {
				const isNewMsg = hash !== lastSentHash.values().next().value;
				if (isNewMsg) {
					updateLastSeenDB(msg.text);
				}
			}
			
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
							const mentions = buildMentions(session.participantIDs || []);
							
							api.sendMessage({
								body: formatted,
								mentions: mentions
							}, threadID);
						} else {
							api.sendMessage(formatted, threadID);
						}
					}
				}
			}
		}
	}, 10000);
}
