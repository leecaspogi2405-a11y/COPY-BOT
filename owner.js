module.exports = {
  config: {
    name: "owner",
    version: "2.5.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "View bot owner details"
    },
    longDescription: {
      en: "Displays the bot owner's profile information in a native contact card format."
    },
    category: "info",
    guide: {
      en: "{pn}"
    }
  },

  onStart: async function ({ api, event, message, usersData }) {
    const ownerID = "100086689301511";
    const body = `Hello 👋, I'm VincentSensei, the administrator of this chatbot. If you would like to get in touch, please feel free to contact me by clicking the button below.`;

    try {
      if (typeof api.sendButtons === "function") {
        const buttons = [
          { title: "PROFILE", cta_id: `https://www.facebook.com/profile.php?id=${ownerID}`, type: 0 },
          { title: "MESSAGE", cta_id: `https://m.me/${ownerID}`, type: 0 }
        ];
        return api.sendButtons(buttons, body, event.threadID);
      } else if (typeof api.shareContact === "function") {
        return api.shareContact(body, ownerID, event.threadID);
      } else {
        const name = await usersData.getName(ownerID);
        return message.reply(`👤 Owner: ${name}\n🆔 UID: ${ownerID}\n🌐 FB: facebook.com/profile.php?id=${ownerID}\n\n${body}`);
      }
    } catch (error) {
      console.error("[OWNER] Error:", error.message);
      message.reply(`👤 Owner: VincentSensei\n🆔 ID: ${ownerID}\n🌐 FB: facebook.com/profile.php?id=${ownerID}\n\n${body}`);
    }
  }
};
