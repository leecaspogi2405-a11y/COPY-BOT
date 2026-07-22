const axios = require('axios');

const TELEGRAM_CHANNEL = "growagardenlivestock";
const TZ = "Asia/Manila";
const LAST_SEEN_GROUP_LINK = "https://m.me/j/Abad8QInPFA48lRu/?send_source=gc%3Acopy_invite_link_t";

let pollTimer = null;
const activeStockSessions = new Map();
const activeSeenSessions = new Map();
const lastSentHash = new Map();

const ALL_GAME_ITEMS = {
	"Seed 🌱": [
		"Carrot", "Strawberry", "Blueberry", "Tulip", "Tomato", "Bamboo", "Corn", "Banana", 
		"Apple", "Grape", "Pineapple", "Sun Bloom", "Poison Apple", "Coconut", "Mango", 
		"Cactus", "Cherry", "Green Bean", "Acorn", "Venom Spitter", "Mushroom", 
		"Dragon's Breath", "Star Fruit", "Moon Bloom", "Hypno Bloom", "Fire Fern", "Sunflower"
	],
	"Gear ⚙️": [
		"Common Watering Can", "Common Sprinkler", "Uncommon Sprinkler", "Jump Mushroom", 
		"Trowel", "Invisibility Mushroom", "Rare Sprinkler", "Shrink Mushroom", 
		"Speed Mushroom", "Gnome", "Super Watering Can", "Super Sprinkler", "Legendary Sprinkler", 
		"Basic Pot", "Strawberry Sniper"
	],
	"Crate 📦": [
		"Bench Crate", "Ladder Crate", "Light Crate", "Arch Crate", "Sign Crate", 
		"Owner Door Crate", "Spring Crate", "Bridge Crate", "Roleplay Crate", "Picture Frame Crate", 
		"Seesaw Crate", "Conveyor Crate", "Boombox Crate", "Teleporter Pad Crate", "Fence Crate",
		"Bear Trap Crate"
	],
	"Moon & Weather 🌙": [
		"Rainbowmoon", "Mega Moon", "Bloodmoon", "Goldmoon", "Sunburst", 
		"Snowfall", "Rainbow", "Meteor", "Aurora", "Rain", "Snow", "Lightning"
	]
};

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
	"Teleporter Pad Crate", "Fence Crate", "Bear Trap Crate", "Sunflower", "Bamboo",
	"Goldmoon", "Mega Moon", "Bloodmoon", "Aurora", "Rainbow", "Meteor", 
	"Rainbowmoon", "Sunburst", "Snowfall", "Lightning"
];

module.exports = {
	config: {
		name: "gag2stock",
		version: "8.0",
		author: "Dev Xdragon",
		role: 1,
		description: "Unified stock and synchronized last seen tracker",
		category: "stock",
		guide: "{pn} on - Enable stock updates here\n{pn} off - Disable stock updates\n{pn} seen on - Enable synchronized last seen updates here\n{pn} seen off - Disable last seen updates\n{pn} now - View stock\n{pn} seen - View last seen"
	},

	onStart: async ({ message, event, args, api }) => {
		const body = args.join(" ").toLowerCase();
		const threadID = event.threadID;

		if (!isDatabaseInitialized) {
			await updateChannelData(true); 
			isDatabaseInitialized = true;
		}

		if (body === "seen on") {
			activeSeenSessions.set(threadID, { enabled: true });
			if (!pollTimer) startPolling(api);
			return message.reply("✅ Synchronized Last Seen updates enabled for this group! It will now trigger instantly alongside gag2stock updates.");
		}

		if (body === "seen off") {
			activeSeenSessions.delete(threadID);
			if (activeStockSessions.size === 0 && activeSeenSessions.size === 0 && pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
			return message.reply("✅ Last Seen updates disabled for this group!");
		}

		if (body === "seen" || body === "seen now") {
			await updateChannelData(false);
			return message.reply(buildLastSeenMessage());
		}

		if (body === "on") {
			activeStockSessions.set(threadID, { enabled: true, participantIDs: event.participantIDs || [] });
			if (!pollTimer) startPolling(api);
			return message.reply("✅ Auto stock updates enabled for this group!");
		}

		if (body === "off") {
			activeStockSessions.delete(threadID);
			if (activeStockSessions.size === 0 && activeSeenSessions.size === 0 && pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
			return message.reply("✅ Auto stock disabled!");
		}

		if (body === "now" || body === "") {
			const latestMsg = await updateChannelData(false);
			if (!latestMsg) return message.reply("❌ Could not fetch data from Telegram!");
			
			sendStockGroupUpdate(api, threadID, latestMsg, event.participantIDs || []);
			return;
		}

		message.reply("❌ Commands:\n!gag2stock on / off / now\n!gag2stock seen on / seen off / seen");
	}
};

async function fetchChannelHistory(pages = 1) {
	const allMessages = [];
	let beforeId = null;

	for (let p = 0; p < pages; p++) {
		let url = `https://t.me/s/${TELEGRAM_CHANNEL}`;
		if (beforeId) url += `?before=${beforeId}`;

		try {
			const res = await axios.get(url, {
				headers: { "User-Agent": "Mozilla/5.0" },
				timeout: 15000
			});

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

				if (text) allMessages.push({ id, text, timestamp });
			}

			if (!foundAny) break;
			beforeId = lowestId;
		} catch (e) {
			console.error("[TGStock] Error fetching channel history:", e.message);
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
	if (latest) {
		const upperText = latest.text.toUpperCase();
		latest.type = (upperText.includes('WEATHER') || upperText.includes('MOON:') || upperText.includes('EVENT:')) ? 'weather' : 'stock';
	}

	currentStockItems.clear();
	
	if (latestStock) {
		updateLastSeenDB(latestStock.text, latestStock.timestamp, true);
	}
	
	if (latestWeather) {
		const isWeatherActive = (latest && latestWeather.id === latest.id);
		updateLastSeenDB(latestWeather.text, latestWeather.timestamp, isWeatherActive);
	}

	return latest;
}

function updateLastSeenDB(text, timestamp, addToCurrent = false) {
	const lines = text.split('\n');
	let currentCategory = null;
	const upperText = text.toUpperCase();

	if (upperText.includes('WEATHER') || upperText.includes('MOON:') || upperText.includes('EVENT:')) {
		currentCategory = 'Moon & Weather 🌙';
	}

	for (const line of lines) {
		const upperLine = line.toUpperCase();
		
		if (upperLine.includes('SEED SHOP')) currentCategory = 'Seed 🌱';
		else if (upperLine.includes('GEAR SHOP')) currentCategory = 'Gear ⚙️';
		else if (upperLine.includes('CRATE SHOP')) currentCategory = 'Crate 📦';
		else if (upperLine.includes('MOON:') || upperLine.includes('EVENT:') || upperLine.includes('WEATHER UPDATE')) {
			currentCategory = 'Moon & Weather 🌙';
		}
		else if (currentCategory) {
			let itemName = "";
			
			if (currentCategory === 'Moon & Weather 🌙') {
				for (const knownItem of ALL_GAME_ITEMS[currentCategory]) {
					const normalizedLine = line.toLowerCase().replace(/[\s-]/g, '');
					const normalizedKnown = knownItem.toLowerCase().replace(/[\s-]/g, '');
					if (normalizedLine.includes(normalizedKnown)) {
						itemName = knownItem;
						break;
					}
				}
			} else {
				if (line.includes(':')) {
					const rawName = line.split(':')[0].replace(/^[^a-zA-Z0-9]+/, '').trim();
					for (const knownItem of ALL_GAME_ITEMS[currentCategory]) {
						if (rawName.toLowerCase() === knownItem.toLowerCase()) {
							itemName = knownItem;
							break;
						}
					}
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

function formatExactDate(ms) {
	if (ms <= 0) return "";
	const d = new Date(ms);
	return d.toLocaleString("en-US", { timeZone: TZ, month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

function getTimeAgo(ms) {
	if (ms <= 0) return "Never Seen";
	
	const min = Math.floor(ms / 60000);
	if (min < 1) return "just now";
	
	const hr = Math.floor(min / 60);
	const days = Math.floor(hr / 24);
	const weeks = Math.floor(days / 7);
	const months = Math.floor(days / 30);
	const years = Math.floor(days / 365);
	
	if (years > 0) return `${years} year${years !== 1 ? 's' : ''} ago`;
	if (months > 0) return `${months} month${months !== 1 ? 's' : ''} ago`;
	if (weeks > 0) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
	if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
	
	if (hr > 0) {
		const remMin = min % 60;
		return `${hr} hour${hr !== 1 ? 's' : ''}${remMin > 0 ? ` ${remMin} minute${remMin !== 1 ? 's' : ''}` : ''} ago`;
	}
	return `${min} minute${min !== 1 ? 's' : ''} ago`;
}

function getAlerts(msg) {
	if (!msg || !msg.text) return "";
	const alerts = [];
	const lines = msg.text.split('\n');

	const sortedTargets = [...TARGET_ITEMS].sort((a, b) => b.length - a.length);

	for (const line of lines) {
		const upperLine = line.toUpperCase();
		const isWeatherLine = msg.type === 'weather' || upperLine.includes('MOON:') || upperLine.includes('EVENT:');
		
		if (!line.includes(':') && !isWeatherLine) continue;

		if (isWeatherLine) {
			for (const item of sortedTargets) {
				const normalizedTarget = item.toLowerCase().replace(/[\s-]/g, '');
				const normalizedLine = line.toLowerCase().replace(/[\s-]/g, '');

				if (normalizedLine.includes(normalizedTarget)) {
					alerts.push(`⚠️ Active Event/Weather: ${item}!`);
					break; 
				}
			}
		} else if (line.includes(':')) {
			const leftSide = line.split(':')[0].trim();
			
			const emojiMatch = leftSide.match(/^[^a-zA-Z0-9]+/);
			let originalEmoji = emojiMatch ? emojiMatch[0].replace(/[->]/g, '').trim() : '';
			if (!originalEmoji) originalEmoji = '📦';
			
			const cleanName = leftSide.replace(/^[^a-zA-Z0-9]+/, '').trim();
			
			for (const item of sortedTargets) {
				if (cleanName.toLowerCase() === item.toLowerCase()) {
					const qtyMatch = line.match(/:\s*x?(\d+)/i);
					const pcs = qtyMatch ? qtyMatch[1] + "x" : "1x";
					alerts.push(`${originalEmoji} ${pcs} ${item} on Stock!`);
					break;
				}
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
	out = out.trim() + '\n\n⏰ ' + time;
	
	out += `\n\n(Join at this group to see last seen stocks!)👇\n${LAST_SEEN_GROUP_LINK}`;
	return out;
}

function buildLastSeenMessage() {
	let out = "🟢 LIVE STOCK & LAST SEEN 🟢\n";
	
	for (const [category, itemsList] of Object.entries(ALL_GAME_ITEMS)) {
		out += `\n【 ${category} 】\n\n`;
		
		for (const itemName of itemsList) {
			const timestamp = lastSeenDB[category][itemName];
			
			if (currentStockItems.has(itemName)) {
				if (category === "Moon & Weather 🌙") {
					out += `✅ ${itemName}: Active\n\n`; 
				} else {
					out += `✅ ${itemName}: On Stock\n\n`; 
				}
			} else if (timestamp === 0) {
				out += `❌ ${itemName}: Never Seen\n\n`; 
			} else {
				const exactDateText = formatExactDate(timestamp);
				out += `🕒 ${itemName}: ${getTimeAgo(Date.now() - timestamp)} (${exactDateText})\n\n`; 
			}
		}
	}
	
	const time = new Date().toLocaleString("en-US", { timeZone: TZ });
	out += `⏰ Last Updated: ${time}`;
	return out.trim();
}

function sendStockGroupUpdate(api, threadID, msg, participantIDs) {
	let msgBody = "";
	let hasAlerts = false;
	
	const alerts = getAlerts(msg);
	if (alerts) {
		msgBody += alerts;
		hasAlerts = true;
	}

	if (msg.type === 'stock') {
		msgBody += formatRawStockMsg(msg);
	} else if (msg.type === 'weather') {
		msgBody += "🌦️ WEATHER UPDATE 🌦️\n\n" + formatRawStockMsg(msg);
	}

	const sendPayload = hasAlerts ? { body: msgBody.trim(), mentions: buildMentions(participantIDs) } : msgBody.trim();
	api.sendMessage(sendPayload, threadID);
}

function startPolling(api) {
	if (pollTimer) return;
	console.log("[TGStock] Started polling for synchronized updates...");

	pollTimer = setInterval(async () => {
		const msg = await updateChannelData(false); 
		if (msg) {
			const hash = JSON.stringify({ id: msg.id, type: msg.type });
			
			// 1. Send Stock updates to Stock Groups immediately when new message arrives
			for (const [threadID, session] of activeStockSessions.entries()) {
				if (session.enabled) {
					const lastHash = lastSentHash.get(`stock_${threadID}`);
					if (lastHash !== hash) {
						lastSentHash.set(`stock_${threadID}`, hash);
						sendStockGroupUpdate(api, threadID, msg, session.participantIDs || []);
					}
				}
			}

			// 2. Send Last Seen dashboard updates to Last Seen Groups INSTANTLY alongside the stock update
			for (const [threadID, session] of activeSeenSessions.entries()) {
				if (session.enabled) {
					const lastHash = lastSentHash.get(`seen_${threadID}`);
					if (lastHash !== hash) {
						lastSentHash.set(`seen_${threadID}`, hash);
						api.sendMessage(buildLastSeenMessage(), threadID);
					}
				}
			}
		}
	}, 10000);
}
