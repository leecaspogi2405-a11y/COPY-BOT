const { createCanvas, loadImage } = require("canvas");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "top",
    version: "1.1.1",
    author: "Xdragon",
    description: "View the top level leaderboard of the group",
    category: "system",
    usage: "top [on/off]",
    role: 1, 
  },

  onStart: async function ({ api, event, usersData, threadsData, args }) {
    const { threadID, messageID } = event;

    try {
      if (args[0] === "on" || args[0] === "off") {
        const isOn = args[0] === "on";
        await threadsData.set(threadID, isOn, "settings.topEnabled");
        
        return api.sendMessage(
          `✅ Leaderboard command is now turned ${isOn ? "ON" : "OFF"} for this group.`,
          threadID,
          messageID
        );
      }

      const topEnabled = await threadsData.get(threadID, "settings.topEnabled");
      if (topEnabled === false) {
        return api.sendMessage(
          "❌ The leaderboard command is currently disabled. Use `top on` to enable it.",
          threadID,
          messageID
        );
      }

      const threadInfo = await api.getThreadInfo(threadID);
      const participantIDs = threadInfo.participantIDs || [];

      const allUsers = await usersData.getAll();
      
      const leaderboard = allUsers
        .filter((u) => u.data && u.data.exp && participantIDs.includes(u.userID))
        .map((u) => {
          const exp = u.data.exp;
          return {
            uid: u.userID,
            name: u.name || "Unknown User",
            exp: exp,
            level: Math.floor((1 + Math.sqrt(1 + (8 * exp) / 5)) / 2)
          };
        })
        .sort((a, b) => b.exp - a.exp)
        .slice(0, 5);

      if (leaderboard.length === 0) {
        return api.sendMessage(
          "No ranking data found yet for members in this group. Start chatting to gain EXP!",
          threadID,
          messageID
        );
      }

      const canvasWidth = 800;
      const canvasHeight = 700;
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext("2d");

      const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      gradient.addColorStop(0, "#0f172a");
      gradient.addColorStop(1, "#1e293b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.fillStyle = "#00e5ff";
      ctx.fillRect(0, 0, canvasWidth, 8);
      ctx.fillRect(0, canvasHeight - 8, canvasWidth, 8);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 50px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏆 GROUP LEADERBOARD 🏆", 400, 80);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "25px sans-serif";
      ctx.fillText("Top 5 Highest Level Users", 400, 120);

      const startY = 170;
      const rowHeight = 95;

      for (let i = 0; i < leaderboard.length; i++) {
        const user = leaderboard[i];
        const y = startY + i * rowHeight;

        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.roundRect(40, y, 720, 80, 15);
        ctx.fill();

        const rankColors = ["#fbbf24", "#cbd5e1", "#b45309", "#38bdf8", "#38bdf8"];
        ctx.fillStyle = rankColors[i] || "#ffffff";
        ctx.font = "bold 40px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`#${i + 1}`, 70, y + 55);

        try {
          const avatarUrl = `https://graph.facebook.com/${user.uid}/picture?width=128&height=128&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
          const avatar = await loadImage(avatarUrl);
          
          ctx.save();
          ctx.beginPath();
          ctx.arc(200, y + 40, 30, 0, Math.PI * 2, true);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(avatar, 170, y + 10, 60, 60);
          ctx.restore();

          ctx.beginPath();
          ctx.arc(200, y + 40, 30, 0, Math.PI * 2, true);
          ctx.strokeStyle = rankColors[i] || "#38bdf8";
          ctx.lineWidth = 3;
          ctx.stroke();
        } catch (err) {
          ctx.fillStyle = "#475569";
          ctx.beginPath();
          ctx.arc(200, y + 40, 30, 0, Math.PI * 2, true);
          ctx.fill();
        }

        const displayName = user.name.length > 16 ? user.name.substring(0, 13) + "..." : user.name;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 30px sans-serif";
        ctx.fillText(displayName, 250, y + 50);

        ctx.fillStyle = "#00e5ff";
        ctx.font = "bold 25px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`LVL ${user.level}`, 730, y + 35);
        
        ctx.fillStyle = "#94a3b8";
        ctx.font = "18px sans-serif";
        ctx.fillText(`${user.exp} EXP`, 730, y + 60);
      }

      const imagePath = path.join(__dirname, `leaderboard_${Date.now()}.png`);
      const buffer = canvas.toBuffer("image/png");
      fs.writeFileSync(imagePath, buffer);

      let textMessage = "📊 **Top 5 Group Leaderboard**\n\n";
      leaderboard.forEach((u, i) => {
         const medals = ["🥇", "🥈", "🥉", "🏅", "🏅"];
         textMessage += `${medals[i]} ${u.name} (LVL ${u.level})\n`;
      });

      await api.sendMessage({
        body: textMessage,
        attachment: fs.createReadStream(imagePath)
      }, threadID, messageID);

      fs.unlinkSync(imagePath);

    } catch (error) {
      console.error("[TOP] Leaderboard Error:", error);
      api.sendMessage("❌ An error occurred while generating the leaderboard.", threadID, messageID);
    }
  }
};
