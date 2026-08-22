/**
 * Command: shop.js
 * Description: Complete Marketplace System (Sell, Buy, Trade, Offer, Approvals, Cancellations)
 * Author: Dev Xdragon
 * Version: 1.0.0
 */

const fs = require("fs");
const path = require("path");

// Memory Storage for Listings and Transactions
const listings = new Map(); // ID => Listing Object
const buyRequests = new Map(); // ID => Buy Request Object
const tradeOffers = new Map(); // ID => Offer Object

let idCounter = 1000;

function generateID(prefix) {
	idCounter++;
	return `${prefix}-${idCounter}`;
}

function parseKeyValues(text) {
	const lines = text.split("\n");
	const data = {};
	for (const line of lines) {
		const colonIndex = line.indexOf(":");
		if (colonIndex !== -1) {
			const key = line.slice(0, colonIndex).trim().toLowerCase();
			const value = line.slice(colonIndex + 1).trim();
			data[key] = value;
		}
	}
	return data;
}

module.exports = {
	config: {
		name: "shop",
		aliases: ["sell", "buy", "trade", "offer", "cancel"],
		version: "1.0.0",
		author: "Dev Xdragon",
		role: 0,
		usePrefix: false,
		hasPrefix: false,
		description: "Marketplace system for selling, buying, trading, and offering items using ~ prefix.",
		category: "economy",
		guide: "Type ~shop tutorial for the complete usage guide."
	},

	onStart: async function ({ message }) {
		return message.reply("🛒 Marketplace System Active! Type `~shop tutorial` to view the step-by-step guide.");
	},

	onChat: async function ({ api, event, message }) {
		try {
			if (!event.body) return;
			const fullText = event.body.trim();

			if (!fullText.startsWith("~")) return;

			const { threadID, senderID, messageReply, attachments } = event;
			const lowerText = fullText.toLowerCase();

			// ==========================================
			// 1. TUTORIAL COMMAND (~shop tutorial)
			// ==========================================
			if (lowerText === "~shop tutorial") {
				const tutorialMenu = 
					`🛒 **MARKETPLACE SYSTEM TUTORIAL** 🛒\n` +
					`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
					`1️⃣ **SELL AN ITEM (` + `~sell` + `)**\n` +
					`Attach/select a photo and use format:\n` +
					`~sell\n` +
					`Price: $50 / ₱2,000 / 500 Robux\n` +
					`Item Name: Dragon Sword\n` +
					`Payment name: GCash / PayPal\n` +
					`Payment number: 09123456789\n\n` +

					`2️⃣ **BUY AN ITEM (` + `~buy` + `)**\n` +
					`Reply to a sell post or specify ID:\n` +
					`~buy\n` +
					`Item name: Dragon Sword\n` +
					`Id: S-1001\n\n` +

					`3️⃣ **TRADE AN ITEM (` + `~trade` + `)**\n` +
					`Create a open trade listing:\n` +
					`~trade\n` +
					`Item name: Shadow Wings\n\n` +

					`4️⃣ **MAKE AN OFFER (` + `~offer` + `)**\n` +
					`Reply to a trade/sell post:\n` +
					`~offer\n` +
					`Item name: Golden Armor\n` +
					`Id: T-1002\n\n` +

					`5️⃣ **SELLER/OWNER APPROVAL (` + `~seller approval` + `)**\n` +
					`Reply to a buy or offer message with:\n` +
					`✅ (To Accept) or ❎ (To Reject)\n\n` +

					`6️⃣ **CANCEL ACTIONS**\n` +
					`• Reply to a purchase with ` + `~cancel buying` + `\n` +
					`• Reply to a trade with ` + `~cancel trade` + `\n` +
					`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
				return message.reply(tutorialMenu);
			}

			// ==========================================
			// 2. SELL COMMAND (~sell)
			// ==========================================
			if (lowerText.startsWith("~sell")) {
				let imageURL = null;

				if (attachments && attachments.length > 0 && attachments[0].type === "photo") {
					imageURL = attachments[0].url;
				} else if (messageReply && messageReply.attachments && messageReply.attachments.length > 0 && messageReply.attachments[0].type === "photo") {
					imageURL = messageReply.attachments[0].url;
				}

				if (!imageURL) {
					return message.reply("❌ **Error:** Please attach or select a photo when listing an item to sell.");
				}

				const parsed = parseKeyValues(fullText);
				const price = parsed["price"];
				const itemName = parsed["item name"];
				const paymentName = parsed["payment name"];
				const paymentNumber = parsed["payment number"];
				const customID = parsed["id"] || generateID("S");

				if (!price || !itemName || !paymentName || !paymentNumber) {
					return message.reply(
						"❌ **Invalid Format!** Please include all required fields:\n\n" +
						"~sell\n" +
						"Price: [$, ₱, or Robux]\n" +
						"Item Name: [Name]\n" +
						"Payment name: [Provider]\n" +
						"Payment number: [Account Number]"
					);
				}

				const listingData = {
					id: customID,
					sellerID,
					itemName,
					price,
					paymentName,
					paymentNumber,
					imageURL,
					type: "SELL",
					status: "ACTIVE"
				};

				listings.set(customID, listingData);

				return message.reply(
					`✅ **ITEM LISTED FOR SALE**\n` +
					`━━━━━━━━━━━━━━━━━━━\n` +
					`📦 **Item:** ${itemName}\n` +
					`🏷️ **ID:** ${customID}\n` +
					`💰 **Price:** ${price}\n` +
					`💳 **Payment Method:** ${paymentName}\n` +
					`👤 **Seller ID:** ${senderID}\n` +
					`━━━━━━━━━━━━━━━━━━━\n` +
					`💡 *Buyers can reply with ~buy or ~offer to purchase!*`
				);
			}

			// ==========================================
			// 3. BUY COMMAND (~buy)
			// ==========================================
			if (lowerText.startsWith("~buy")) {
				const parsed = parseKeyValues(fullText);
				let targetID = parsed["id"];
				let itemName = parsed["item name"];

				// Auto-detect ID from message reply if not explicit
				if (!targetID && messageReply) {
					for (const [id, listing] of listings.entries()) {
						if (messageReply.body && messageReply.body.includes(id)) {
							targetID = id;
							itemName = listing.itemName;
							break;
						}
					}
				}

				if (!targetID) {
					return message.reply("❌ **Error:** Please specify an `Id:` or reply directly to a valid sell post.");
				}

				const listing = listings.get(targetID);
				if (!listing || listing.type !== "SELL") {
					return message.reply(`❌ **Error:** No active sell listing found with ID: ${targetID}`);
				}

				if (listing.sellerID === senderID) {
					return message.reply("❌ **Error:** You cannot buy your own item.");
				}

				const reqID = generateID("REQ");
				buyRequests.set(reqID, {
					reqID,
					listingID: targetID,
					buyerID: senderID,
					sellerID: listing.sellerID,
					itemName: itemName || listing.itemName,
					status: "PENDING"
				});

				return message.reply(
					`🛒 **BUY REQUEST SENT**\n` +
					`━━━━━━━━━━━━━━━━━━━\n` +
					`📦 **Item:** ${itemName || listing.itemName}\n` +
					`🆔 **Listing ID:** ${targetID}\n` +
					`📌 **Request ID:** ${reqID}\n` +
					`👤 **Buyer:** <@${senderID}>\n` +
					`━━━━━━━━━━━━━━━━━━━\n` +
					`🔔 <@${listing.sellerID}> Please reply to this message with ✅ to approve or ❎ to reject.`
				);
			}

			// ==========================================
			// 4. TRADE COMMAND (~trade)
			// ==========================================
			if (lowerText.startsWith("~trade")) {
				const parsed = parseKeyValues(fullText);
				const itemName = parsed["item name"];
				const customID = parsed["id"] || generateID("T");

				if (!itemName) {
					return message.reply(
						"❌ **Invalid Format!** Please specify the item name:\n\n" +
						"~trade\n" +
						"Item name: [Your Item Name]"
					);
				}

				listings.set(customID, {
					id: customID,
					sellerID,
					itemName,
					type: "TRADE",
					status: "ACTIVE"
				});

				return message.reply(
					`🔄 **TRADE LISTING CREATED**\n` +
					`━━━━━━━━━━━━━━━━━━━\n` +
					`📦 **Item Available:** ${itemName}\n` +
					`🏷️ **Trade ID:** ${customID}\n` +
					`👤 **Owner:** <@${senderID}>\n` +
					`━━━━━━━━━━━━━━━━━━━\n` +
					`💡 *Interested traders reply with ~offer to propose a trade!*`
				);
			}

			// ==========================================
			// 5. OFFER COMMAND (~offer)
			// ==========================================
			if (lowerText.startsWith("~offer")) {
				const parsed = parseKeyValues(fullText);
				let targetID = parsed["id"];
				const offeredItem = parsed["item name"];

				if (!offeredItem) {
					return message.reply("❌ **Error:** Please specify your `Item name:` in your offer.");
				}

				if (!targetID && messageReply) {
					for (const [id] of listings.entries()) {
						if (messageReply.body && messageReply.body.includes(id)) {
							targetID = id;
							break;
						}
					}
				}

				if (!targetID) {
					return message.reply("❌ **Error:** Please provide the target listing `Id:` or reply directly to a trade listing.");
				}

				const listing = listings.get(targetID);
				if (!listing) {
					return message.reply(`❌ **Error:** Listing ID ${targetID} does not exist.`);
				}

				if (listing.sellerID === senderID) {
					return message.reply("❌ **Error:** You cannot offer on your own listing.");
				}

				const offerID = generateID("OFF");
				tradeOffers.set(offerID, {
					offerID,
					listingID: targetID,
					offererID: senderID,
					ownerID: listing.sellerID,
					offeredItem,
					targetItem: listing.itemName,
					status: "PENDING"
				});

				return message.reply(
					`🤝 **TRADE OFFER SUBMITTED**\n` +
					`━━━━━━━━━━━━━━━━━━━\n` +
					`🎯 **Target Item:** ${listing.itemName} (${targetID})\n` +
					`🎁 **Offered Item:** ${offeredItem}\n` +
					`📌 **Offer ID:** ${offerID}\n` +
					`👤 **Offerer:** <@${senderID}>\n` +
					`━━━━━━━━━━━━━━━━━━━\n` +
					`🔔 <@${listing.sellerID}> Reply to this message with ✅ to accept or ❎ to reject.`
				);
			}

			// ==========================================
			// 6. CANCEL TRADE COMMAND (~cancel trade)
			// ==========================================
			if (lowerText.startsWith("~cancel trade")) {
				let targetID = null;

				// Parse ID if provided directly or from reply
				const parts = fullText.split(/\s+/);
				if (parts.length > 2) targetID = parts[2];

				if (!targetID && messageReply) {
					for (const [id, offer] of tradeOffers.entries()) {
						if (messageReply.body && messageReply.body.includes(id)) {
							targetID = id;
							break;
						}
					}
					if (!targetID) {
						for (const [id] of listings.entries()) {
							if (messageReply.body && messageReply.body.includes(id)) {
								targetID = id;
								break;
							}
						}
					}
				}

				if (!targetID) {
					return message.reply("❌ **Error:** Specify an ID or reply to the trade offer message.");
				}

				if (tradeOffers.has(targetID)) tradeOffers.delete(targetID);
				if (listings.has(targetID)) listings.delete(targetID);

				return message.reply(`${targetID} Cancelled`);
			}

			// ==========================================
			// 7. CANCEL BUYING COMMAND (~cancel buying)
			// ==========================================
			if (lowerText.startsWith("~cancel buying")) {
				let targetID = null;

				const parts = fullText.split(/\s+/);
				if (parts.length > 2) targetID = parts[2];

				if (!targetID && messageReply) {
					for (const [id] of buyRequests.entries()) {
						if (messageReply.body && messageReply.body.includes(id)) {
							targetID = id;
							break;
						}
					}
					if (!targetID) {
						for (const [id] of listings.entries()) {
							if (messageReply.body && messageReply.body.includes(id)) {
								targetID = id;
								break;
							}
						}
					}
				}

				if (!targetID) {
					return message.reply("❌ **Error:** Specify an ID or reply to the buying request message.");
				}

				if (buyRequests.has(targetID)) buyRequests.delete(targetID);

				return message.reply(`${targetID} Cancelled`);
			}

			// ==========================================
			// 8. SELLER APPROVAL (Reply ✅ or ❎)
			// ==========================================
			if (messageReply && (fullText === "✅" || fullText === "❎" || lowerText.startsWith("~seller approval"))) {
				const isApproved = fullText.includes("✅") || lowerText.includes("approve");
				let handled = false;

				// Check Buy Requests
				for (const [reqID, req] of buyRequests.entries()) {
					if (messageReply.body && messageReply.body.includes(reqID)) {
						if (req.sellerID !== senderID) {
							return message.reply("❌ **Permission Denied:** Only the seller can approve or reject this purchase.");
						}

						if (isApproved) {
							const listing = listings.get(req.listingID);
							req.status = "APPROVED";
							return message.reply(
								`✅ **PURCHASE APPROVED!**\n` +
								`━━━━━━━━━━━━━━━━━━━\n` +
								`👤 **Buyer:** <@${req.buyerID}>\n` +
								`📦 **Item:** ${req.itemName}\n` +
								`💳 **Payment Provider:** ${listing ? listing.paymentName : "N/A"}\n` +
								`🔢 **Payment Number:** ${listing ? listing.paymentNumber : "N/A"}\n` +
								`━━━━━━━━━━━━━━━━━━━\n` +
								`🎉 Please proceed with sending payment to complete the transaction.`
							);
						} else {
							req.status = "REJECTED";
							return message.reply(`❎ **PURCHASE REJECTED!** The seller declined the buy request.`);
						}
						handled = true;
						break;
					}
				}

				// Check Trade Offers
				if (!handled) {
					for (const [offerID, offer] of tradeOffers.entries()) {
						if (messageReply.body && messageReply.body.includes(offerID)) {
							if (offer.ownerID !== senderID) {
								return message.reply("❌ **Permission Denied:** Only the owner can approve or reject this trade.");
							}

							if (isApproved) {
								offer.status = "APPROVED";
								return message.reply(
									`✅ **TRADE APPROVED!**\n` +
									`━━━━━━━━━━━━━━━━━━━\n` +
									`👤 **Trader 1:** <@${offer.ownerID}> (${offer.targetItem})\n` +
									`👤 **Trader 2:** <@${offer.offererID}> (${offer.offeredItem})\n` +
									`━━━━━━━━━━━━━━━━━━━\n` +
									`🎉 Trade deal finalized successfully!`
								);
							} else {
								offer.status = "REJECTED";
								return message.reply(`❎ **TRADE REJECTED!** The owner declined this offer.`);
							}
							handled = true;
							break;
						}
					}
				}

				if (!handled) {
					return message.reply("❌ **Error:** Please reply directly to an active Buy Request or Trade Offer message.");
				}
			}

		} catch (error) {
			console.error("[Shop.js Error]:", error);
		}
	}
};
