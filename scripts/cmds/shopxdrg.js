/**
 * Command: shop.js
 * Description: Marketplace system for GoatBot
 * Author: Dev Xdragon
 * Version: 2.0.0
 */

const listings = new Map();     // ID => Listing Data
const buyRequests = new Map();  // ID => Request Data
const tradeOffers = new Map();  // ID => Offer Data

function parseFields(text) {
	const lines = text.split("\n");
	const fields = {};
	for (const line of lines) {
		const idx = line.indexOf(":");
		if (idx !== -1) {
			const key = line.slice(0, idx).trim().toLowerCase();
			const val = line.slice(idx + 1).trim();
			fields[key] = val;
		}
	}
	return fields;
}

module.exports = {
	config: {
		name: "shop",
		aliases: ["sell", "buy", "trade", "offer", "cancel"],
		version: "2.0.0",
		author: "Dev Xdragon",
		role: 0,
		usePrefix: false,
		hasPrefix: false,
		description: "Marketplace System (~sell, ~buy, ~trade, ~offer, ~cancel, ~seller approval)",
		category: "economy",
		guide: "Type ~shop tutorial for instructions."
	},

	onStart: async function ({ message }) {
		return message.reply("🛒 Marketplace System Active! Type `~shop tutorial` for full guidance.");
	},

	onChat: async function ({ api, event, message }) {
		try {
			if (!event.body) return;
			const body = event.body.trim();
			if (!body.startsWith("~")) return;

			const { threadID, senderID, messageReply, attachments } = event;
			const lowerBody = body.toLowerCase();

			// ==========================================
			// 1. TUTORIAL COMMAND (~shop tutorial)
			// ==========================================
			if (lowerBody === "~shop tutorial") {
				return message.reply(
					`🛒 **SHOP SYSTEM TUTORIAL** 🛒\n` +
					`━━━━━━━━━━━━━━━━━━━━━━\n\n` +
					`📌 **1. SELL AN ITEM** (Attach photo)\n` +
					`~sell\n` +
					`Price: $50 / ₱2,000 / 500 Robux\n` +
					`Item Name: Dragon Sword\n` +
					`Id: DS-01\n` +
					`Payment name: GCash\n` +
					`Payment number: 09123456789\n\n` +

					`📌 **2. BUY AN ITEM** (Reply to sell post or specify ID)\n` +
					`~buy\n` +
					`Item name: Dragon Sword\n` +
					`Id: DS-01\n\n` +

					`📌 **3. TRADE AN ITEM**\n` +
					`~trade\n` +
					`Item name: Shadow Wings\n` +
					`Id: SW-99\n\n` +

					`📌 **4. OFFER A TRADE** (Reply to trade post)\n` +
					`~offer\n` +
					`Item name: Golden Shield\n` +
					`Id: SW-99\n\n` +

					`📌 **5. CANCEL ACTIONS** (Reply to buy/trade post)\n` +
					`~cancel buying\n` +
					`~cancel trade\n\n` +

					`📌 **6. SELLER APPROVAL** (Reply to buy/offer request)\n` +
					`~Seller approval\n` +
					`or reply with: ✅ or ❎`
				);
			}

			// ==========================================
			// 2. SELL COMMAND (~sell)
			// ==========================================
			if (lowerBody.startsWith("~sell")) {
				let imageURL = null;
				if (attachments && attachments.length > 0 && attachments[0].type === "photo") {
					imageURL = attachments[0].url;
				} else if (messageReply && messageReply.attachments && messageReply.attachments.length > 0 && messageReply.attachments[0].type === "photo") {
					imageURL = messageReply.attachments[0].url;
				}

				if (!imageURL) {
					return message.reply("❌ **Error:** Please attach or select a photo when using ~sell!");
				}

				const fields = parseFields(body);
				const price = fields["price"];
				const itemName = fields["item name"] || fields["itemname"];
				const customID = fields["id"];
				const paymentName = fields["payment name"];
				const paymentNumber = fields["payment number"];

				if (!price || !itemName || !customID || !paymentName || !paymentNumber) {
					return message.reply(
						"❌ **Invalid Format!** Required layout:\n\n" +
						"~sell\n" +
						"Price: [$, ₱, or Robux]\n" +
						"Item Name: [Name]\n" +
						"Id: [Seller Defined ID]\n" +
						"Payment name: [Provider Name]\n" +
						"Payment number: [Account Number]"
					);
				}

				if (listings.has(customID)) {
					return message.reply(`❌ **Error:** The ID "${customID}" is already used! Please choose a different Id:`);
				}

				listings.set(customID, {
					id: customID,
					sellerID,
					itemName,
					price,
					paymentName,
					paymentNumber,
					imageURL,
					type: "SELL"
				});

				return message.reply(
					`✅ **ITEM LISTED FOR SALE**\n` +
					`━━━━━━━━━━━━━━━━━━━━━━\n` +
					`📦 **Item Name:** ${itemName}\n` +
					`🆔 **Id:** ${customID}\n` +
					`💰 **Price:** ${price}\n` +
					`💳 **Payment name:** ${paymentName}\n` +
					`🔢 **Payment number:** ${paymentNumber}\n` +
					`👤 **Seller ID:** ${senderID}`
				);
			}

			// ==========================================
			// 3. TRADE COMMAND (~trade)
			// ==========================================
			if (lowerBody.startsWith("~trade")) {
				const fields = parseFields(body);
				const itemName = fields["item name"] || fields["itemname"];
				const customID = fields["id"];

				if (!itemName || !customID) {
					return message.reply(
						"❌ **Invalid Format!** Required layout:\n\n" +
						"~trade\n" +
						"Item name: [Item Name]\n" +
						"Id: [Custom Trade ID]"
					);
				}

				if (listings.has(customID)) {
					return message.reply(`❌ **Error:** The Trade ID "${customID}" is already in use!`);
				}

				listings.set(customID, {
					id: customID,
					sellerID,
					itemName,
					type: "TRADE"
				});

				return message.reply(
					`🔄 **TRADE LISTED**\n` +
					`━━━━━━━━━━━━━━━━━━━━━━\n` +
					`📦 **Item name:** ${itemName}\n` +
					`🆔 **Id:** ${customID}\n` +
					`👤 **Owner:** ${senderID}`
				);
			}

			// ==========================================
			// 4. BUY COMMAND (~buy)
			// ==========================================
			if (lowerBody.startsWith("~buy")) {
				const fields = parseFields(body);
				let customID = fields["id"];
				let itemName = fields["item name"] || fields["itemname"];

				if (!customID && messageReply && messageReply.body) {
					for (const [id] of listings.entries()) {
						if (messageReply.body.includes(id)) {
							customID = id;
							break;
						}
					}
				}

				if (!customID) {
					return message.reply(
						"❌ **Invalid Format!** Reply to a sell post or provide:\n\n" +
						"~buy\n" +
						"Item name: [Item Name]\n" +
						"Id: [Listing ID]"
					);
				}

				const listing = listings.get(customID);
				if (!listing || listing.type !== "SELL") {
					return message.reply(`❌ **Error:** Active listing with Id "${customID}" not found.`);
				}

				buyRequests.set(customID, {
					id: customID,
					buyerID: senderID,
					sellerID: listing.sellerID,
					itemName: itemName || listing.itemName,
					price: listing.price,
					paymentName: listing.paymentName,
					paymentNumber: listing.paymentNumber
				});

				return message.reply(
					`🛒 **BUY REQUEST SENT**\n` +
					`━━━━━━━━━━━━━━━━━━━━━━\n` +
					`📦 **Item name:** ${itemName || listing.itemName}\n` +
					`🆔 **Id:** ${customID}\n` +
					`👤 **Buyer:** ${senderID}\n` +
					`━━━━━━━━━━━━━━━━━━━━━━\n` +
					`🔔 Seller: Reply with ~Seller approval or ✅/❎`
				);
			}

			// ==========================================
			// 5. OFFER COMMAND (~offer)
			// ==========================================
			if (lowerBody.startsWith("~offer")) {
				const fields = parseFields(body);
				let customID = fields["id"];
				const offeredItem = fields["item name"] || fields["itemname"];

				if (!offeredItem) {
					return message.reply("❌ **Error:** Missing `Item name:` field!");
				}

				if (!customID && messageReply && messageReply.body) {
					for (const [id] of listings.entries()) {
						if (messageReply.body.includes(id)) {
							customID = id;
							break;
						}
					}
				}

				if (!customID) {
					return message.reply(
						"❌ **Invalid Format!** Reply to a trade post or provide:\n\n" +
						"~offer\n" +
						"Item name: [Your Offered Item]\n" +
						"Id: [Trade Listing ID]"
					);
				}

				const listing = listings.get(customID);
				if (!listing) {
					return message.reply(`❌ **Error:** Trade listing with Id "${customID}" not found.`);
				}

				tradeOffers.set(customID, {
					id: customID,
					offererID: senderID,
					ownerID: listing.sellerID,
					offeredItem,
					targetItem: listing.itemName
				});

				return message.reply(
					`🤝 **OFFER SUBMITTED**\n` +
					`━━━━━━━━━━━━━━━━━━━━━━\n` +
					`🎯 **Target Item:** ${listing.itemName}\n` +
					`🎁 **Item name:** ${offeredItem}\n` +
					`🆔 **Id:** ${customID}\n` +
					`👤 **Offerer:** ${senderID}\n` +
					`━━━━━━━━━━━━━━━━━━━━━━\n` +
					`🔔 Owner: Reply with ~Seller approval or ✅/❎`
				);
			}

			// ==========================================
			// 6. CANCEL TRADE (~cancel trade)
			// ==========================================
			if (lowerBody.startsWith("~cancel trade")) {
				let targetID = parseFields(body)["id"];

				if (!targetID && messageReply && messageReply.body) {
					for (const [id] of listings.entries()) {
						if (messageReply.body.includes(id)) {
							targetID = id;
							break;
						}
					}
					if (!targetID) {
						for (const [id] of tradeOffers.entries()) {
							if (messageReply.body.includes(id)) {
								targetID = id;
								break;
							}
						}
					}
				}

				if (!targetID) {
					return message.reply("❌ **Error:** Reply to the target trade message or provide `Id:`");
				}

				tradeOffers.delete(targetID);
				listings.delete(targetID);

				return message.reply(`${targetID} Cancelled`);
			}

			// ==========================================
			// 7. CANCEL BUYING (~cancel buying)
			// ==========================================
			if (lowerBody.startsWith("~cancel buying")) {
				let targetID = parseFields(body)["id"];

				if (!targetID && messageReply && messageReply.body) {
					for (const [id] of buyRequests.entries()) {
						if (messageReply.body.includes(id)) {
							targetID = id;
							break;
						}
					}
				}

				if (!targetID) {
					return message.reply("❌ **Error:** Reply to the buy request message or provide `Id:`");
				}

				buyRequests.delete(targetID);

				return message.reply(`${targetID} Cancelled`);
			}

			// ==========================================
			// 8. SELLER APPROVAL (~Seller approval / ✅ / ❎)
			// ==========================================
			if (messageReply && (body === "✅" || body === "❎" || lowerBody.startsWith("~seller approval"))) {
				const isApproved = body === "✅" || lowerBody.includes("✅") || lowerBody.includes("approval");
				let handled = false;

				// Process Buy Request Approval
				for (const [id, req] of buyRequests.entries()) {
					if (messageReply.body && messageReply.body.includes(id)) {
						if (isApproved) {
							message.reply(
								`✅ **PURCHASE APPROVED**\n` +
								`━━━━━━━━━━━━━━━━━━━━━━\n` +
								`📦 **Item Name:** ${req.itemName}\n` +
								`🆔 **Id:** ${req.id}\n` +
								`💰 **Price:** ${req.price}\n` +
								`💳 **Payment name:** ${req.paymentName}\n` +
								`🔢 **Payment number:** ${req.paymentNumber}\n` +
								`👤 **Buyer:** ${req.buyerID}`
							);
						} else {
							message.reply(`❎ **PURCHASE DECLINED**\nPurchase for ${id} was rejected.`);
						}
						buyRequests.delete(id);
						handled = true;
						break;
					}
				}

				// Process Trade Offer Approval
				if (!handled) {
					for (const [id, offer] of tradeOffers.entries()) {
						if (messageReply.body && messageReply.body.includes(id)) {
							if (isApproved) {
								message.reply(
									`✅ **TRADE APPROVED**\n` +
									`━━━━━━━━━━━━━━━━━━━━━━\n` +
									`🆔 **Id:** ${offer.id}\n` +
									`📦 **Item 1:** ${offer.targetItem}\n` +
									`📦 **Item 2:** ${offer.offeredItem}`
								);
							} else {
								message.reply(`❎ **TRADE DECLINED**\nTrade for ${id} was rejected.`);
							}
							tradeOffers.delete(id);
							handled = true;
							break;
						}
					}
				}

				if (!handled) {
					return message.reply("❌ **Error:** Please reply directly to an active Buy Request or Trade Offer message.");
				}
			}

		} catch (err) {
			console.error("[Shop Module Error]:", err);
		}
	}
};
