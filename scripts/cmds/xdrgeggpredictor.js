// ==================== EGG SPAWN PREDICTOR - ALL-IN-ONE ====================
// Server + Roblox Script + Website + GoatBot Command
// Run: npm install ws && node eggs-predictor-all-in-one.js

const http = require("http");
const { WebSocketServer } = require("ws");
const fs = require("fs");
const path = require("path");

const PORT = 8080;

// ==================== SERVER ====================
let latestState = null;
const siteClients = new Set();

const server = http.createServer((req, res) => {
  // Serve index.html
  if (req.url === "/" || req.url === "/index.html") {
    fs.readFile(path.join(__dirname, "index.html"), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Error loading index.html - create it first");
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
      }
    });
  }
  // REST API
  else if (req.url === "/api/state") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(latestState || { ok: false, msg: "no data yet" }));
  }
  // Serve predictor.lua
  else if (req.url === "/predictor.lua") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(PREDICTOR_LUA);
  }
  // Serve goatbot command
  else if (req.url === "/goatbot-egg.js") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(GOATBOT_CMD);
  }
  else {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("egg predictor relay running");
  }
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket, req) => {
  if (req.url.includes("roblox")) {
    console.log("[+] roblox client connected");
    socket.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        latestState = parsed;
        for (const client of siteClients) {
          if (client.readyState === 1) client.send(data.toString());
        }
        if (parsed.kind === "reveal" && parsed.history && parsed.history[0]) {
          const t = parsed.history[0];
          if (t.targets && t.targets.length) {
            console.log(`[RARE] ${t.manila} -> ${t.targets.map((x) => x.rarity).join("+")}`);
          }
        }
      } catch (e) {
        console.log("bad json from roblox");
      }
    });
    socket.on("close", () => console.log("[-] roblox disconnected"));
  } else {
    siteClients.add(socket);
    console.log(`[+] website client (${siteClients.size} total)`);
    if (latestState) socket.send(JSON.stringify(latestState));
    socket.on("close", () => siteClients.delete(socket));
  }
});

// ==================== INDEX.HTML ====================
const INDEX_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Egg Spawn Predictor</title>
  <style>
    body { background: #0d0d12; color: #e8e8f0; font-family: monospace; margin: 24px; }
    h1 { color: #ffd750; font-size: 22px; }
    h2 { color: #9aa; font-size: 16px; }
    .card { background: #17171f; border: 1px solid #2a2a35; border-radius: 10px;
            padding: 14px; max-width: 620px; margin-bottom: 18px; }
    .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
    .Secret   { color: #ff5b5b; font-weight: bold; }
    .Eternal  { color: #e63ceb; font-weight: bold; }
    .Divine   { color: #ffbe28; font-weight: bold; }
    .muted { color: #77778a; }
    #status { color: #8be98b; }
    #reset b { color: #ffd750; }
  </style>
</head>
<body>
  <h1>EGG SPAWN PREDICTOR</h1>
  <div class="card">
    <div class="row"><span>Status</span><span id="status">connecting...</span></div>
    <div class="row"><span>Manila now</span><span id="now">-</span></div>
    <div class="row"><span>Next reset</span><span id="reset">-</span></div>
    <div class="row"><span>Period</span><span id="period">-</span></div>
    <div class="row"><span>Rare found total</span><span id="rarecount">0</span></div>
  </div>
  <h2>Live feed (Asia/Manila)</h2>
  <div class="card" id="feed"><span class="muted">waiting for data...</span></div>
<script>
  const WS_URL = "ws://" + location.hostname + ":8080/site";
  let resetAtMs = null, resetManila = "";
  const $ = (id) => document.getElementById(id);
  function fmtIn(sec) {
    sec = Math.max(0, Math.floor(sec));
    return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
  }
  function render(s) {
    if (!s || !s.manilaNow) return;
    $("now").textContent = s.manilaNow;
    $("period").textContent = s.periodIndex ?? "-";
    $("rarecount").textContent = s.rareFound ?? 0;
    if (s.nextResetAt) {
      resetAtMs = s.nextResetAt * 1000;
      resetManila = s.nextResetManila || "";
      tick();
    }
    const feed = $("feed");
    feed.innerHTML = "";
    for (const entry of (s.history || []).slice(0, 15)) {
      const div = document.createElement("div");
      div.className = "row";
      if (entry.targets && entry.targets.length) {
        const names = entry.targets.map((t) => t.rarity).join("+");
        const cls = entry.targets[0].rarity.toLowerCase();
        div.innerHTML = "<span>" + entry.manila + "</span><span class=\\"" + cls + "\\">" + names + " SPAWNED</span>";
      } else {
        div.innerHTML = "<span>" + entry.manila + "</span><span class=\\"muted\\">period " + entry.period + " - no rare</span>";
      }
      feed.appendChild(div);
    }
  }
  function tick() {
    if (!resetAtMs) return;
    $("reset").innerHTML = "<b>" + fmtIn((resetAtMs - Date.now()) / 1000) + "</b> (" + resetManila + ")";
  }
  setInterval(tick, 1000);
  function connect() {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => { $("status").textContent = "connected"; };
    ws.onclose = () => { $("status").textContent = "disconnected - retrying..."; setTimeout(connect, 3000); };
    ws.onmessage = (ev) => { try { render(JSON.parse(ev.data)); } catch (e) {} };
  }
  connect();
</script>
</body>
</html>`;

// ==================== PREDICTOR.LUA ====================
const PREDICTOR_LUA = `--[[
    EGG SPAWN PREDICTOR - Roblox side
    Secret / Eternal / Divine | all worlds | Asia/Manila time
]]

if getgenv().EGGPREDICT_UNLOAD then pcall(getgenv().EGGPREDICT_UNLOAD) task.wait(0.3) end

local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")

local LP = Players.LocalPlayer
local okEggs, EggCmds = pcall(require, RS.Library.Client.EggCmds)

local PERIOD = 300
local MANILA_OFFSET = 8 * 3600

local cfg = {
    wsUrl = "",
    httpUrl = "",
    saveFile = "egg_predict.json",
    targets = { Secret = true, Eternal = true, Divine = true },
    telegramToken = "",
    telegramChat = "",
    facebookToken = "",
    facebookPsid = "",
    notifyOnline = true,
    notifyResets = false,
}

local S = {
    periodIndex = nil,
    nextResetAt = nil,
    lastRevealManila = "-",
    revealCount = 0,
    rareFound = 0,
    history = {},
}

local conns = {}
local function hook(c) table.insert(conns, c) return c end

local function manilaTime(epoch)
    return os.date("!%Y-%m-%d %H:%M:%S", math.floor((epoch or 0) + MANILA_OFFSET)) .. " PHT"
end

local function fmtIn(sec)
    sec = math.max(0, math.floor(sec))
    return string.format("%02d:%02d", math.floor(sec / 60), sec % 60)
end

-- UI
local gui = Instance.new("ScreenGui")
gui.Name = "EggPredict"
gui.ResetOnSpawn = false
pcall(function() gui.Parent = LP:WaitForChild("PlayerGui") end)
if not gui.Parent then gui.Parent = game:GetService("CoreGui") end

local frame = Instance.new("Frame")
frame.Size = UDim2.fromOffset(280, 300)
frame.Position = UDim2.new(0.02, 0, 0.22, 0)
frame.BackgroundColor3 = Color3.fromRGB(24, 24, 30)
frame.BorderSizePixel = 0
frame.Active = true
frame.Draggable = true
frame.Parent = gui
Instance.new("UICorner", frame).CornerRadius = UDim.new(0, 8)

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, 0, 0, 28)
title.BackgroundTransparency = 1
title.Text = "EGG SPAWN PREDICTOR"
title.TextColor3 = Color3.fromRGB(255, 215, 80)
title.Font = Enum.Font.GothamBold
title.TextSize = 16
title.Parent = frame

local clockLabel = Instance.new("TextLabel")
clockLabel.Size = UDim2.new(1, -16, 0, 18)
clockLabel.Position = UDim2.new(0, 8, 0, 28)
clockLabel.BackgroundTransparency = 1
clockLabel.Text = "--:--:-- PHT"
clockLabel.TextColor3 = Color3.fromRGB(160, 220, 255)
clockLabel.Font = Enum.Font.Code
clockLabel.TextSize = 14
clockLabel.TextXAlignment = Enum.TextXAlignment.Left
clockLabel.Parent = frame

local resetLabel = Instance.new("TextLabel")
resetLabel.Size = UDim2.new(1, -16, 0, 18)
resetLabel.Position = UDim2.new(0, 8, 0, 46)
resetLabel.BackgroundTransparency = 1
resetLabel.Text = "next reset --"
resetLabel.TextColor3 = Color3.fromRGB(200, 200, 210)
resetLabel.Font = Enum.Font.Code
resetLabel.TextSize = 13
resetLabel.TextXAlignment = Enum.TextXAlignment.Left
resetLabel.Parent = frame

local statusLabel = Instance.new("TextLabel")
statusLabel.Size = UDim2.new(1, -16, 0, 16)
statusLabel.Position = UDim2.new(0, 8, 0, 64)
statusLabel.BackgroundTransparency = 1
statusLabel.Text = "listening..."
statusLabel.TextColor3 = Color3.fromRGB(140, 240, 140)
statusLabel.Font = Enum.Font.Gotham
statusLabel.TextSize = 12
statusLabel.TextXAlignment = Enum.TextXAlignment.Left
statusLabel.Parent = frame

local feedHolder = Instance.new("ScrollingFrame")
feedHolder.Size = UDim2.new(1, -12, 1, -92)
feedHolder.Position = UDim2.new(0, 6, 0, 84)
feedHolder.BackgroundTransparency = 1
feedHolder.BorderSizePixel = 0
feedHolder.ScrollBarThickness = 3
feedHolder.CanvasSize = UDim2.new()
feedHolder.AutomaticCanvasSize = Enum.AutomaticSize.Y
feedHolder.Parent = frame
Instance.new("UIListLayout", feedHolder).Padding = UDim.new(0, 2)

local RARITY_COLORS = {
    Secret = Color3.fromRGB(255, 70, 70),
    Eternal = Color3.fromRGB(230, 60, 235),
    Divine = Color3.fromRGB(255, 190, 40),
}

local feedDirty = false
local function setStatusFeed(t) statusLabel.Text = tostring(t) end

local function updateUI()
    local now = workspace:GetServerTimeNow()
    local idx = math.floor(now / PERIOD)
    local nextReset = (idx + 1) * PERIOD
    clockLabel.Text = manilaTime(now)
    resetLabel.Text = ("next reset %s (%s)"):format(fmtIn(nextReset - now), manilaTime(nextReset):sub(12))
    if feedDirty then
        feedDirty = false
        for _, c in ipairs(feedHolder:GetChildren()) do
            if c:IsA("TextLabel") then c:Destroy() end
        end
        for i, entry in ipairs(S.history) do
            if i > 14 then break end
            local row = Instance.new("TextLabel")
            row.Size = UDim2.new(1, -4, 0, 16)
            row.BackgroundTransparency = 1
            row.Font = Enum.Font.Code
            row.TextSize = 11
            row.TextXAlignment = Enum.TextXAlignment.Left
            row.TextTruncate = Enum.TextTruncate.AtEnd
            if #entry.targets > 0 then
                local names = {}
                for _, t in ipairs(entry.targets) do names[#names+1] = t.rarity end
                row.Text = ("%s  !!! %s"):format(entry.manila:sub(12), table.concat(names, "+"))
                row.TextColor3 = RARITY_COLORS[entry.targets[1].rarity] or Color3.fromRGB(255, 120, 120)
            else
                row.Text = ("%s  period %d - no rare"):format(entry.manila:sub(12), entry.period or -1)
                row.TextColor3 = Color3.fromRGB(110, 110, 120)
            end
            row.Parent = feedHolder
        end
    end
end

local function encodeState(kind)
    local now = workspace:GetServerTimeNow()
    local idx = math.floor(now / PERIOD)
    local nextReset = (idx + 1) * PERIOD
    return {
        kind = kind,
        player = LP.Name,
        serverNow = math.floor(now),
        manilaNow = manilaTime(now),
        periodIndex = S.periodIndex or idx,
        nextResetAt = nextReset,
        nextResetIn = math.max(0, nextReset - now),
        nextResetManila = manilaTime(nextReset),
        revealCount = S.revealCount,
        rareFound = S.rareFound,
        history = S.history,
    }
end

local wsConn = nil
local function wsSend(json)
    if wsConn then pcall(function() wsConn:Send(json) end) end
end

task.spawn(function()
    while gui.Parent do
        if cfg.wsUrl ~= "" and not wsConn then
            pcall(function()
                wsConn = (WebSocket.connect or WebSocket.Connect)(cfg.wsUrl .. "/roblox")
                setStatusFeed("ws connected")
            end)
        end
        task.wait(3)
    end
end)

local notifyQueue = {}
local lastNotify = 0

local function httpPostJson(url, bodyTable)
    local req = request or http_request
    if not req then return false end
    return pcall(function()
        req({ Url = url, Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = HttpService:JSONEncode(bodyTable) })
    end)
end

task.spawn(function()
    while true do
        local msg = table.remove(notifyQueue, 1)
        if msg then
            local nowT = os.clock()
            if nowT - lastNotify < 1.1 then task.wait(1.1 - (nowT - lastNotify)) end
            lastNotify = os.clock()
            pcall(function()
                if cfg.telegramToken ~= "" and cfg.telegramChat ~= "" then
                    httpPostJson("https://api.telegram.org/bot" .. cfg.telegramToken .. "/sendMessage",
                        { chat_id = cfg.telegramChat, text = msg.text, parse_mode = "HTML", disable_web_page_preview = true })
                end
                if cfg.facebookToken ~= "" and cfg.facebookPsid ~= "" then
                    httpPostJson("https://graph.facebook.com/v18.0/me/messages?access_token=" .. cfg.facebookToken,
                        { recipient = { id = cfg.facebookPsid }, message = { text = msg.textPlain } })
                end
            end)
        else
            task.wait(0.3)
        end
    end
end)

local function sendNotify(textHtml)
    if textHtml == nil then return end
    if cfg.telegramToken == "" and cfg.facebookToken == "" then return end
    table.insert(notifyQueue, { text = textHtml, textPlain = textHtml:gsub("<[^>]+>", "") })
end

local function pushOut(kind)
    task.spawn(function()
        pcall(function()
            local json = HttpService:JSONEncode(encodeState(kind))
            wsSend(json)
            if cfg.httpUrl ~= "" then
                local req = request or http_request
                if req then
                    req({ Url = cfg.httpUrl, Method = "POST",
                        Headers = { ["Content-Type"] = "application/json" }, Body = json })
                end
            end
            if writefile then writefile(cfg.saveFile, json) end
        end)
    end)
end

local function recordReveal(payload)
    S.periodIndex = payload.PeriodIndex
    local nowT = workspace:GetServerTimeNow()
    S.revealCount += 1
    S.lastRevealManila = manilaTime(nowT)

    local entry = {
        t = math.floor(nowT),
        manila = manilaTime(nowT),
        period = payload.PeriodIndex,
        dayStartsAt = payload.DayStartsAt,
        dayStartsManila = manilaTime(payload.DayStartsAt),
        targets = {},
        all = {},
    }
    for _, r in ipairs(payload.RareSpawns or {}) do
        local item = { rarity = tostring(r.RarityId), message = tostring(r.Message), eggUid = tostring(r.EggUid) }
        table.insert(entry.all, item)
        if cfg.targets[item.rarity] then
            table.insert(entry.targets, item)
            S.rareFound += 1
        end
    end
    table.insert(S.history, 1, entry)
    while #S.history > 60 do table.remove(S.history) end
    feedDirty = true

    if #entry.targets > 0 then
        local names = {}
        for _, t in ipairs(entry.targets) do names[#names+1] = t.rarity end
        setStatusFeed("!!! " .. table.concat(names, " + ") .. " !!!")
        local detailLines = {}
        for _, t in ipairs(entry.targets) do
            detailLines[#detailLines+1] = "• " .. t.rarity .. " — " .. t.message
        end
        sendNotify("<b>🥚 RARE EGG SPAWNED</b>\\n" .. table.concat(detailLines, "\\n") .. "\\nPeriod: " .. tostring(payload.PeriodIndex) .. "\\nTime: <b>" .. entry.manila .. "</b>")
    end
    updateUI()
    pushOut("reveal")
end

hook(EggCmds.AreaEggRareSpawnsRevealed:Connect(recordReveal))
hook(EggCmds.AreaEggResetStartCountdown:Connect(function(p)
    S.nextResetAt = p.DayStartsAt
    if cfg.notifyResets then sendNotify("⏰ Egg reset in ~9s | " .. manilaTime(p.DayStartsAt)) end
    pushOut("countdown")
    updateUI()
end))

task.spawn(function()
    while gui.Parent do
        task.wait(10)
        pcall(function()
            local has, payload = EggCmds.RequestAreaEggRareSpawnPresentations()
            if has and typeof(payload) == "table" and payload.PeriodIndex ~= S.lastPolled then
                S.lastPolled = payload.PeriodIndex
                recordReveal(payload)
            end
        end)
    end
end)

task.spawn(function()
    while gui.Parent do
        task.wait(1)
        updateUI()
    end
end)

updateUI()
print("[EGGPREDICT] loaded")

getgenv().EGGPREDICT = {
    GetState = function() return encodeState("poll") end,
    Json = function() return HttpService:JSONEncode(encodeState("poll")) end,
    SetWsUrl = function(u) cfg.wsUrl = u or "" end,
    SetHttpUrl = function(u) cfg.httpUrl = u or "" end,
    SetTelegram = function(token, chat) cfg.telegramToken, cfg.telegramChat = token or "", chat or "" end,
    SetFacebook = function(pageToken, psid) cfg.facebookToken, cfg.facebookPsid = pageToken or "", psid or "" end,
    TestNotify = function() sendNotify("🥚 EGG SPAWN PREDICTOR online | " .. manilaTime(workspace:GetServerTimeNow())) end,
    State = S,
}

if cfg.notifyOnline and (cfg.telegramToken ~= "" or cfg.facebookToken ~= "") then
    sendNotify("🥚 EGG SPAWN PREDICTOR online | " .. manilaTime(workspace:GetServerTimeNow()))
end

getgenv().EGGPREDICT_UNLOAD = function()
    for _, c in ipairs(conns) do pcall(function() c:Disconnect() end) end
    table.clear(conns)
    pcall(function() if wsConn then wsConn:Close() end end)
    pcall(function() gui:Destroy() end)
    getgenv().EGGPREDICT_UNLOAD = nil
    print("[EGGPREDICT] unloaded")
end`;

// ==================== GOATBOT COMMAND ====================
const GOATBOT_CMD = `const http = require("http");
const RELAY = "http://localhost:8080/api/state";

module.exports = {
    config: {
        name: "eggs",
        version: "1.0",
        author: "Dev Xdragon",
        role: 0,
        shortDescription: "Steal An Egg rare spawn predictor",
        longDescription: "Secret/Eternal/Divine egg spawn alerts (Asia/Manila time)",
        category: "utility",
        guide: "{pn} [on|off]"
    },
    onStart: async function ({ message, args, event }) {
        const sub = (args[0] || "").toLowerCase();
        global.__eggAlertThreads = global.__eggAlertThreads || new Set();
        if (sub === "on") {
            global.__eggAlertThreads.add(event.threadID);
            return message.reply("✅ auto-alert ON for this thread");
        }
        if (sub === "off") {
            global.__eggAlertThreads.delete(event.threadID);
            return message.reply("❌ auto-alert OFF");
        }
        http.get(RELAY, (res) => {
            let body = "";
            res.on("data", (c) => (body += c));
            res.on("end", () => {
                try {
                    const s = JSON.parse(body);
                    if (!s.manilaNow) return message.reply("no predictor data yet");
                    const last = (s.history || []).find((h) => h.targets && h.targets.length);
                    let msg = "🥚 EGG SPAWN PREDICTOR\\n🕒 " + s.manilaNow + "\\n⏰ next reset in " + Math.floor((s.nextResetIn || 0) / 60) + "m " + ((s.nextResetIn || 0) % 60) + "s (" + (s.nextResetManila || "") + ")\\n#️⃣ period: " + (s.periodIndex ?? "-") + "\\n✨ rares so far: " + (s.rareFound ?? 0);
                    if (last) {
                        msg += "\\n\\n🔥 LAST RARE:\\n";
                        for (const t of last.targets) msg += "• " + t.rarity + " — " + t.message + "\\n";
                        msg += "🕒 " + last.manila;
                    } else {
                        msg += "\\n\\n(no rare eggs revealed yet)";
                    }
                    message.reply(msg);
                } catch (e) {
                    message.reply("relay error: " + e.message);
                }
            });
        }).on("error", () => message.reply("relay offline - start server.js first"));
    },
    onLoad: function () {
        if (global.__eggPollerStarted) return;
        global.__eggPollerStarted = true;
        setInterval(() => {
            const threads = global.__eggAlertThreads;
            const api = global.GoatBot && global.GoatBot.api;
            if (!threads || threads.size === 0 || !api) return;
            http.get(RELAY, (res) => {
                let body = "";
                res.on("data", (c) => (body += c));
                res.on("end", () => {
                    try {
                        const s = JSON.parse(body);
                        const top = (s.history || [])[0];
                        if (!top || !top.targets || !top.targets.length) return;
                        const key = "rare_" + (top.t || 0) + "_" + (top.period || 0);
                        if (global.__eggLastRareKey === key) return;
                        global.__eggLastRareKey = key;
                        let msg = "🚨 RARE EGG ALERT 🚨\\n";
                        for (const t of top.targets) msg += "• " + t.rarity + " — " + t.message + "\\n";
                        msg += "🕒 " + top.manila;
                        for (const threadID of threads) {
                            api.sendMessage(msg, threadID);
                        }
                    } catch (e) {}
                });
            });
        }, 15000);
    }
};`;

// ==================== WRITE FILES ====================
fs.writeFileSync(path.join(__dirname, "index.html"), INDEX_HTML);
fs.writeFileSync(path.join(__dirname, "predictor.lua"), PREDICTOR_LUA);
fs.writeFileSync(path.join(__dirname, "goatbot-egg.js"), GOATBOT_CMD);

server.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log("🥚 EGG SPAWN PREDICTOR - ALL-IN-ONE");
  console.log("=".repeat(50));
  console.log(`  Server:    http://0.0.0.0:${PORT}`);
  console.log(`  Website:   http://localhost:${PORT}`);
  console.log(`  REST API:  GET /api/state`);
  console.log(`  Predictor: http://localhost:${PORT}/predictor.lua`);
  console.log(`  GoatBot:   http://localhost:${PORT}/goatbot-egg.js`);
  console.log(`  WS (Roblox): ws://<ip>:${PORT}/roblox`);
  console.log(`  WS (Site):   ws://<ip>:${PORT}/site`);
  console.log("=".repeat(50));
  console.log("  Files created: index.html, predictor.lua, goatbot-egg.js");
  console.log("=".repeat(50));
});
