const http = require("http");

const TOKEN = process.env.BOT_TOKEN;
const SECRET = process.env.WEBHOOK_SECRET;
const PORT = process.env.PORT || 3000;

async function sendMessage(chatId, text) {
  if (!TOKEN) {
    console.error("BOT_TOKEN is missing!");
    return;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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
  const command = text.split(" ")[0].split("@")[0];

  let reply;

  switch (command) {
    case "/start":
      reply =
        "🚀 Добро пожаловать в GROOR BOT!\n\n" +
        "Я твой многофункциональный помощник.\n\n" +
        "Напиши /help";
      break;

    case "/help":
      reply =
        "📋 GROOR BOT — команды:\n\n" +
        "/start — запуск\n" +
        "/help — помощь\n" +
        "/about — о боте\n" +
        "/ping — проверка связи\n" +
        "/id — твой ID";
      break;

    case "/about":
      reply =
        "🤖 GROOR BOT\n" +
        "Версия 1.1\n" +
        "Многофункциональный Telegram-бот!";
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

  // Главная страница
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });

    return res.end(`
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>GROOR BOT</title>
        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #080b16;
            color: white;
            font-family: Arial, sans-serif;
          }

          .card {
            width: 90%;
            max-width: 430px;
            padding: 40px 25px;
            text-align: center;
            border: 1px solid #28365b;
            border-radius: 25px;
            background: linear-gradient(145deg, #151d38, #0d1225);
            box-shadow: 0 20px 70px #0008;
          }

          h1 {
            font-size: 36px;
            margin-bottom: 10px;
          }

          p {
            color: #aab6d5;
          }

          .status {
            display: inline-block;
            margin: 20px 0;
            padding: 10px 18px;
            border-radius: 30px;
            color: #65ffac;
            background: #123c2c;
          }

          .dot {
            display: inline-block;
            width: 9px;
            height: 9px;
            margin-right: 7px;
            border-radius: 50%;
            background: #65ffac;
          }

          footer {
            margin-top: 25px;
            color: #64718e;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🤖 GROOR BOT</h1>
          <p>Многофункциональный Telegram-помощник</p>
          <div class="status">
            <span class="dot"></span>
            SERVER ONLINE
          </div>
          <p>Сервер успешно запущен!</p>
          <p>Версия 1.1</p>
          <footer>Powered by Render</footer>
        </div>
      </body>
      </html>
    `);
  }// Проверка состояния
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json"
    });

    return res.end(JSON.stringify({
      status: "online",
      bot: "GROOR BOT"
    }));
  }

  // Telegram Webhook
  if (req.method === "POST" && req.url === "/webhook") {

    if (SECRET &&
      req.headers["x-telegram-bot-api-secret-token"] !== SECRET) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 1000000) {
        req.destroy();
      }
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

  // Неизвестная страница
  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("404 — Page not found");
});

server.listen(PORT, () => {
  console.log(`GROOR BOT running on port ${PORT}`);
});
