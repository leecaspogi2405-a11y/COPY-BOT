const fs = require("fs-extra");

// Active prefix list
const ALLOWED_PREFIXES = ["!", "~", "*"];

module.exports = {
  config: {
    name: "prefix",
    version: "2.7.0",
    author: "Jonell Magallanes / Dev Xdragon",
    countDown: 5,
    role: 0,
    usePrefix: false, // Bypasses single prefix restriction
    hasPrefix: false,
    shortDescription: {
      en: "View or manage multi-prefixes (!, ~, *)"
    },
    longDescription: {
      en: "Check active prefixes. Supports !, ~, and * simultaneously."
    },
    category: "config",
    guide: {
      en: "!prefix | ~prefix | *prefix - View active prefixes\n!prefix <new prefix> - Change prefix"
    }
  },

  onStart: async function ({ message, role, args, event, api, threadsData }) {
    const { threadID, senderID } = event;
    const fullText = event.body ? event.body.trim() : "";

    // Check if message starts with !, ~, *, or plain "prefix"
    const matchedPrefix = ALLOWED_PREFIXES.find(p => fullText.startsWith(p));
    
    let cleanText = fullText;
    if (matchedPrefix) {
      cleanText = fullText.slice(matchedPrefix.length).trim();
    }
    
    const parts = cleanText.split(/\s+/);
    if (!parts[0] || parts[0].toLowerCase() !== "prefix") return;

    const cmdArgs = parts.slice(1);

    if (cmdArgs.length === 0) {
      const botID = api.getCurrentUserID() || global.botID;
      const body = `👋 Hey! My active prefixes in this chat are: [ ! ] [ ~ ] [ * ]\n\nTo see my commands, try typing !help, ~help, or *help ✨`;
      
      try {
        if (typeof api.shareContact === "function") {
          return api.shareContact(body, botID, threadID);
        }
        return message.reply(body);
      } catch (e) {
        return message.reply(body);
      }
    }

    if (cmdArgs[0] === 'reset') {
      await threadsData.set(threadID, ALLOWED_PREFIXES.join(" "), "data.prefix");
      return message.reply(`✅ Prefixes reset to default set: [ ! ] [ ~ ] [ * ]`);
    }

    const newPrefix = cmdArgs[0];
    const isGlobal = cmdArgs[1] === "-g";

    if (isGlobal && role < 2) return message.reply("❌ Only bot admins can change global prefix.");

    const formSet = {
      commandName: "prefix",
      author: senderID,
      newPrefix,
      setGlobal: isGlobal
    };

    return message.reply(`React to confirm changing main prefix to: [ ${newPrefix} ]`, (err, info) => {
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
      return message.reply(`✅ Global prefix updated to: [ ${newPrefix} ]`);
    } else {
      await threadsData.set(event.threadID, newPrefix, "data.prefix");
      return message.reply(`✅ Prefix updated to: [ ${newPrefix} ]`);
    }
  },

  onChat: async function ({ event, message, api, threadsData }) {
    if (!event.body) return;
    const text = event.body.trim().toLowerCase();

    // Trigger on typing "prefix", "!prefix", "~prefix", or "*prefix"
    if (text === "prefix" || ALLOWED_PREFIXES.some(p => text === `${p}prefix`)) {
      const botID = api.getCurrentUserID() || global.botID;
      const body = `👋 Hey there! My active prefixes are: [ ! ] [ ~ ] [ * ]\n\nTry using !help, ~help, or *help ✨`;

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
