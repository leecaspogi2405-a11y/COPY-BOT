/**
 * Command: eggpredict.js
 * Description: Automated Egg Spawn Predictor with !predict on/off toggle for GoatBot
 * Author: Dev Xdragon
 * Version: 3.0.0
 */

const RESET_PERIOD_SECONDS = 1800;

// Game Data Mapping
const DEFAULT_GAME_DATA = {
	Eggs: {
		"Ice Dragon": { D: "Snow Biome", R: "Eternal" },
		"Lava Dragon": { D: "Volcano Biome", R: "Eternal" },
		"El Maja": { D: "Abyss Ocean Biome", R: "Eternal" },
		"Mosasaurus": { D: "Prehistoric Biome", R: "Eternal" },
		"Unicorn": { D: "Cosmic Biome", R: "Divine" },
		"Kitsune": { D: "Blossom Biome", R: "Divine" },
		"Warden": { D: "Titan Temple Biome", R: "Secret" }
	},
	Areas: {
		"Enternal/Divine": {
			Slots: ["Slot1", "Slot2", "Slot3", "Slot4", "Slot5"],
			DT: [
				["Ice Dragon", 40],
				["Lava Dragon", 20],
				["El Maja", 20],
				["Mosasaurus", 10],
				["Unicorn", 10]
			]
		},
		"Secret/Event": {
			Slots: ["Slot1", "Slot2"],
			DT: [
				["Kitsune", 80],
				["Warden", 20]
			]
		}
	}
};

// Store active prediction timers per thread
const activePredictors = new Map();

class Predictor {
	constructor(data) {
		this.E = data.Eggs || {};
		this.A = data.Areas || {};
		this.areaDataCache = {};
	}

	getNightDurationSeconds() { return 10; }
	getPeriodStartsAt(p1) { return (p1 - 0) * RESET_PERIOD_SECONDS; }
	getPeriodIndex(p1) { return Math.max(Math.floor(p1 / RESET_PERIOD_SECONDS), 0); }
	getNextResetAt(p1) { return this.getPeriodStartsAt(this.getPeriodIndex(p1) + 1); }
	getTimeLeft(p1) { return Math.max(0, this.getNextResetAt(p1) - p1); }
	getNightStartsAt(p1) { return this.getNextResetAt(p1) - this.getNightDurationSeconds(); }
	isNight(p1) { return this.getTimeLeft(p1) <= this.getNightDurationSeconds(); }

	getActivePeriodIndex(p1) {
		const v1 = this.getPeriodIndex(p1);
		return this.isNight(p1) ? v1 + 1 : v1;
	}

	getSlotSeed(p1, p2, p3) {
		const str = `${p1}:${p2}:${p3}`;
		let hash = 2166136261;
		for (let i = 0; i < str.length; i++) {
			hash = Math.imul(hash ^ str.charCodeAt(i), 16777619);
		}
		hash = hash >>> 0;
		return hash <= 0 ? 1 : hash;
	}

	getEggFull(t, area = "Volcano", slot = "Slot1") {
		let areaData = this.areaDataCache[area];
		if (!areaData) {
			areaData = this.A[area];
			if (areaData && areaData.DT && areaData.DT.length > 0) {
				areaData.TotalWeight = areaData.DT.reduce((acc, entry) => acc + entry[1], 0);
			}
			this.areaDataCache[area] = areaData;
		}

		if (!areaData || !areaData.DT || areaData.DT.length === 0) {
			const first = Object.keys(this.E)[0];
			return first
				? { Name: first, Display: this.E[first].D, Rarity: this.E[first].R }
				: { Name: "Unknown", Display: "Unknown", Rarity: "Unknown" };
		}

		const activePeriod = this.getActivePeriodIndex(t);
		const seed = this.getSlotSeed(activePeriod, area, slot);
		const nightOffset = this.isNight(t) ? 1000 : 0;
		const roll = Math.abs(Math.sin(seed + nightOffset)) % 1;
		const total = areaData.TotalWeight;
		let cum = 0;

		for (const entry of areaData.DT) {
			cum += entry[1] / total;
			if (roll <= cum) {
				const egg = this.E[entry[0]];
				return { Name: entry[0], Display: egg ? egg.D : entry[0], Rarity: egg ? egg.R : "Unknown" };
			}
		}

		const first = areaData.DT[0];
		const egg = this.E[first[0]];
		return { Name: first[0], Display: egg ? egg.D : first[0], Rarity: egg ? egg.R : "Unknown" };
	}

	findEgg(eggName, area) {
		const now = Math.floor(Date.now() / 1000);
		const current = this.getPeriodIndex(now);
		const found = [];
		if (!this.E[eggName]) return found;

		const areaData = this.A[area];
		const slotsToCheck = areaData && areaData.Slots ? areaData.Slots : ["Slot1", "Slot2", "Slot3"];
		let i = 1;

		while (found.length === 0 && i <= 2000) {
			const p = current + i;
			const pStart = this.getPeriodStartsAt(p);
			const nightStart = this.getNightStartsAt(pStart);

			for (const slotName of slotsToCheck) {
				const dayEgg = this.getEggFull(pStart, area, slotName);
				if (dayEgg && dayEgg.Name === eggName) {
					found.push({
						Period: p,
						Phase: "Day",
						TimeAt: pStart,
						GMT: new Date(pStart * 1000).toISOString().replace("T", " ").replace(".000Z", ""),
						Display: dayEgg.Display,
						Rarity: dayEgg.Rarity,
						Area: area,
						Slot: slotName
					});
					break;
				}

				const nightEgg = this.getEggFull(nightStart, area, slotName);
				if (nightEgg && nightEgg.Name === eggName) {
					found.push({
						Period: p,
						Phase: "Night",
						TimeAt: nightStart,
						GMT: new Date(nightStart * 1000).toISOString().replace("T", " ").replace(".000Z", ""),
						Display: nightEgg.Display,
						Rarity: nightEgg.Rarity,
						Area: area,
						Slot: slotName
					});
					break;
				}
			}
			i++;
		}
		return found;
	}

	predictSingleEgg(eggName) {
		const egg = this.E[eggName];
		if (!egg) return null;

		const availableAreas = [];
		for (const [areaKey, areaData] of Object.entries(this.A)) {
			if (areaData && areaData.DT) {
				for (const entry of areaData.DT) {
					if (entry[0] === eggName) {
						availableAreas.push(areaKey);
						break;
					}
				}
			}
		}

		let earliestPrediction = null;
		for (const searchArea of availableAreas) {
			const prediction = this.findEgg(eggName, searchArea);
			if (prediction.length > 0) {
				if (!earliestPrediction || prediction[0].TimeAt < earliestPrediction.TimeAt) {
					earliestPrediction = prediction[0];
				}
			}
		}

		return {
			eggKey: eggName,
			displayName: egg.D,
			rarity: egg.R,
			availableAreas: availableAreas,
			nextSpawn: earliestPrediction
				? `${earliestPrediction.GMT} (${earliestPrediction.Phase}) @ ${earliestPrediction.Area} [${earliestPrediction.Slot}]`
				: "No prediction found",
			rawPrediction: earliestPrediction
		};
	}
}

function sendBroadcast(api, threadID) {
	const predictor = new Predictor(DEFAULT_GAME_DATA);
	const allEggs = Object.keys(DEFAULT_GAME_DATA.Eggs);

	let response = `🔮 **AUTOMATED EGG PREDICTIONS (By Dev Xdragon)** 🔮\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

	for (const eggKey of allEggs) {
		const res = predictor.predictSingleEgg(eggKey);
		if (res) {
			response += `🥚 **${eggKey}** (${res.displayName}) [${res.rarity}]\n`;
			response += `⏳ ${res.nextSpawn}\n\n`;
		}
	}

	api.sendMessage(response.trim(), threadID);
}

module.exports = {
	config: {
		name: "predict",
		aliases: ["eggpredict"],
		version: "3.0.0",
		author: "Dev Xdragon",
		role: 2,
		usePrefix: false,
		hasPrefix: false,
		description: "Automated 30-minutes periodic egg spawn prediction broadcast.",
		category: "utility",
		guide: "!predict on\n!predict off"
	},

	onStart: async function ({ message }) {
		return message.reply("🥚 Use `!predict on` to enable automatic predictions every 30 minutes, or `!predict off` to stop.");
	},

	onChat: async function ({ api, event, message }) {
		if (!event.body) return;
		const fullText = event.body.trim();

		if (!fullText.toLowerCase().startsWith("!predict") && !fullText.toLowerCase().startsWith("!eggpredict")) {
			return;
		}

		const { threadID } = event;
		const parts = fullText.split(/\s+/);
		const toggle = parts[1] ? parts[1].toLowerCase() : "";

		if (toggle === "on") {
			if (activePredictors.has(threadID)) {
				return message.reply("ℹ️ Automated egg prediction updates are already **ENABLED** in this chat.");
			}

			sendBroadcast(api, threadID);

			const intervalId = setInterval(() => {
				sendBroadcast(api, threadID);
			}, RESET_PERIOD_SECONDS * 1000);

			activePredictors.set(threadID, intervalId);
			return message.reply("✅ **AUTOMATED PREDICTIONS STARTED**\nEgg spawn predictions will be posted automatically every 30 minutes.");

		} else if (toggle === "off") {
			if (!activePredictors.has(threadID)) {
				return message.reply("ℹ️ Automated egg prediction updates are currently **DISABLED** in this chat.");
			}

			clearInterval(activePredictors.get(threadID));
			activePredictors.delete(threadID);

			return message.reply("❌ **AUTOMATED PREDICTIONS STOPPED**\nAutomatic updates have been disabled.");
		} else {
			return message.reply("❌ Invalid command parameter!\n\nUsage:\n• `!predict on` — Enable automatic updates\n• `!predict off` — Disable automatic updates");
		}
	}
};
