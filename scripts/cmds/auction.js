const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

const ALLOWED_ITEMS = [
  "venom spitter", "vs",
  "moon bloom", "mb", "moon mloom",
  "hypno bloom", "hb",
  "sun bloom", "sb",
  "star fruit", "sf",
  "super watering can", "swc",
  "super sprinkler", "ss",
  "maple bamboo", "mbb",
  "maple mushroom", "mmr",
  "swan", "sn",
  "turkey", "tk",
  "fox", "fx",
  "raccoon", "rcn",
  "dragon fly", "df",
  "dragon breath", "db",
  "firefly", "ff",
  "syrup super watering can", "sswc",
  "syrup super sprinkler", "sss",
  "unicorn", "unc"
];

const imgSwan = "https://cdn.discordapp.com/attachments/1514595928928026775/1533990048817610772/orca-image-709271746.jpeg.jpg?ex=6a727f0f&is=6a712d8f&hm=54b11e476273d24a050538c22a9b922ed5c3d1b6c001bfb26081b6c95ac003ea&";
const imgStarFruit = "https://cdn.discordapp.com/attachments/1514595928928026775/1534002657696678050/orca-image-198923941.jpeg.jpg?ex=6a728acd&is=6a71394d&hm=7cc4868c32e7f08a453363219fffbf468af0264a35b1a5d588c187962c99cfc9&";
const imgMapleBamboo = "https://cdn.discordapp.com/attachments/1514595928928026775/1533990032912683183/orca-image-495485225.jpeg.jpg?ex=6a727f0c&is=6a712d8c&hm=6c287c35c980418be3e64aa70d43bcde24ee629e80610fe05838a7fc2df5ad42&";
const imgTurkey = "https://cdn.discordapp.com/attachments/1514595928928026775/1533990023601459391/orca-image-1827744625.jpeg.jpg?ex=6a727f09&is=6a712d89&hm=aae66dda520de36c72ece3ad8f13eea29ae84f4968dcb33c2343c5836dbd23b2&";
const imgMoonBloom = "https://cdn.discordapp.com/attachments/1514595928928026775/1533990013082140703/orca-image--435922342.jpeg.jpg?ex=6a727f07&is=6a712d87&hm=bb26d10eda1abb8575f26eccb7be260facc60c9d82f1b56e0a711cd03a06ef11&";
const imgHypnoBloom = "https://cdn.discordapp.com/attachments/1514595928928026775/1533989998884425879/orca-image--520245196.jpeg.jpg?ex=6a727f03&is=6a712d83&hm=e9270db262d43be1cebfc786172813d0e9ae88fbe59f0c1e09a2d5070389625d&";
const imgFirefly = "https://cdn.discordapp.com/attachments/1514595928928026775/1533989965095243817/orca-image--1206304639.jpeg.jpg?ex=6a727efb&is=6a712d7b&hm=cba7e561ae0f6957e6f66a3cccda203ad8e830a58ce84d6de981add26ff09c4a&";
const imgUnicorn = "https://cdn.discordapp.com/attachments/1514595928928026775/1534027548923789362/orca-image--2091653975.jpeg.jpg?ex=6a72a1fc&is=6a71507c&hm=a431b24f37a7b29739376866b11a91c5d13f9508ed5507fd52f6b7b2e76987da&";
const imgDragonBreath = "https://cdn.discordapp.com/attachments/1514595928928026775/1534027852217847818/orca-image-1049189034.jpeg.jpg?ex=6a72a244&is=6a7150c4&hm=b95d38a32492eeb094c7da7dc94eca698f4cae1f60880b679cd009b855704f12&";
const imgSunBloom = "https://cdn.discordapp.com/attachments/1514595928928026775/1534027867879374898/orca-image-1203346253.jpeg.jpg?ex=6a72a248&is=6a7150c8&hm=075075445fe03c3235e15dacac63b27f03cf8df9dc7ce79711b70afde028d998&";
const imgRaccoon = "https://cdn.discordapp.com/attachments/1514595928928026775/1534034990361477171/Screenshot_20260804_105735.jpg?ex=6a72a8ea&is=6a71576a&hm=3eea0fc73e453e0f9b46c856c55ee372621e0d8c26213a4066198d34a5ce826b&";
const imgSyrupSuperSprinkler = "https://cdn.discordapp.com/attachments/1514595928928026775/1534035001518325800/Screenshot_20260804_110036.jpg?ex=6a72a8ed&is=6a71576d&hm=a16b2d7b1b04104eebf8e04e48b61e5c34c567747fa24b911cae00c2f1423e7d&";
const imgSuperSprinkler = "https://cdn.discordapp.com/attachments/1514595928928026775/1534035022158237806/Screenshot_20260804_110100.jpg?ex=6a72a8f2&is=6a715772&hm=cd3ceb6f92cd86b2fa73854ae871829cef8ecfccc0da05660eb036137f9ef0ee&";
const imgSyrupSuperWateringCan = "https://cdn.discordapp.com/attachments/1514595928928026775/1534035031712858252/Screenshot_20260804_110142.jpg?ex=6a72a8f4&is=6a715774&hm=0deb04e4939124c48da5c7c60f0044bb5259efe0e27e561a1ffe0311300da364&";
const imgSuperWateringCan = "https://cdn.discordapp.com/attachments/1514595928928026775/1534035045805723668/Screenshot_20260804_105851_1.jpg?ex=6a72a8f7&is=6a715777&hm=238e15f084c67576dd6927012df8468911cbe0dd7e15cf888da12af170ea6560&";
const imgMapleMushroom = "https://cdn.discordapp.com/attachments/1514595928928026775/1534035062897512448/Screenshot_20260804_014035_com.roblox.client_1.jpg?ex=6a72a8fb&is=6a71577b&hm=c9d6826e557163c82ee73648b28a60db9fbe56c8ea4cd573b78fbd46ab6a6e80&";
const imgFox = "https://cdn.discordapp.com/attachments/1514595928928026775/1534035069172449290/Screenshot_20260804_110416.jpg?ex=6a72a8fd&is=6a71577d&hm=ad3fe45056039650631a76af56a3deb68c4a54a826de6d7a37dbee807bc85eb7&";
const imgDragonFly = "https://cdn.discordapp.com/attachments/1514595928928026775/1534035082367598623/Screenshot_20260804_110505.jpg?ex=6a72a900&is=6a715780&hm=979a61eca13c265848998aac5b7c43ccc37b74dfee8b5048a7eb4f1a29da1916&";
const imgVenomSpitter = "https://cdn.discordapp.com/attachments/1514595928928026775/1534035094124363806/Screenshot_20260804_110601.jpg?ex=6a72a903&is=6a715783&hm=c6799c197d07116994ff69c8776cd870eace36b56640a79e28d72e32c4b527c3&";

const ITEM_IMAGES = {
  "swan": imgSwan, "sn": imgSwan,
  "star fruit": imgStarFruit, "sf": imgStarFruit,
  "maple bamboo": imgMapleBamboo, "mbb": imgMapleBamboo,
  "turkey": imgTurkey, "tk": imgTurkey,
  "moon bloom": imgMoonBloom, "mb": imgMoonBloom, "moon mloom": imgMoonBloom,
  "hypno bloom": imgHypnoBloom, "hb": imgHypnoBloom,
  "firefly": imgFirefly, "ff": imgFirefly,
  "unicorn": imgUnicorn, "unc": imgUnicorn,
  "dragon breath": imgDragonBreath, "db": imgDragonBreath,
  "sun bloom": imgSunBloom, "sb": imgSunBloom,
  "raccoon": imgRaccoon, "rcn": imgRaccoon,
  "syrup super sprinkler": imgSyrupSuperSprinkler, "sss": imgSyrupSuperSprinkler,
  "super sprinkler": imgSuperSprinkler, "ss": imgSuperSprinkler,
  "syrup super watering can": imgSyrupSuperWateringCan, "sswc": imgSyrupSuperWateringCan,
  "super watering can": imgSuperWateringCan, "swc": imgSuperWateringCan,
  "maple mushroom": imgMapleMushroom, "mmr": imgMapleMushroom,
  "fox": imgFox, "fx": imgFox,
  "dragon fly": imgDragonFly, "df": imgDragonFly,
  "venom spitter": imgVenomSpitter, "vs": imgVenomSpitter
};

function parseTime(timeStr) {
  const match = timeStr.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const mults = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * mults[unit];
}

function formatDate(date) {
  return date.toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: true });
}

module.exports = {
  config: {
    name: "auction",
    aliases: ["auctionsystem", "bid"],
    version: "1.1.0",
    author: "Dev Xdragon",
    description: "Custom dual-prefix auction and bidding system with IDs and images",
    category: "system",
    usage: "~bid <amount/item> <id> | !auction <item> <currency> <time> <price> <id> | !auction show <id>",
    role: 0,
    usePrefix: false
  },

  onStart: async function () {}, 

  onChat: async function ({ api, event, usersData }) {
    const { threadID, senderID, body, messageID } = event;
    if (!body) return;
    
    const msg = body.trim();
    if (!global.xdragonAuctions) global.xdragonAuctions = {};
    if (!global.xdragonAuctions[threadID]) global.xdragonAuctions[threadID] = {};

    const threadInfo = await api.getThreadInfo(threadID);
    const isAdmin = threadInfo.adminIDs.some(admin => admin.id === senderID);

    if (msg.toLowerCase().startsWith("!auction")) {
      if (!isAdmin) {
        return api.sendMessage("❌ Only group admins can manage auctions.", threadID, messageID);
      }

      const argsStr = msg.slice(8).trim();
      if (!argsStr) return;
      const args = argsStr.split(/\s+/);

      if (args[0].toLowerCase() === "show") {
        if (args.length < 2) {
          return api.sendMessage("❌ Syntax: !auction show {Id}", threadID, messageID);
        }
        
        const auctionId = args[1];
        const auction = global.xdragonAuctions[threadID][auctionId];
        
        if (!auction) {
          return api.sendMessage(`❌ No auction found with ID: ${auctionId}`, threadID, messageID);
        }

        if (Date.now() < auction.endTime && !auction.ended) {
          return api.sendMessage(`⚠️ The auction (ID: ${auctionId}) is still ongoing!`, threadID, messageID);
        }

        if (!auction.highestBidder) {
          return api.sendMessage(`😔 The auction (ID: ${auctionId}) ended with no valid bids.`, threadID, messageID);
        }

        try {
          const winnerName = await usersData.getName(auction.highestBidder);
          const cacheDir = path.join(__dirname, "cache");
          if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
          
          const avatarUrl = `https://graph.facebook.com/${auction.highestBidder}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
          const avatarPath = path.join(cacheDir, `auc_av_${auction.highestBidder}_${auctionId}.jpg`);
          
          const avatarRes = await axios({ url: avatarUrl, responseType: "arraybuffer" });
          fs.writeFileSync(avatarPath, avatarRes.data);

          const canvas = createCanvas(600, 250);
          const ctx = canvas.getContext("2d");

          ctx.fillStyle = "#1e1e1e";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.fillStyle = "#2a2a2a";
          ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);

          const img = await loadImage(avatarPath);
          ctx.save();
          ctx.beginPath();
          ctx.arc(125, 125, 90, 0, Math.PI * 2, true);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, 35, 35, 180, 180);
          ctx.restore();

          ctx.font = "bold 35px Arial";
          ctx.fillStyle = "#ffffff";
          ctx.fillText("AUCTION WINNER", 240, 80);

          ctx.font = "28px Arial";
          ctx.fillStyle = "#ffd700";
          ctx.fillText(winnerName, 240, 140);

          ctx.font = "24px Arial";
          ctx.fillStyle = "#cccccc";
          ctx.fillText(`Bid: ${auction.highestBid}`, 240, 190);

          const canvasPath = path.join(cacheDir, `auc_winner_${Date.now()}_${auctionId}.png`);
          fs.writeFileSync(canvasPath, canvas.toBuffer("image/png"));

          const syncDate = formatDate(new Date(auction.endTime));
          const messageText = 
`Name:${winnerName}
Reward:${auction.item}
Bid:${auction.highestBid}
Time & date:${syncDate}
Winner:@${winnerName}
ID:${auctionId}
-----------------------------
Join at this group to bid!👇

https://m.me/j/AbYXMAaQa7zCrYOi/?send_source=gc%3Acopy_invite_link_c

Powered by:[Dev Xdragon]`;

          await api.sendMessage({
            body: messageText,
            mentions: [{ tag: `@${winnerName}`, id: auction.highestBidder }],
            attachment: fs.createReadStream(canvasPath)
          }, threadID);

          fs.unlinkSync(avatarPath);
          fs.unlinkSync(canvasPath);
          
        } catch (error) {
          console.error(error);
          api.sendMessage("❌ Error generating winner canvas.", threadID, messageID);
        }
        return;
      }

      if (args.length < 5) {
        return api.sendMessage("❌ Syntax: !auction {item} {🍁/🪙} {time} {lower price} {Id}", threadID, messageID);
      }

      const auctionId = args.pop();
      const lowerPrice = parseFloat(args.pop());
      const timeStr = args.pop();
      const currency = args.pop();
      const item = args.join(" ");
      
      const duration = parseTime(timeStr);
      if (!duration) {
        return api.sendMessage("❌ Invalid time format. Use s, m, h, or d (e.g., 10m, 1h).", threadID, messageID);
      }

      if (isNaN(lowerPrice)) {
        return api.sendMessage("❌ Invalid lower price.", threadID, messageID);
      }

      if (global.xdragonAuctions[threadID][auctionId] && !global.xdragonAuctions[threadID][auctionId].ended) {
        return api.sendMessage(`❌ An active auction with ID ${auctionId} already exists!`, threadID, messageID);
      }

      const endMs = Date.now() + duration;
      const endDate = new Date(endMs);

      global.xdragonAuctions[threadID][auctionId] = {
        item: item,
        currency: currency,
        lowerPrice: lowerPrice,
        endTime: endMs,
        highestBidder: null,
        highestBidVal: lowerPrice - 1, 
        highestBid: "None",
        ended: false
      };

      const allMention = threadInfo.participantIDs.map(id => ({ tag: "@everyone", id }));
      
      const startMsg = 
`Reward/Auction:${item}
Bid allowed:${currency}¢/item
Time end:${formatDate(endDate)}
Lower bid:${lowerPrice}
ID:${auctionId}
------------------------------
@everyone
Powered by:Dev Xdragon`;

      let msgObject = { body: startMsg, mentions: allMention };
      let imagePath = null;
      
      const itemKey = item.toLowerCase().trim();
      if (ITEM_IMAGES[itemKey]) {
        try {
          const cacheDir = path.join(__dirname, "cache");
          if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
          
          imagePath = path.join(cacheDir, `auc_item_${Date.now()}_${auctionId}.jpg`);
          const imgRes = await axios({ url: ITEM_IMAGES[itemKey], responseType: "arraybuffer" });
          fs.writeFileSync(imagePath, Buffer.from(imgRes.data));
          
          msgObject.attachment = fs.createReadStream(imagePath);
        } catch (err) {
          console.error("Failed to load item image:", err);
        }
      }

      api.sendMessage(msgObject, threadID, (err, info) => {
        if (imagePath && fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      });

      setTimeout(() => {
        if (global.xdragonAuctions[threadID] && global.xdragonAuctions[threadID][auctionId]) {
          global.xdragonAuctions[threadID][auctionId].ended = true;
          api.sendMessage(`🔔 The auction for ID: ${auctionId} has ended! Admin can type '!auction show ${auctionId}' to reveal the winner.`, threadID);
        }
      }, duration);

      return;
    }

    if (msg.toLowerCase().startsWith("~bid ")) {
      const rawArgsStr = msg.slice(5).trim();
      const args = rawArgsStr.split(/\s+/);
      
      if (args.length < 2) {
         return api.sendMessage("❌ Syntax: ~bid {amount/item} {Id}", threadID, messageID);
      }

      const auctionId = args.pop();
      const rawBid = args.join(" ");
      
      const auction = global.xdragonAuctions[threadID][auctionId];

      if (!auction || auction.ended || Date.now() >= auction.endTime) {
        return api.sendMessage(`❌ There is no active auction right now for ID: ${auctionId}.`, threadID, messageID);
      }

      let bidValue = 0;
      let isItemBid = false;

      if (rawBid.startsWith("🍁¢:") || rawBid.startsWith("🪙¢:")) {
        const numPart = rawBid.split(":")[1];
        bidValue = parseFloat(numPart);
        
        if (isNaN(bidValue) || bidValue <= 0) {
          return api.sendMessage("❌ Invalid bid amount.", threadID, messageID);
        }
        
        const bidCurrency = rawBid.split("¢")[0];
        if (bidCurrency !== auction.currency && auction.currency !== "🍁/🪙") {
           return api.sendMessage(`❌ This auction only accepts ${auction.currency} or items.`, threadID, messageID);
        }
      } else {
        if (!ALLOWED_ITEMS.includes(rawBid.toLowerCase())) {
          return api.sendMessage("❌ Invalid item for bidding. Please check the accepted items list.", threadID, messageID);
        }
        isItemBid = true;
        bidValue = auction.highestBidVal + 1; 
      }

      if (!isItemBid && bidValue <= auction.highestBidVal) {
        return api.sendMessage(`❌ Your bid must be higher than the current highest bid/lower price!`, threadID, messageID);
      }

      auction.highestBidder = senderID;
      auction.highestBidVal = bidValue;
      auction.highestBid = rawBid;

      api.sendMessage(`✅ Bid accepted for ID: ${auctionId}! You are currently the highest bidder with: ${rawBid}`, threadID, messageID);
    }
  }
};
