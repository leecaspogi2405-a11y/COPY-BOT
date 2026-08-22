/**
 * Command: shop.js
 * Description: Spam-proof Marketplace system for GoatBot
 * Author: Dev Xdragon
 * Version: 7.0.0
 */

const listings = new Map();     // ID => Listing Data
const buyRequests = new Map();  // ID => Request Data
const tradeOffers = new Map();  // ID => Offer Data

function parseFields(text) {
	const lines = text.split(/\r?\n/);
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
		aliases: ["sell", "buy", "trade", "offer", "cancel", "seller"],
		version: "7.0.0",
		author: "Dev Xdragon",
		role: 0,
		usePrefix: false,
		hasPrefix: false,
		description: "Marketplace system (~sell, ~buy, ~trade, ~offer, ~cancel, ~seller approval)",
		category: "economy",
		guide: "Type ~shop tutorial for instructions."
	},

	onStart: async function ({ event, message, args }) {
		try {
			if (!event || !event.body) return;
			const body = event.body.trim();
			const lowerBody = body.toLowerCase();
			const { senderID, messageReply } = event;
			const sellerID = senderID;

			// ==========================================
			// 1. TUTORIAL COMMAND (~shop tutorial or ~shop)
			// ==========================================
			if (args[0]?.toLowerCase() === "tutorial" || lowerBody === "~shop" || lowerBody === "shop") {
				return message.reply(
					`🛒 **SHOP SYSTEM TUTORIAL** 🛒\n` +
					`━━━━━━━━━━━━━━━━━━━━━━\n\n` +
					`📌 **1. SELL AN ITEM**\n` +
					`~sell\n` +
					`Price: ₱500\n` +
					`Item Name: Kraken\n` +
					`Id: Xd-01\n` +
					`Payment Name: John Doe\n` +
					`Payment Number: 09123456789\n\n` +

					`📌 **2. BUY AN ITEM** (Reply to sell post)\n` +
					`~buy\n` +
					`Item name: Kraken\n` +
					`Id: Xd-01\n\n` +

					`📌 **3. TRADE AN ITEM**\n` +
					`~trade\n` +
					`Item name: Shadow Wings\n` +
					`Id: SW-99\n\n` +

					`📌 **4. OFFER A TRADE** (Reply to trade post)\n` +
					`~offer\n` +
					`Item name: Golden Shield\n` +
					`Id: SW-99\n\n` +

					`📌 **5. CANCEL ACTIONS** (Reply to post)\n` +
					`~cancel buying\n` +
					`~cancel trade\n\n` +

					`📌 **6. SELLER APPROVAL** (Reply to request)\n` +
					`~seller approval\n` +
					`or reply with: ✅ or ❎`
				);
			}

			// ==========================================
			// 2. SELL COMMAND (~sell)
			// ==========================================
			if (lowerBody.startsWith("~sell") || lowerBody.startsWith("sell")) {
				const fields = parseFields(body);
				const price = fields["price"];
				const itemName = fields["item name"] || fields["itemname"];
				const customID = fields["id"];
				const paymentName = fields["payment name"] || fields["paymentname"];
				const paymentNumber = fields["payment number"] || fields["paymentnumber"];

				if (!price || !itemName || !customID || !paymentName || !paymentNumber) {
					return message.reply(
						"❌ **Invalid Format!** Required layout:\n\n" +
						"~sell\n" +
						"Price: ₱500\n" +
						"Item Name: Kraken\n" +
						"Id: Xd-01\n" +
						"Payment Name: John Doe\n" +
						"Payment Number: 09123456789"
					);
				}

				if (listings.has(customID)) {
					return message.reply(`❌ **Error:** The Id "${customID}" is already in use! Please choose a unique Id.`);
				}

				listings.set(customID, {
					id: customID,
					sellerID,
					itemName,
					price,
					paymentName,
					paymentNumber,
					type: "SELL"
				});

				return message.reply(
					`✅ **ITEM LISTED FOR SALE**\n` +
					`━━━━━━━━━━━━━━━━━━━━━━\n` +
					`📦 **Item Name:** ${itemName}\n` +
					`🆔 **Id:** ${customID}\n` +
					`💰 **Price:** ${price}\n` +
					`💳 **Payment Name:** ${paymentName}\n` +
					`🔢 **Payment Number:** ${paymentNumber}\n` +
					`👤 **Seller ID:** ${sellerID}`
				);
			}

			// ==========================================
			// 3. TRADE COMMAND (~trade)
			// ==========================================
			if (lowerBody.startsWith("~trade") || lowerBody.startsWith("trade")) {
				const fields = parseFields(body);
				const itemName = fields["item name"] || fields["itemname"];
				const customID = fields["id"];

				if (!itemName || !customID) {
					return message.reply(
						"❌ **Invalid Format!** Required layout:\n\n" +
						"~trade\n" +
						"Item name: Shadow Wings\n" +
						"Id: SW-99"
					);
				}

				if (listings.has(customID)) {
					return message.reply(`❌ **Error:** Trade Id "${customID}" is already in use!`);
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
					`👤 **Owner:** ${sellerID}`
				);
			}

			// ==========================================
			// 4. BUY COMMAND (~buy)
			// ==========================================
			if (lowerBody.startsWith("~buy") || lowerBody.startsWith("buy")) {
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
						"Item name: Kraken\n" +
						"Id: Xd-01"
					);
				}

				const listing = listings.get(customID);
				if (!listing || listing.type !== "SELL") {
					return message.reply(`❌ **Error:** Active sell listing with Id "${customID}" not found.`);
				}

				buyRequests.set(customID, {
					id: customID,
					buyerID: sellerID,
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
					`👤 **Buyer:** ${sellerID}\n` +
					`━━━━━━━━━━━━━━━━━━━━━━\n` +
					`🔔 Seller: Reply with ~seller approval or ✅/❎`
				);
			}

			// ==========================================
			// 5. OFFER COMMAND (~offer)
			// ==========================================
			if (lowerBody.startsWith("~offer") || lowerBody.startsWith("offer")) {
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
						"Item name: Golden Shield\n" +
						"Id: SW-99"
					);
				}

				const listing = listings.get(customID);
				if (!listing) {
					return message.reply(`❌ **Error:** Trade listing with Id "${customID}" not found.`);
				}

				tradeOffers.set(customID, {
					id: customID,
					offererID: sellerID,
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
					`👤 **Offerer:** ${sellerID}\n` +
					`━━━━━━━━━━━━━━━━━━━━━━\n` +
					`🔔 Owner: Reply with ~seller approval or ✅/❎`
				);
			}

			// ==========================================
			// 6. CANCEL COMMAND (~cancel)
			// ==========================================
			if (lowerBody.startsWith("~cancel") || lowerBody.startsWith("cancel")) {
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
					if (!targetID) {
						for (const [id] of buyRequests.entries()) {
							if (messageReply.body.includes(id)) {
								targetID = id;
								break;
							}
						}
					}
				}

				if (!targetID) {
					return message.reply("❌ **Error:** Reply to the target message or provide `Id:`");
				}

				tradeOffers.delete(targetID);
				buyRequests.delete(targetID);
				listings.delete(targetID);

				return message.reply(`✅ Transaction for ${targetID} cancelled.`);
			}

			// ==========================================
			// 7. SELLER APPROVAL (~seller approval)
			// ==========================================
			if (lowerBody.includes("seller approval")) {
				if (!messageReply) {
					return message.reply("❌ **Error:** Reply directly to an active Buy Request or Trade Offer message.");
				}

				for (const [id, req] of buyRequests.entries()) {
					if (messageReply.body && messageReply.body.includes(id)) {
						message.reply(
							`✅ **PURCHASE APPROVED**\n` +
							`━━━━━━━━━━━━━━━━━━━━━━\n` +
							`📦 **Item Name:** ${req.itemName}\n` +
							`🆔 **Id:** ${req.id}\n` +
							`💰 **Price:** ${req.price}\n` +
							`💳 **Payment Name:** ${req.paymentName}\n` +
							`🔢 **Payment Number:** ${req.paymentNumber}\n` +
							`👤 **Buyer:** ${req.buyerID}`
						);
						buyRequests.delete(id);
						return;
					}
				}

				for (const [id, offer] of tradeOffers.entries()) {
					if (messageReply.body && messageReply.body.includes(id)) {
						message.reply(
							`✅ **TRADE APPROVED**\n` +
							`━━━━━━━━━━━━━━━━━━━━━━\n` +
							`🆔 **Id:** ${offer.id}\n` +
							`📦 **Item 1:** ${offer.targetItem}\n` +
							`📦 **Item 2:** ${offer.offeredItem}`
						);
						tradeOffers.delete(id);
						return;
					}
				}

				return message.reply("❌ **Error:** Active Buy Request or Trade Offer not found in that reply.");
			}

		} catch (err) {
			console.error("[Shop Execution Error]:", err);
			return message.reply(`⚠️ **System Error:** ${err.message}`);
		}
	},

	// Safe handling for emoji reactions in reply only
	onChat: async function ({ event, message }) {
		if (event.messageReply && (event.body === "✅" || event.body === "❎")) {
			const body = event.body;
			const messageReply = event.messageReply;

			for (const [id, req] of buyRequests.entries()) {
				if (messageReply.body && messageReply.body.includes(id)) {
					if (body === "✅") {
						message.reply(
							`✅ **PURCHASE APPROVED**\n` +
							`━━━━━━━━━━━━━━━━━━━━━━\n` +
							`📦 **Item Name:** ${req.itemName}\n` +
							`🆔 **Id:** ${req.id}\n` +
							`💰 **Price:** ${req.price}\n` +
							`💳 **Payment Name:** ${req.paymentName}\n` +
							`🔢 **Payment Number:** ${req.paymentNumber}\n` +
							`👤 **Buyer:** ${req.buyerID}`
						);
					} else {
						message.reply(`❎ **PURCHASE DECLINED**\nPurchase for ${id} was rejected.`);
					}
					buyRequests.delete(id);
					return;
				}
			}

			for (const [id, offer] of tradeOffers.entries()) {
				if (messageReply.body && messageReply.body.includes(id)) {
					if (body === "✅") {
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
					return;
				}
			}
		}
	}
};
