const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const TZ = "Asia/Manila";

function getFormattedDateTime() {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  const date = now.toLocaleDateString("en-US", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  return { time, date };
}

// Database safe helper functions
async function getActiveRaffle(threadID, threadsData) {
  try {
    const data = await threadsData.get(threadID, "data.activeRaffle");
    if (data && typeof data === "object") return data;
  } catch (e) {}
  try {
    const threadData = await threadsData.get(threadID);
    return threadData?.data?.activeRaffle || null;
  } catch (e) {
    return null;
  }
}

async function setActiveRaffle(threadID, threadsData, raffleData) {
  try {
    await threadsData.set(threadID, raffleData, "data.activeRaffle");
  } catch (e) {
    try {
      const threadData = (await threadsData.get(threadID)) || {};
      if (!threadData.data) threadData.data = {};
      threadData.data.activeRaffle = raffleData;
      await threadsData.set(threadID, threadData);
    } catch (err) {}
  }
}

async function getUserCoins(userID, usersData) {
  try {
    const uData = await usersData.get(userID);
    return uData?.data?.xdrgCoins ?? uData?.xdrgCoins ?? 0;
  } catch (e) {
    return 0;
  }
}

async function setUserCoins(userID, usersData, coins) {
  try {
    await usersData.set(userID, coins, "data.xdrgCoins");
  } catch (e) {
    try {
      const uData = (await usersData.get(userID)) || {};
      if (!uData.data) uData.data = {};
      uData.data.xdrgCoins = coins;
      await usersData.set(userID, uData);
    } catch (err) {}
  }
}

module.exports = {
  config: {
    name: "rankup",
    aliases: ["xdrg", "raffle", "balance", "wallet"],
    version: "2.3.0",
    author: "Xdrg trade service",
    description: "Level up system with XDRG coins and raffle giveaway system",
    category: "system",
    usage: "~rankup balance [@mention/all] | ~rankup raffle join | !rankup raffle create <item> <coins>",
    role: 0,
    usePrefix: false
  },

  onStart: async function ({ api, event, threadsData, usersData, role }) {
    const { threadID, messageID, senderID, mentions, body = "" } = event;
    const trimmedBody = body.trim();
    if (!trimmedBody) return;

    const prefix = trimmedBody.charAt(0);
    if (prefix !== "!" && prefix !== "~") return;

    const tokens = trimmedBody.slice(1).trim().split(/\s+/);
    if (tokens.length === 0 || !tokens[0]) return;

    const mainTrigger = tokens[0].toLowerCase();

    let subCommand = "";
    let action = "";
    let commandArgs = [];

    if (["rankup", "xdrg"].includes(mainTrigger)) {
      subCommand = (tokens[1] || "").toLowerCase();
      action = (tokens[2] || "").toLowerCase();
      commandArgs = tokens.slice(3);
    } else {
      subCommand = mainTrigger;
      action = (tokens[1] || "").toLowerCase();
      commandArgs = tokens.slice(2);
    }

    // Help menu if no subcommand provided
    if (!subCommand) {
      if (prefix === "!") {
        if (role < 1) return;
        return api.sendMessage(
          `👑 ADMIN RANKUP & RAFFLE COMMANDS 👑\n\n` +
          `• !rankup [on/off] - Toggle level notifications\n` +
          `• !rankup raffle create <item> <coins> - Start giveaway\n` +
          `• !rankup raffle end - Draw 1 winner`,
          threadID,
          messageID
        );
      } else {
        return api.sendMessage(
          `📊 XDRG RANKUP & RAFFLE SYSTEM 📊\n\n` +
          `💡 Member Commands:\n` +
          `• ~rankup balance - Check your balance\n` +
          `• ~rankup balance @mention - Check mentioned user balance\n` +
          `• ~rankup balance all - Check all members balance\n` +
          `• ~rankup raffle join - Enter active raffle\n` +
          `• ~rankup raffle status - View active raffle`,
          threadID,
          messageID
        );
      }
    }

    // Toggle rankup notifications (Admin Only: !)
    if (subCommand === "on" || subCommand === "off") {
      if (prefix !== "!" || role < 1) return;
      const isOn = subCommand === "on";
      await threadsData.set(threadID, isOn, "settings.rankupEnabled");
      return api.sendMessage(
        `✅ Rankup notifications have been turned ${isOn ? "ON" : "OFF"} for this group!`,
        threadID,
        messageID
      );
    }

    // Balance / Wallet commands
    if (["coins", "balance", "wallet"].includes(subCommand)) {
      const targetArg = action;

      if (targetArg === "all") {
        try {
          const threadInfo = await api.getThreadInfo(threadID);
          const participantIDs = threadInfo.participantIDs || [];
          let balances = [];

          for (const uid of participantIDs) {
            const coins = await getUserCoins(uid, usersData);
            if (coins > 0) {
              const uName = (await usersData.getName(uid)) || "User";
              balances.push({ name: uName, coins });
            }
          }

          balances.sort((a, b) => b.coins - a.coins);

          let listMsg = `💳 ALL MEMBERS XDRG BALANCES 💳\n\n`;
          if (balances.length === 0) {
            listMsg += `No members currently have XDRG coins. Keep chatting to earn!`;
          } else {
            balances.forEach((item, index) => {
              listMsg += `${index + 1}. ${item.name}: ${item.coins} XDRG Coins\n`;
            });
          }
          return api.sendMessage(listMsg.trim(), threadID, messageID);
        } catch (e) {
          return api.sendMessage("❌ Failed to retrieve thread member balances.", threadID, messageID);
        }
      }

      const mentionIDs = Object.keys(mentions || {});
      if (mentionIDs.length > 0) {
        let mentionMsg = `💳 XDRG WALLET BALANCE 💳\n\n`;
        for (const uid of mentionIDs) {
          const uData = await usersData.get(uid);
          const totalCoins = await getUserCoins(uid, usersData);
          const totalExp = uData?.data?.exp || uData?.exp || 0;
          const userName = mentions[uid].replace(/^@/, "");
          mentionMsg += `👤 User: ${userName}\n⭐ EXP: ${totalExp}\n💰 XDRG Coins: ${totalCoins}\n\n`;
        }
        return api.sendMessage(mentionMsg.trim(), threadID, messageID);
      }

      const userData = await usersData.get(senderID);
      const totalCoins = await getUserCoins(senderID, usersData);
      const totalExp = userData?.data?.exp || userData?.exp || 0;
      const userName = (await usersData.getName(senderID)) || "User";

      return api.sendMessage(
        `💳 XDRG WALLET 💳\n\n` +
        `👤 User: ${userName}\n` +
        `⭐ Total EXP: ${totalExp}\n` +
        `💰 XDRG Coins: ${totalCoins}`,
        threadID,
        messageID
      );
    }

    // Raffle System
    if (["raffle", "giveaway"].includes(subCommand)) {
      // Admin: Create Raffle (!rankup raffle create <item> <coins>)
      if (action === "create" || action === "start") {
        if (prefix !== "!" || role < 1) return;

        if (commandArgs.length < 2) {
          return api.sendMessage("❌ Syntax: !rankup raffle create <item> <coin needed>", threadID, messageID);
        }

        const coinNeeded = parseInt(commandArgs[commandArgs.length - 1]);
        if (isNaN(coinNeeded) || coinNeeded <= 0) {
          return api.sendMessage("❌ Please provide a valid coin amount!", threadID, messageID);
        }

        const item = commandArgs.slice(0, -1).join(" ");
        const activeRaffle = await getActiveRaffle(threadID, threadsData);
        if (activeRaffle && activeRaffle.status === "active") {
          return api.sendMessage("⚠️ An active raffle is already running! End it using !rankup raffle end", threadID, messageID);
        }

        const newRaffle = {
          status: "active",
          item: item,
          coinNeeded: coinNeeded,
          participants: [],
          createdBy: senderID
        };

        await setActiveRaffle(threadID, threadsData, newRaffle);

        return api.sendMessage(
          `🎉 NEW RAFFLE STARTED! 🎉\n\n` +
          `🎁 Item: ${item}\n` +
          `💰 Entry Fee: ${coinNeeded} XDRG Coins\n\n` +
          `👉 Type "~rankup raffle join" to enter!`,
          threadID,
          messageID
        );
      }

      // Member: Join Raffle (~rankup raffle join)
      if (action === "join") {
        if (prefix !== "~") return;

        const activeRaffle = await getActiveRaffle(threadID, threadsData);
        if (!activeRaffle || activeRaffle.status !== "active") {
          return api.sendMessage("❌ There is no active raffle running in this group!", threadID, messageID);
        }

        if (Array.isArray(activeRaffle.participants) && activeRaffle.participants.includes(senderID)) {
          return api.sendMessage("⚠️ You have already entered this raffle!", threadID, messageID);
        }

        const currentCoins = await getUserCoins(senderID, usersData);

        if (currentCoins < activeRaffle.coinNeeded) {
          return api.sendMessage(
            `❌ You don't have enough XDRG coins to join!\n` +
            `Required: ${activeRaffle.coinNeeded} XDRG Coins\n` +
            `Your Balance: ${currentCoins} XDRG Coins\n\n` +
            `💡 Keep chatting to level up and earn more coins!`,
            threadID,
            messageID
          );
        }

        const updatedCoins = currentCoins - activeRaffle.coinNeeded;
        await setUserCoins(senderID, usersData, updatedCoins);

        if (!Array.isArray(activeRaffle.participants)) {
          activeRaffle.participants = [];
        }
        activeRaffle.participants.push(senderID);
        await setActiveRaffle(threadID, threadsData, activeRaffle);

        const userName = (await usersData.getName(senderID)) || "User";
        const { time, date } = getFormattedDateTime();

        const joinMessage =
          `Gag2 raffle made by XDRG TRADE SERVICE \n\n` +
          `Name:${userName}\n` +
          `Item:${activeRaffle.item}\n` +
          `Time:${time}\n` +
          `Date:${date}\n\n` +
          `------------------------------------------\n` +
          `Reminder:Copying this message is belong to copyright ©️ if you copy this message Xdrg team/XDRG TRADE SERVICE add your name to xdrg report list`;

        return api.sendMessage(joinMessage, threadID, messageID);
      }

      // Admin: End Raffle (!rankup raffle end)
      if (action === "end" || action === "draw") {
        if (prefix !== "!" || role < 1) return;

        const activeRaffle = await getActiveRaffle(threadID, threadsData);
        if (!activeRaffle || activeRaffle.status !== "active") {
          return api.sendMessage("❌ There is no active raffle to end!", threadID, messageID);
        }

        const participants = activeRaffle.participants || [];
        if (participants.length === 0) {
          await setActiveRaffle(threadID, threadsData, { status: "ended" });
          return api.sendMessage("📢 Raffle ended! Nobody joined the giveaway.", threadID, messageID);
        }

        const winnerID = participants[Math.floor(Math.random() * participants.length)];
        const winnerName = (await usersData.getName(winnerID)) || "User";

        await setActiveRaffle(threadID, threadsData, { status: "ended" });

        return api.sendMessage(
          {
            body: `🏆 WINNER ANNOUNCEMENT 🏆\n\n` +
                  `🎉 Congratulations @${winnerName}!\n` +
                  `🎁 You won: ${activeRaffle.item}\n` +
                  `👥 Total Participants: ${participants.length}\n\n` +
                  `Brought to you by XDRG TRADE SERVICE!`,
            mentions: [{ tag: winnerName, id: winnerID }]
          },
          threadID,
          messageID
        );
      }

      // Status Check (~rankup raffle status)
      if (action === "status" || action === "info") {
        const activeRaffle = await getActiveRaffle(threadID, threadsData);
        if (!activeRaffle || activeRaffle.status !== "active") {
          return api.sendMessage("ℹ️ No active raffle in this group.", threadID, messageID);
        }

        const participantCount = Array.isArray(activeRaffle.participants) ? activeRaffle.participants.length : 0;

        return api.sendMessage(
          `📊 ACTIVE RAFFLE DETAILS 📊\n\n` +
          `🎁 Item: ${activeRaffle.item}\n` +
          `💰 Required Coins: ${activeRaffle.coinNeeded} XDRG Coins\n` +
          `👥 Current Entries: ${participantCount} participant(s)`,
          threadID,
          messageID
        );
      }
    }
  },

  onChat: async function ({
    api,
    event,
    usersData,
    threadsData,
    message,
  }) {
    const { threadID, senderID } = event;

    const rankupEnabled = await threadsData.get(
      threadID,
      "settings.rankupEnabled"
    );
    if (rankupEnabled === false) return;

    try {
      const userData = await usersData.get(senderID);
      const prevExp = userData?.data?.exp || userData?.exp || 0;
      const currentCoins = await getUserCoins(senderID, usersData);
      const exp = prevExp + 1;

      await usersData.set(senderID, exp, "data.exp");

      const expToLevel = (e) =>
        Math.floor((1 + Math.sqrt(1 + (8 * e) / 5)) / 2);

      const prevLevel = expToLevel(prevExp);
      const currentLevel = expToLevel(exp);

      if (currentLevel > prevLevel && currentLevel > 1) {
        const totalCoins = currentCoins + 5;
        await setUserCoins(senderID, usersData, totalCoins);

        const name = (await usersData.getName(senderID)) || "User";

        const levelUpMsg =
          `🎉 LEVEL UP! 🎉\n\n` +
          `👤 ${name}\n` +
          `🎖️ NEW LEVEL: ${currentLevel}\n` +
          `⭐ EXP: ${exp}\n` +
          `💰 +5 coins XDRG! (Total: ${totalCoins})\n\n` +
          `🌟 Keep chatting to level up more!`;

        const form = {
          body: levelUpMsg,
          mentions: [{ tag: name, id: senderID }],
        };

        try {
          const imagePath = path.join(
            __dirname,
            "../cmds/",
            `rankup_${senderID}_${Date.now()}.gif`
          );
          const response = await axios({
            method: "get",
            url: `https://rankup-api-b1rv.vercel.app/api/rankup?uid=${senderID}`,
            responseType: "stream",
            timeout: 15000,
          });
          const writer = fs.createWriteStream(imagePath);
          response.data.pipe(writer);
          await new Promise((resolve) => {
            writer.on("finish", resolve);
          });
          form.attachment = fs.createReadStream(imagePath);
          await message.send(form);
          fs.unlink(imagePath).catch(() => {});
        } catch (e) {
          await message.send(form);
        }
      }
    } catch (e) {
      console.error("[RANKUP] Error:", e.message);
    }
  },
};
