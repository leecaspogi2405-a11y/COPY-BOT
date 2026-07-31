const axios = require('axios');

let LAST_SEEN_GROUP_LINK = "https://m.me/j/AbbDHWUmwMTwYDLt/?send_source=gc%3Acopy_invite_link_c";
let currentQrImageUrl = null;

const TELEGRAM_CHANNEL = "growagardenlivestock";
const TZ = "Asia/Manila";

let pollTimer = null;
const activeStockSessions = new Map();
const activeSeenSessions = new Map();
const lastSentHash = new Map();

const ALL_GAME_ITEMS = {
	"Seed 🌱": [
		"Carrot", "Strawberry", "Blueberry", "Tulip", "Tomato", "Baby Cactus", "Bamboo", "Corn", "Banana", 
		"Apple", "Grape", "Pineapple", "Horned Melon", "Sun Bloom", "Poison Apple", "Coconut", "Mango", 
		"Cactus", "Cherry", "Green Bean", "Acorn", "Venom Spitter", "Mushroom", "Glow Mushroom",
		"Dragon's Breath", "Star Fruit", "Moon Bloom", "Hypno Bloom", "Fire Fern", "Sunflower",
		"Dragon Fruit", "Poison Ivy", "Ghost Pepper", "Pomegranate", "Venus Fly Trap", "Eclipse Bloom"
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
		"Bear Trap Crate"
	],
	"Moon & Weather 🌙": [
		"Rainbowmoon", "Mega Moon", "Bloodmoon", "Goldmoon", "Sunburst", 
		"Snowfall", "Rainbow", "Aurora", "Rain", "Lightning"
	]
};

// Exact Tiers mapped directly from Wiki screenshots
const ITEM_TIERS = {
	"Blueberry": "Common", "Strawberry": "Common",
	"Apple": "Uncommon", "Tomato": "Uncommon", "Tulip": "Uncommon",
	"Baby Cactus": "Rare", "Bamboo": "Rare", "Cactus": "Rare", "Corn": "Rare", "Horned Melon": "Rare", "Pineapple": "Rare",
	"Banana": "Epic", "Coconut": "Epic", "Glow Mushroom": "Epic", "Grape": "Epic", "Mango": "Epic", "Mushroom": "Epic",
	"Acorn": "Legendary", "Cherry": "Legendary", "Dragon Fruit": "Legendary", "Fire Fern": "Legendary", "Poison Ivy": "Legendary", "Sunflower": "Legendary", "Rocket Pop": "Legendary",
	"Ghost Pepper": "Mythic", "Poison Apple": "Mythic", "Pomegranate": "Mythic", "Venom Spitter": "Mythic", "Venus Fly Trap": "Mythic", "Atlantic Giant Pumpkin": "Mythic",
	"Dragon's Breath": "Super", "Hypno Bloom": "Super", "Moon Bloom": "Super", "Sun Bloom": "Super", "Star Fruit": "Super",
	"Eclipse Bloom": "Secret", "Amber Cranberry": "Secret"
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
		name: "gag2stock",
		aliases: ["gag2seen", "qr"],
		version: "10.4",
		author: "Dev Xdragon",
		role: 1,
		description: "GAG2 Live Stock and Deep Last Seen Tracker",
		category: "stock",
		guide: "!gag2stock on/off/now\n!gag2seen on/off/now\n!qr insert"
	},

	onStart: async ({ message, event, args, api }) => {
		const fullText = event.body ? event.body.trim() : "";
		const cmdUsed = fullText.split(/\s+/)[0].toLowerCase().replace(/^[!./#]/, '');
		const action = args.join(" ").toLowerCase().trim();
		const threadID = event.threadID;

		if (!isDatabaseInitialized) {
			await updateChannelData(true); 
			isDatabaseInitialized = true;
		}

		// 1. COMMAND: !qr insert
		if (cmdUsed === "qr") {
			if (action === "insert") {
				if (!event.messageReply) {
					return message.reply("❌ Reply to an image or link with '!qr insert'");
				}

				const reply = event.messageReply;
				let isUpdated = false;
				let statusMsg = "✅ GAG2 CONFIG UPDATED\n━━━━━━━━━━━━━━━━━━━━\n";

				if (reply.attachments && reply.attachments.length > 0) {
					const imgAtt = reply.attachments.find(a => a.type === 'photo' || a.type === 'image' || a.url);
					if (imgAtt) {
						currentQrImageUrl = imgAtt.url;
						isUpdated = true;
						statusMsg += "🖼️ QR Image Attached!\n";
					}
				}

				if (reply.body) {
					const urlMatch = reply.body.match(/https?:\/\/[^\s]+/i);
					if (urlMatch) {
						LAST_SEEN_GROUP_LINK = urlMatch[0];
						isUpdated = true;
						statusMsg += `🔗 Group Link: ${LAST_SEEN_GROUP_LINK}\n`;
					}
				}

				if (!isUpdated) {
					return message.reply("❌ Walang nahanap na valid image o link sa nireplyan mo.");
				}

				let payload = { body: statusMsg.trim() };
				if (currentQrImageUrl) {
					try {
						payload.attachment = (await axios.get(currentQrImageUrl, { responseType: 'stream' })).data;
					} catch (e) {
						console.error("[TGStock] Error attaching preview QR image:", e.message);
					}
				}
				return api.sendMessage(payload, threadID);
			}

			return message.reply("❌ Usage: !qr insert (Reply to image or link)");
		}

		// 2. COMMAND: !gag2seen
		if (cmdUsed === "gag2seen") {
			if (action === "on") {
				activeSeenSessions.set(threadID, { enabled: true });
				if (!pollTimer) startPolling(api);
				return message.reply("🟢 Last Seen tracker enabled!");
			}

			if (action === "off") {
				activeSeenSessions.delete(threadID);
				if (activeStockSessions.size === 0 && activeSeenSessions.size === 0 && pollTimer) {
					clearInterval(pollTimer);
					pollTimer = null;
				}
				return message.reply("🔴 Last Seen tracker disabled!");
			}

			if (action === "now" || action === "") {
				await updateChannelData(false);
				return sendLastSeenMessage(api, threadID);
			}

			return message.reply("❌ Commands:\n!gag2seen on\n!gag2seen off\n!gag2seen now");
		}

		// 3. COMMAND: !gag2stock
		if (cmdUsed === "gag2stock") {
			if (action === "on") {
				activeStockSessions.set(threadID, { enabled: true, participantIDs: event.participantIDs || [] });
				if (!pollTimer) startPolling(api);
				return message.reply("🟢 Live Stock updates enabled!");
			}

			if (action === "off") {
				activeStockSessions.delete(threadID);
				if (activeStockSessions.size === 0 && activeSeenSessions.size === 0 && pollTimer) {
					clearInterval(pollTimer);
					pollTimer = null;
				}
				return message.reply("🔴 Live Stock updates disabled!");
			}

			if (action === "now" || action === "") {
				const latestMsg = await updateChannelData(false);
				if (!latestMsg) return message.reply("❌ Could not fetch data from Telegram!");
				
				await sendStockGroupUpdate(api, threadID, latestMsg, event.participantIDs || []);
				return;
			}

			return message.reply("❌ Commands:\n!gag2stock on/off/now\n!gag2seen on/off/now\n!qr insert");
		}
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
	// Deep Readback: 500 pages (~10,000 messages) para kayang ma-cover ang buong nakalipas na taon
	const pagesToFetch = isInit ? 500 : 1; 
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
			
			for (const knownItem of ALL_GAME_ITEMS[currentCategory]) {
				const normalizedLine = line.toLowerCase().replace(/[^a-z0-9]/g, '');
				const normalizedKnown = knownItem.toLowerCase().replace(/[^a-z0-9]/g, '');
				if (normalizedLine.includes(normalizedKnown)) {
					itemName = knownItem;
					break;
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

// FORMATTED DATE: Kasama na ang YEAR (Mon DD, YYYY HH:MM AM/PM)
function formatExactDate(ms) {
	if (ms <= 0) return "Never";
	const d = new Date(ms);
	return d.toLocaleString("en-US", { 
		timeZone: TZ, 
		month: "short", 
		day: "numeric", 
		year: "numeric",
		hour: "numeric", 
		minute: "2-digit", 
		hour12: true 
	}).replace(',', '');
}

function getAlerts(msg) {
	if (!msg || !msg.text) return "";
	const alerts = [];
	const lines = msg.text.split('\n');

	for (const line of lines) {
		const trimmedLine = line.trim();
		const upperLine = trimmedLine.toUpperCase();
		const isWeatherLine = msg.type === 'weather' || upperLine.includes('MOON:') || upperLine.includes('EVENT:');

		if (isWeatherLine) {
			for (const item of ALL_GAME_ITEMS["Moon & Weather 🌙"]) {
				const normalizedTarget = item.toLowerCase().replace(/[\s-]/g, '');
				const normalizedLine = trimmedLine.toLowerCase().replace(/[\s-]/g, '');

				if (normalizedLine.includes(normalizedTarget)) {
					alerts.push(`⚠️ ACTIVE EVENT/WEATHER: ${item.toUpperCase()}!`);
					break; 
				}
			}
		} else if (trimmedLine.startsWith('>')) {
			const leftSide = trimmedLine.split(':')[0].trim();
			const nameMatch = leftSide.match(/^>\s*([^a-zA-Z0-9]*)(.*)/);
			let emoji = '📦';
			let itemName = leftSide.substring(1).trim();
			
			if (nameMatch) {
				emoji = nameMatch[1].trim() || '📦';
				itemName = nameMatch[2].trim();
			}

			const qtyMatch = trimmedLine.match(/:\s*x?(\d+)/i);
			const pcs = qtyMatch ? qtyMatch[1] + "x" : "1x";
			
			// Match exact tier from Wiki map
			let detectedTier = ITEM_TIERS[itemName] || "RARE";
			alerts.push(`🚨 [${detectedTier.toUpperCase()} DROP]: ${emoji} ${pcs} ${itemName} IN STOCK!`);
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
	const time = new Date().toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
	
	let formatted = "📦 GAG2 STOCK LIVE 📦\n";
	formatted += "━━━━━━━━━━━━━━━━━━━━\n\n";
	formatted += out.trim();
	formatted += `\n\n⏰ Date & time: ${time}`;
	formatted += `\n\n🌐 Join here to join at gag2 last seen group!\n${LAST_SEEN_GROUP_LINK}`;
	formatted += `\n\nCopyright ©️ Gag2 ~ Dev Xdragon`;
	return formatted;
}

function buildLastSeenMessage() {
	let out = "📊 GAG2 LAST SEEN TRACKER 📊\n━━━━━━━━━━━━━━━━━━━━\n";

	for (const [category, itemsList] of Object.entries(ALL_GAME_ITEMS)) {
		out += `\n[ ${category} ]\n`;
		
		for (const itemName of itemsList) {
			const timestamp = lastSeenDB[category]?.[itemName] || 0;
			
			if (currentStockItems.has(itemName)) {
				out += `🟢 ${itemName}: NOW\n`; 
			} else if (timestamp === 0) {
				out += `❌ ${itemName}: Never\n`; 
			} else {
				const exact = formatExactDate(timestamp);
				out += `🕒 ${itemName}: ${exact}\n`; 
			}
		}
	}

	const time = new Date().toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
	out += `\n━━━━━━━━━━━━━━━━━━━━\n⏰ Date & time: ${time}\nCopyright ©️ Gag2 ~ Dev Xdragon`;
	return out.trim();
}

async function sendLastSeenMessage(api, threadID) {
	await api.sendMessage(buildLastSeenMessage(), threadID);
}

async function sendStockGroupUpdate(api, threadID, msg, participantIDs) {
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

	let payload = { body: msgBody.trim() };
	if (hasAlerts) {
		payload.mentions = buildMentions(participantIDs);
	}

	if (currentQrImageUrl) {
		try {
			payload.attachment = (await axios.get(currentQrImageUrl, { responseType: 'stream' })).data;
		} catch (e) {
			console.error("[TGStock] Error attaching QR image to stock update:", e.message);
		}
	}

	api.sendMessage(payload, threadID);
}

function startPolling(api) {
	if (pollTimer) return;
	console.log("[TGStock] Started polling for updates...");

	pollTimer = setInterval(async () => {
		const msg = await updateChannelData(false); 
		if (msg) {
			const hash = JSON.stringify({ id: msg.id, type: msg.type });
			
			for (const [threadID, session] of activeStockSessions.entries()) {
				if (session.enabled) {
					const lastHash = lastSentHash.get(`stock_${threadID}`);
					if (lastHash !== hash) {
						lastSentHash.set(`stock_${threadID}`, hash);
						sendStockGroupUpdate(api, threadID, msg, session.participantIDs || []);
					}
				}
			}

			for (const [threadID, session] of activeSeenSessions.entries()) {
				if (session.enabled) {
					const lastHash = lastSentHash.get(`seen_${threadID}`);
					if (lastHash !== hash) {
						lastSentHash.set(`seen_${threadID}`, hash);
						sendLastSeenMessage(api, threadID);
					}
				}
			}
		}
	}, 10000);
}
