const fs = require("fs-extra");

module.exports = {
  config: {
    name: "prefix",
    version: "2.6.0",
    author: "Dev Xdragon",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "View or change bot prefix"
    },
    longDescription: {
      en: "Check the current global/thread prefix or change it."
    },
    category: "config",
    guide: {
      en: "{pn} - View prefix\n{pn} <new prefix> - Change prefix"
    }
  },

  onStart: async function ({ message, role, args, event, api, threadsData, usersData, getLang }) {
    const { threadID, senderID, messageID } = event;
    const prefix = (await threadsData.get(threadID)).prefix || global.GoatBot.config.prefix;

    if (args.length === 0) {
      const botID = api.getCurrentUserID() || global.botID;
      
      // Fetch dynamic data
      let name = "User";
      try {
        const uData = await usersData.get(senderID);
        if (uData && uData.name) name = uData.name;
      } catch (e) {}

      const botName = global.GoatBot.config.botName || "Xdragon Bot";
      const cmdCount = global.GoatBot.commands ? global.GoatBot.commands.size : "Unknown";

      // Calculate Uptime
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      const uptimeString = `${hours}h ${minutes}m ${seconds}s`;

      // Get Time and Date
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' });
      const dateStr = now.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' });

      const body = `╭── « 🤖 𝗕𝗢𝗧 𝗜𝗡𝗙𝗢 by Xdragon » ─⟡
│
│ 👋 Hello, ${name} my 
│    currently prefix is [${prefix}]
│
│ 🤖 Bot    : ${botName}<-Xdragon Bot
│ 📌 Prefix : ${prefix}
│ 📊 Cmds   : ${cmdCount}
│ ⏰ Uptime : ${uptimeString}
│ 🕐 Time   : ${timeStr}
│ 📅 Date   : ${dateStr}
│
│ 💡 To view commands:
│    ${prefix}help
│
│ 👑 prefix:
│    ${prefix}prefix [new prefix]
│    (Bot Admin only)
│   
│  ℹ️ Declaimer: Prefix is working for all           
│  users but if cmds only admin allowed 
│
│  🟢Made by Dev Xdragon (ask me    
│   everything, I know Everything, ow no I    
│   think the system taking by verify 😐)
│
╰──────────────────⟡`;
      
      try {
        if (typeof api.shareContact === "function") {
          return api.shareContact(body, botID, threadID);
        }
        return message.reply(body);
      } catch (e) {
        return message.reply(body);
      }
    }

    if (args[0] === 'reset') {
      await threadsData.set(threadID, null, "data.prefix");
      return message.reply(`Prefix has been reset to: ${global.GoatBot.config.prefix}`);
    }

    const newPrefix = args[0];
    const isGlobal = args[1] === "-g";

    if (isGlobal && role < 2) return message.reply("Only admins can change global prefix.");

    const formSet = {
      commandName: "prefix",
      author: senderID,
      newPrefix,
      setGlobal: isGlobal
    };

    return message.reply(`React to confirm changing prefix to: ${newPrefix}`, (err, info) => {
      if (err) return;
      formSet.messageID = info.messageID;
      global.GoatBot.onReaction.set(info.messageID, formSet);
    });
  },

  onReaction: async function ({ message, threadsData, event, Reaction }) {
    const { author, newPrefix, setGlobal } = Reaction;
    if (event.userID !== author) return;

    if (setGlobal) {
      global.GoatBot.config.prefix = newPrefix;
      fs.writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
      return message.reply(`✅ Global prefix changed to: ${newPrefix}`);
    } else {
      await threadsData.set(event.threadID, newPrefix, "data.prefix");
      return message.reply(`✅ Prefix changed to: ${newPrefix}`);
    }
  },

  onChat: async function ({ event, message, api, threadsData, usersData }) {
    if (event.body && event.body.toLowerCase() === "prefix") {
      const prefix = (await threadsData.get(event.threadID)).prefix || global.GoatBot.config.prefix;
      const botID = api.getCurrentUserID() || global.botID;

      // Fetch dynamic data
      let name = "User";
      try {
        const uData = await usersData.get(event.senderID);
        if (uData && uData.name) name = uData.name;
      } catch (e) {}

      const botName = global.GoatBot.config.botName || "Xdragon Bot";
      const cmdCount = global.GoatBot.commands ? global.GoatBot.commands.size : "Unknown";

      // Calculate Uptime
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      const uptimeString = `${hours}h ${minutes}m ${seconds}s`;

      // Get Time and Date
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' });
      const dateStr = now.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' });

      const body = `╭── « 🤖 𝗕𝗢𝗧 𝗜𝗡𝗙𝗢 by Xdragon » ─⟡
│
│ 👋 Hello, ${name} my 
│    currently prefix is [${prefix}]
│
│ 🤖 Bot    : ${botName}<-Xdragon Bot
│ 📌 Prefix : ${prefix}
│ 📊 Cmds   : ${cmdCount}
│ ⏰ Uptime : ${uptimeString}
│ 🕐 Time   : ${timeStr}
│ 📅 Date   : ${dateStr}
│
│ 💡 To view commands:
│    ${prefix}help
│
│ 👑 prefix:
│    ${prefix}prefix [new prefix]
│    (Bot Admin only)
│   
│  ℹ️ Declaimer: Prefix is working for all           
│  users but if cmds only admin allowed 
│
│  🟢Made by Dev Xdragon (ask me    
│   everything, I know Everything, ow no I    
│   think the system taking by verify 😐)
│
╰──────────────────⟡`;

      try {
        if (typeof api.shareContact === "function") {
          return api.shareContact(body, botID, event.threadID);
        }
        return message.reply(body);
      } catch (e) {
        return message.reply(body);
      }
    }
  }
};
