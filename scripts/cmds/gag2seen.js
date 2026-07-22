const axios = require('axios');

const TELEGRAM_CHANNEL = "growagardenlivestock";
const TZ = "Asia/Manila";
let seenTimer = null; 

const activeSeenSessions = new Map();

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

module.exports = {
	config: {
		name: "gag2seen",
		version: "7.0",
		author: "Dev Xdragon",
		role: 1,
		description: "Last seen tracker dashboard",
		category: "stock",
		guide: "{pn} on - Enable 5-min last seen\n{pn} off - Disable last seen\n{pn} - View live last seen"
	},

	onStart: async ({ message, event, args, api }) => {
		const body = args.join(" ").toLowerCase();
		const threadID = event.threadID;

		if (!isDatabaseInitialized) {
			await updateChannelData(true); 
			isDatabaseInitialized = true;
		}

		if (body === "on") {
			activeSeenSessions.set(threadID, { enabled: true });
			if (!seenTimer) startSeenTimer(api);
			return message.reply("✅ Last Seen dashboard will now be sent every 5 minutes here!");
		}
		if (body === "off") {
			activeSeenSessions.delete(threadID);
			if (activeSeenSessions.size === 0 && seenTimer) {
				clearInterval(seenTimer);
				seenTimer = null;
			}
			return message.reply("✅ Last Seen 5-minute loop disabled!");
		}
		if (body === "now" || body === "") {
			await updateChannelData(false);
			return message.reply(buildLastSeenMessage());
		}

		message.reply("❌ Commands: !gag2seen on / off / now");
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

	currentStockItems.clear();
	
	if (latestStock) {
		updateLastSeenDB(latestStock.text, latestStock.timestamp, true);
	}
	
	if (latestWeather) {
		const latest = (latestWeather.id > (latestStock?.id || 0)) ? latestWeather : latestStock;
		const isWeatherActive = (latest && latestWeather.id === latest.id);
		updateLastSeenDB(latestWeather.text, latestWeather.timestamp, isWeatherActive);
	}
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

function startSeenTimer(api) {
	if (seenTimer) return;
	console.log("[TGStock] Started 5-minute Last Seen timer...");

	seenTimer = setInterval(async () => {
		if (activeSeenSessions.size === 0) {
			clearInterval(seenTimer);
			seenTimer = null;
			return;
		}

		await updateChannelData(false);
		const msg = buildLastSeenMessage();

		for (const [threadID, session] of activeSeenSessions.entries()) {
			if (session.enabled) {
				api.sendMessage(msg, threadID);
			}
		}
	}, 5 * 60 * 1000); 
}
