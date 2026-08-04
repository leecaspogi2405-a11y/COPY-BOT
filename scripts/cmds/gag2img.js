const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

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

module.exports = {
  config: {
    name: "searchimg",
    aliases: ["search", "findimg"],
    version: "1.0.0",
    author: "Dev Xdragon",
    description: "Search and retrieve an image for a specific item",
    category: "utility",
    usage: "~search img <item>",
    role: 0,
    usePrefix: false
  },

  onStart: async function () {}, 

  onChat: async function ({ api, event }) {
    const { threadID, body, messageID } = event;
    if (!body) return;

    const msg = body.trim();
    
    if (msg.toLowerCase().startsWith("~search img ")) {
      const itemQuery = msg.slice(12).trim().toLowerCase(); 

      if (!itemQuery) {
        return api.sendMessage("❌ Please specify an item to search. Example: ~search img swan", threadID, messageID);
      }

      const imageUrl = ITEM_IMAGES[itemQuery];

      if (!imageUrl) {
        return api.sendMessage(`❌ No image found for "${itemQuery}". Please check the spelling or abbreviation.`, threadID, messageID);
      }

      try {
        const cacheDir = path.join(__dirname, "cache");
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

        const imagePath = path.join(cacheDir, `search_img_${Date.now()}_${messageID}.jpg`);
        
        const imgRes = await axios({ url: imageUrl, responseType: "arraybuffer" });
        fs.writeFileSync(imagePath, Buffer.from(imgRes.data));

        return api.sendMessage({
          body: `✅ Here is the image for: ${itemQuery.toUpperCase()}`,
          attachment: fs.createReadStream(imagePath)
        }, threadID, () => {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        }, messageID);

      } catch (error) {
        console.error("Image search fetch error:", error);
        return api.sendMessage("❌ An error occurred while downloading the image.", threadID, messageID);
      }
    }
  }
};
