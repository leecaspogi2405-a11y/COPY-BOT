const axios = require('axios');

const TELEGRAM_CHANNEL = "growagardenlivestock";
const TZ = "Asia/Manila";
const LAST_SEEN_GROUP_LINK = "https://m.me/j/Abad8QInPFA48lRu/?send_source=gc%3Acopy_invite_link_t";

let pollTimer = null;
const activeStockSessions = new Map();
const lastSentHash = new Map();

// Notification Target Items (Strict Matching)
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
		name: "gag2",
		version: "7.0",
		author: "Dev Xdragon",
		role: 1,
		description: "Auto stock and event tracker",
		category: "stock",
		guide: "{pn} on - Enable stock\n{pn} off - Disable stock\n{pn} now - View stock"
	},

	onStart: async ({ message, event, args, api }) => {
		const body = args.join(" ").toLowerCase();
		const threadID = event.threadID;

		if (body === "on") {
			activeStockSessions.set(threadID, { enabled: true, participantIDs: event.participantIDs || [] });
			if (!pollTimer) startPolling(api);
			return message.reply("✅ Auto stock updates enabled for this group!");
		}

		if (body === "off") {
			activeStockSessions.delete(threadID);
			if (activeStockSessions.size === 0 && pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
			return message.reply("✅ Auto stock disabled!");
		}

		if (body === "now" || body === "") {
			const latestMsg = await fetchLatestMessage();
			if (!latestMsg) return message.reply("❌ Could not fetch data from Telegram!");
			
			sendStockGroupUpdate(api, threadID, latestMsg, event.participantIDs || []);
			return;
		}

		message.reply("❌ Commands: !gag2 on / off / now");
	}
};

async function fetchLatestMessage() {
	try {
		const res = await axios.get(`https://t.me/s/${TELEGRAM_CHANNEL}`, {
			headers: { "User-Agent": "Mozilla/5.0" },
			timeout: 15000
		});

		const html = res.data;
		const msgRegex = /<div class="tgme_widget_message[^>]+data-post="([^"]+)"[\s\S]*?<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>[\s\S]*?<time datetime="([^"]+)"/g;

		let match;
		const messages = [];

		while ((match = msgRegex.exec(html)) !== null) {
			const id = parseInt(match[1].split('/')[1]) || 0;
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

		if (messages.length === 0) return null;
		
		let latestStock = null;
		let latestWeather = null;

		for (const msg of messages) {
			const upperText = msg.text.toUpperCase();
			if (upperText.includes('SHOP STOCK')) latestStock = msg;
			else if (upperText.includes('WEATHER') || upperText.includes('MOON:') || upperText.includes('EVENT:')) latestWeather = msg;
		}

		const latest = (latestWeather && latestWeather.id > (latestStock?.id || 0)) ? latestWeather : latestStock;
		if (latest) {
			const upperText = latest.text.toUpperCase();
			latest.type = (upperText.includes('WEATHER') || upperText.includes('MOON:') || upperText.includes('EVENT:')) ? 'weather' : 'stock';
		}
		
		return latest;
	} catch (e) {
		console.error("[TGStock] Error:", e.message);
		return null;
	}
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
	console.log("[TGStock] Started 10-second polling for New Stocks...");

	pollTimer = setInterval(async () => {
		const msg = await fetchLatestMessage(); 
		if (msg) {
			const hash = JSON.stringify({ id: msg.id, type: msg.type });
			
			for (const [threadID, session] of activeStockSessions.entries()) {
				if (session.enabled) {
					const lastHash = lastSentHash.get(threadID);
					if (lastHash !== hash) {
						lastSentHash.set(threadID, hash);
						sendStockGroupUpdate(api, threadID, msg, session.participantIDs || []);
					}
				}
			}
		}
	}, 10000);
}
