
const http = require("http");

const TOKEN = process.env.BOT_TOKEN;
const SECRET = process.env.WEBHOOK_SECRET;

const PORT = process.env.PORT || 3000;

async function sendMessage(chatId, text) {
  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    }
  );

  if (!response.ok) {
    console.error("Telegram error:", await response.text());
  }
}

async function handleUpdate(update) {
  const message = update.message;

  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim().toLowerCase();

  let reply;

  switch (text.split(" ")[0]) {
    case "/start":
      reply = "🚀 Добро пожаловать в GROOR BOT!\n\nЯ твой многофункциональный помощник.\n\nНапиши /help";
      break;

    case "/help":
      reply = "📋 GROOR BOT — команды:\n\n/start — запуск\n/help — помощь\n/about — о боте\n/ping — проверка связи\n/id — твой ID";
      break;

    case "/about":
      reply = "🤖 GROOR BOT\nВерсия 1.0\nМногофункциональный Telegram-бот!";
      break;

    case "/ping":
      reply = "🏓 Pong! Я работаю!";
      break;

    case "/id":
      reply = `🆔 Твой Telegram ID: ${chatId}`;
      break;

    default:
      reply = "🤔 Не знаю такую команду.\nНапиши /help";
  }

  await sendMessage(chatId, reply);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      bot: "GROOR BOT",
      status: "online"
    }));
  }

  if (req.method === "POST" && req.url === "/webhook") {
    if (SECRET && req.headers["x-telegram-bot-api-secret-token"] !== SECRET) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    let body = "";

    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1000000) req.destroy();
    });

    req.on("end", async () => {
      res.writeHead(200);
      res.end("OK");

      try {
        await handleUpdate(JSON.parse(body));
      } catch (error) {
        console.error("Update error:", error);
      }
    });

    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`GROOR BOT running on port ${PORT}`);
});
