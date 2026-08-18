const axios = require('axios');

function getCurrentDateTime() {
	return new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
}

module.exports = {
	config: {
		name: "bypass",
		version: "2.1.0",
		author: "Dev Xdragon",
		role: 0,
		category: "utility",
		description: {
			en: "Bypass Delta key via platorelay link"
		},
		guide: {
			en: "   ~bypass {link}"
		}
	},

	onStart: async function () {},

	onChat: async function ({ api, event, message, usersData }) {
		if (!event.body) return;

		const body = event.body.trim();
		const lowerBody = body.toLowerCase();
		const senderID = event.senderID;

		if (lowerBody.startsWith('~bypass')) {
			const args = body.split(/\s+/);
			const link = args[1];

			if (!link) {
				return message.reply("❌ Please provide a valid link.\n\nUsage:\n~bypass {platorelay link}");
			}

			const name = await usersData.getName(senderID);
			const timeAndDate = getCurrentDateTime();

			let deltaKey = "";

			// Kunin agad ang data mula sa API nang walang delay
			try {
				const apiUrl = `https://xdrg-bypasser-api.onrender.com/bypass?url=${encodeURIComponent(link)}`;
				const response = await axios.get(apiUrl);

				if (response.data && response.data.success) {
					deltaKey = response.data.key;
				} else {
					deltaKey = "❌ Failed to extract key. Please check the link.";
				}
			} catch (error) {
				deltaKey = "❌ Bypasser API error or currently waking up.";
			}

			const finalMsg = `Hello I'm Xdragon Bot, Your Delta key Is successful ✅\n\n` +
				`Original: ${link}\n\n` +
				`Requested by: ${name}\n` +
				`Sync: ${timeAndDate}\n\n` +
				`Your Key is🗝️👇\n` +
				`${deltaKey}\n\n` +
				`Made by:Dev Xdragon\n` +
				`Form:Xdrg Bypasser key\n` +
				`Instructions: type ~bypass {platorelay link} and bot send you the key!\n` +
				`Get your link in: ${link}`;

			// Direktang i-send ang kumpletong mensahe
			return message.reply(finalMsg);
		}
	}
};
