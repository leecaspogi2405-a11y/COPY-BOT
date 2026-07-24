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

module.exports = {
  config: {
    name: "rankup",
    aliases: ["xdrg", "raffle"],
    version: "2.0.0",
    author: "Xdrg trade service",
    description: "Level up system with XDRG coins and raffle giveaway system",
    category: "system",
    usage: "rankup [on/off] | raffle [create/join/end/status] | coins",
    role: 0,
  },

  onStart: async function ({ api, event, threadsData, usersData, args, role }) {
    const { threadID, messageID, senderID } = event;
    const subCommand = (args[0] || "").toLowerCase();

    if (!subCommand) {
      const rankupEnabled = await threadsData.get(
        threadID,
        "settings.rankupEnabled"
      );
      const status = rankupEnabled ? "ON" : "OFF";
      return api.sendMessage(
        `📊 Rankup System Status: ${status}\n\n` +
        `💡 Commands:\n` +
        `• rankup [on/off] - Toggle level notifications\n` +
        `• rankup coins - Check your XDRG coins\n` +
        `• rankup raffle create <item> <coins> - Start giveaway (Admin)\n` +
        `• rankup raffle join - Enter active raffle\n` +
        `• rankup raffle status - View active raffle\n` +
        `• rankup raffle end - Draw 1 winner (Admin)`,
        threadID,
        messageID
      );
    }

    if (subCommand === "on" || subCommand === "off") {
      const isOn = subCommand === "on";
      await threadsData.set(threadID, isOn, "settings.rankupEnabled");
      return api.sendMessage(
        `✅ Rankup notifications have been turned ${isOn ? "ON" : "OFF"} for this group!`,
        threadID,
        messageID
      );
    }

    if (subCommand === "coins" || subCommand === "balance" || subCommand === "wallet") {
      const userData = await usersData.get(senderID);
      const totalCoins = userData?.data?.xdrgCoins || 0;
      const totalExp = userData?.data?.exp || 0;
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

    if (subCommand === "raffle" || subCommand === "giveaway") {
      const action = (args[1] || "").toLowerCase();

      if (action === "create" || action === "start") {
        if (role < 1) {
          return api.sendMessage("❌ Only bot/group admins can create a raffle giveaway!", threadID, messageID);
        }

        const rawArgs = args.slice(2);
        if (rawArgs.length < 2) {
          return api.sendMessage("❌ Invalid syntax!\nUsage: rankup raffle create <item> <coin needed>", threadID, messageID);
        }

        const coinNeeded = parseInt(rawArgs[rawArgs.length - 1]);
        if (isNaN(coinNeeded) || coinNeeded <= 0) {
          return api.sendMessage("❌ Please provide a valid number of XDRG coins required to enter!", threadID, messageID);
        }

        const item = rawArgs.slice(0, -1).join(" ");

        const activeRaffle = await threadsData.get(threadID, "data.activeRaffle");
        if (activeRaffle && activeRaffle.status === "active") {
          return api.sendMessage("⚠️ There is already an active raffle in this group! End it first using: rankup raffle end", threadID, messageID);
        }

        const newRaffle = {
          status: "active",
          item: item,
          coinNeeded: coinNeeded,
          participants: [],
          createdBy: senderID
        };

        await threadsData.set(threadID, newRaffle, "data.activeRaffle");

        return api.sendMessage(
          `🎉 NEW RAFFLE STARTED! 🎉\n\n` +
          `🎁 Item: ${item}\n` +
          `💰 Entry Fee: ${coinNeeded} XDRG Coins\n\n` +
          `👉 Type "rankup raffle join" to enter the giveaway!`,
          threadID,
          messageID
        );
      }

      if (action === "join" || subCommand === "join") {
        const activeRaffle = await threadsData.get(threadID, "data.activeRaffle");
        if (!activeRaffle || activeRaffle.status !== "active") {
          return api.sendMessage("❌ There is no active raffle running in this group right now!", threadID, messageID);
        }

        if (activeRaffle.participants.includes(senderID)) {
          return api.sendMessage("⚠️ You have already entered this raffle!", threadID, messageID);
        }

        const userData = await usersData.get(senderID);
        const currentCoins = userData?.data?.xdrgCoins || 0;

        if (currentCoins < activeRaffle.coinNeeded) {
          return api.sendMessage(
            `❌ You don't have enough XDRG coins to join!\n` +
            `Required: ${activeRaffle.coinNeeded} XDRG Coins\n` +
            `Your Balance: ${currentCoins} XDRG Coins\n\n` +
            `💡 Keep chatting in the group to level up and earn more coins!`,
            threadID,
            messageID
          );
        }

        const updatedCoins = currentCoins - activeRaffle.coinNeeded;
        await usersData.set(senderID, updatedCoins, "data.xdrgCoins");

        activeRaffle.participants.push(senderID);
        await threadsData.set(threadID, activeRaffle, "data.activeRaffle");

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

      if (action === "end" || action === "draw") {
        if (role < 1) {
          return api.sendMessage("❌ Only bot/group admins can end the raffle!", threadID, messageID);
        }

        const activeRaffle = await threadsData.get(threadID, "data.activeRaffle");
        if (!activeRaffle || activeRaffle.status !== "active") {
          return api.sendMessage("❌ There is no active raffle to end!", threadID, messageID);
        }

        const participants = activeRaffle.participants || [];
        if (participants.length === 0) {
          await threadsData.set(threadID, { status: "ended" }, "data.activeRaffle");
          return api.sendMessage("📢 Raffle ended! Unfortunately, nobody joined the giveaway.", threadID, messageID);
        }

        const winnerID = participants[Math.floor(Math.random() * participants.length)];
        const winnerName = (await usersData.getName(winnerID)) || "User";

        await threadsData.set(threadID, { status: "ended" }, "data.activeRaffle");

        return api.sendMessage(
          {
            body: `🏆 WINNER ANNOUNCEMENT 🏆\n\n` +
                  `🎉 Congratulations @${winnerName}!\n` +
                  `🎁 You won the item: ${activeRaffle.item}\n` +
                  `👥 Total Participants: ${participants.length}\n\n` +
                  `Brought to you by XDRG TRADE SERVICE!`,
            mentions: [{ tag: winnerName, id: winnerID }]
          },
          threadID,
          messageID
        );
      }

      if (action === "status" || action === "info") {
        const activeRaffle = await threadsData.get(threadID, "data.activeRaffle");
        if (!activeRaffle || activeRaffle.status !== "active") {
          return api.sendMessage("ℹ️ No active raffle in this group.", threadID, messageID);
        }

        return api.sendMessage(
          `📊 ACTIVE RAFFLE DETAILS 📊\n\n` +
          `🎁 Item: ${activeRaffle.item}\n` +
          `💰 Required Coins: ${activeRaffle.coinNeeded} XDRG Coins\n` +
          `👥 Current Entries: ${activeRaffle.participants.length} participant(s)`,
          threadID,
          messageID
        );
      }

      if (action) {
        if (role >= 1) {
          const rawArgs = args.slice(1);
          const coinNeeded = parseInt(rawArgs[rawArgs.length - 1]);
          if (!isNaN(coinNeeded) && coinNeeded > 0) {
            const item = rawArgs.slice(0, -1).join(" ");
            
            const activeRaffle = await threadsData.get(threadID, "data.activeRaffle");
            if (activeRaffle && activeRaffle.status === "active") {
              return api.sendMessage("⚠️ There is already an active raffle in this group! End it first using: rankup raffle end", threadID, messageID);
            }

            const newRaffle = {
              status: "active",
              item: item,
              coinNeeded: coinNeeded,
              participants: [],
              createdBy: senderID
            };

            await threadsData.set(threadID, newRaffle, "data.activeRaffle");

            return api.sendMessage(
              `🎉 NEW RAFFLE STARTED! 🎉\n\n` +
              `🎁 Item: ${item}\n` +
              `💰 Entry Fee: ${coinNeeded} XDRG Coins\n\n` +
              `👉 Type "rankup raffle join" to enter the giveaway!`,
              threadID,
              messageID
            );
          }
        }
      }

      return api.sendMessage(
        `💡 Raffle Commands:\n` +
        `• rankup raffle create <item> <coins>\n` +
        `• rankup raffle join\n` +
        `• rankup raffle status\n` +
        `• rankup raffle end`,
        threadID,
        messageID
      );
    }

    return api.sendMessage(`Usage: rankup [on/off] | rankup coins | rankup raffle`, threadID, messageID);
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
      const prevExp = userData?.data?.exp || 0;
      const currentCoins = userData?.data?.xdrgCoins || 0;
      const exp = prevExp + 1;

      await usersData.set(senderID, exp, "data.exp");

      const expToLevel = (e) =>
        Math.floor((1 + Math.sqrt(1 + (8 * e) / 5)) / 2);

      const prevLevel = expToLevel(prevExp);
      const currentLevel = expToLevel(exp);

      if (currentLevel > prevLevel && currentLevel > 1) {
        const totalCoins = currentCoins + 5;
        await usersData.set(senderID, totalCoins, "data.xdrgCoins");

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
