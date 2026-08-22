/**
 * Command: shop.js
 * Description: Marketplace system for GoatBot
 * Author: Dev Xdragon
 * Version: 3.0.0
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

function handleCommandLogic({ event, message }) {
	if (!event.body) return;
	const body = event.body.trim();
	const lowerBody = body.toLowerCase();
	const { senderID, messageReply, attachments } = event;

	// ==========================================
	// 1. TUTORIAL COMMAND (~shop tutorial)
	// ==========================================
	if (lowerBody.includes("tutorial")) {
		return message.reply(
			`🛒 **SHOP SYSTEM TUTORIAL** 🛒\n` +
			`━━━━━━━━━━━━━━━━━━━━━━\n\n` +
			`📌 **1. SELL AN ITEM** (Attach or reply to photo)\n` +
			`~sell\n` +
			`Price: ₱500\n` +
			`Item Name: Kraken\n` +
			`Id: Xd-01\n` +
			`Payment Name: Andrea\n` +
			`Payment Number: 09123456778\n\n` +

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
			`~Seller approval\n` +
			`or reply with: ✅ or ❎`
		);
	}

	// ==========================================
	// 2. SELL COMMAND (~sell)
	// ==========================================
	if (lowerBody.startsWith("~sell")) {
		let imageURL = null;

		// Check direct attachments
		if (attachments && attachments.length > 0) {
			const img = attachments.find(a => a.type === "photo");
			if (img) imageURL = img.url;
		}
		// Check replied message attachments
		if (!imageURL && messageReply && messageReply.attachments && messageReply.attachments.length > 0) {
			const img = messageReply.attachments.find(a => a.type === "photo");
			if (img) imageURL = img.url;
		}

		if (!imageURL) {
			return message.reply("❌ **Error:** Select or attach a photo when sending ~sell!");
		}

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
				"Payment Name: Andrea\n" +
				"Payment Number: 09123456778"
			);
		}

		if (listings.has(customID)) {
			return message.reply(`❌ **Error:** The Id "${customID}" is already in use! Choose a different Id.`);
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
			`💳 **Payment Name:** ${paymentName}\n` +
			`🔢 **Payment Number:** ${paymentNumber}\n` +
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

		for (const [id, req] of buyRequests.entries()) {
			if (messageReply.body && messageReply.body.includes(id)) {
				if (isApproved) {
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
				handled = true;
				break;
			}
		}

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
}

module.exports = {
	config: {
		name: "shop",
		aliases: ["sell", "buy", "trade", "offer", "cancel", "seller"],
		version: "3.0.0",
		author: "Dev Xdragon",
		role: 0,
		usePrefix: false,
		hasPrefix: false,
		description: "Marketplace system (~sell, ~buy, ~trade, ~offer, ~cancel, ~Seller approval)",
		category: "economy",
		guide: "Type ~shop tutorial for instructions."
	},

	onStart: async function (context) {
		return handleCommandLogic(context);
	},

	onChat: async function (context) {
		return handleCommandLogic(context);
	}
};
