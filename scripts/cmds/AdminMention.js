module.exports = {
    config: {
        name: "adminMention",
        version: "1.0.2",
        author: "Xdragon",
        role: 0,
        description: "Automatically responds with randomized lines when Dev Xdragon is tagged.",
        category: "system"
    },

    onStart: async function ({ api, event }) {
        return api.sendMessage("Ang command na ito ay automatic nagre-reply kapag tinag si admin.", event.threadID, event.messageID);
    },

    onChat: async function ({ api, event }) {
        if (!event.mentions || Object.keys(event.mentions).length === 0) return;

        const adminUID = "61583174657283";

        if (!event.mentions[adminUID]) return;

        const responsePool = [
            "👉Don't tag admin, he's busy 😗",
            "👉Admin says: 'Blocked.' Just kidding... unless? 👀",
            "👉My admin is too cool for you 😎",
            "👉You tagged the admin. Now you face me. 🤖",
            "👉Oops, admin talk detected. Let's change the subject.",
            "👉Bro thinks he's special tagging the admin 💀",
            "👉Sorry, admin is offline 😪"
        ];

        const randomResponse = responsePool[Math.floor(Math.random() * responsePool.length)];

        return api.sendMessage(randomResponse, event.threadID, event.messageID);
    }
};
