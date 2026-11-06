const http = require("http");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.BOT_TOKEN;
const SECRET = process.env.WEBHOOK_SECRET;
const ADMIN_ID = process.env.ADMIN_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
  console.error("ERROR: BOT_TOKEN is missing!");
  process.exit(1);
}

const DB_FILE = path.join(__dirname, "database.json");

let db = {
  users: {},
  stats: {
    messages: 0,
    started: 0
  }
};

try {
  if (fs.existsSync(DB_FILE)) {
    db = {
      ...db,
      ...JSON.parse(fs.readFileSync(DB_FILE, "utf8"))
    };
  }
} catch (e) {
  console.error("Database loading error:", e);
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("Database saving error:", e);
  }
}

const sessions = {};

const jokes = [
  "Почему программист не любит природу? Там слишком много багов! 🐛",
  "Что сказал ноль восьмёрке? Классный ремень!",
  "Почему компьютер замёрз? Открыл слишком много окон!",
  "Мой компьютер такой умный, что иногда даже я его не понимаю.",
  "Почему скелет не пошёл на вечеринку? Ему было не с кем идти."
];

const facts = [
  "У осьминога три сердца.",
  "Молния может быть горячее поверхности Солнца.",
  "Мёд при правильном хранении может сохраняться очень долго.",
  "У акул скелет состоит преимущественно из хряща.",
  "На Венере сутки длиннее года."
];

const riddles = [
  {
    q: "Что можно увидеть с закрытыми глазами?",
    a: "Сон"
  },
  {
    q: "Чем больше из неё берёшь, тем больше она становится. Что это?",
    a: "Яма"
  },
  {
    q: "Без окон, без дверей, полна горница людей.",
    a: "Огурец"
  },
  {
    q: "Что принадлежит тебе, но другие используют чаще?",
    a: "Имя"
  }
];

const quiz = [
  {
    q: "Какая планета самая большая?",
    options: ["Земля", "Юпитер", "Марс"],
    answer: 1
  },
  {
    q: "Сколько сторон у шестиугольника?",
    options: ["5", "6", "8"],
    answer: 1
  },
  {
    q: "Какой моб взрывается в Minecraft?",
    options: ["Крипер", "Скелет", "Корова"],
    answer: 0
  },
  {
    q: "Столица Японии?",
    options: ["Осака", "Токио", "Киото"],
    answer: 1
  }
];

function getUser(id, name) {
  if (!db.users[id]) {
    db.users[id] = {
      name: name || "Игрок",
      messages: 0,
      points: 0,
      wins: 0,
      language: "ru",
      joined: new Date().toISOString()
    };

    saveDB();
  }

  if (name) db.users[id].name = name;

  return db.users[id];
}

async function telegram(method, data = {}) {
  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    }
  );

  const result = await response.json();

  if (!result.ok) {
    console.error("Telegram API error:", result);
  }

  return result;
}

async function send(chatId, text, keyboard) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: keyboard
      ? { inline_keyboard: keyboard }
      : undefined
  });
}

async function answerCallback(id, text) {
  return telegram("answerCallbackQuery", {
    callback_query_id: id,
    text: text || ""
  });
}

function mainMenu() {
  return [
    [
      { text: "🌍 Переводчик", callback_data: "translate" },
      { text: "🌤️ Погода", callback_data: "weather" }
    ],
    [
      { text: "🔎 Поиск", callback_data: "search" },
      { text: "🧮 Калькулятор", callback_data: "calc" }
    ],
    [
      { text: "🎮 Игры", callback_data: "games" },
      { text: "😂 Развлечения", callback_data: "fun" }
    ],
    [
      { text: "👤 Профиль", callback_data: "profile" },
      { text: "⚙️ Помощь", callback_data: "help" }
    ]
  ];
}

async function translate(text, from, to) {
  const url = new URL(
    "https://api.mymemory.translated.net/get"
  );

  url.searchParams.set("q", text.slice(0, 450));
  url.searchParams.set("langpair", `${from}|${to}`);

  const response = await fetch(url);
  const data = await response.json();

  if (data.responseStatus !== 200) {
    throw new Error("Translation unavailable");
  }

  return data.responseData.translatedText;
}

async function weather(city) {
  const geoURL = new URL(
    "https://geocoding-api.open-meteo.com/v1/search"
  );

  geoURL.searchParams.set("name", city);
  geoURL.searchParams.set("count", "1");
  geoURL.searchParams.set("language", "ru");
  geoURL.searchParams.set("format", "json");

  const geoResponse = await fetch(geoURL);
  const geo = await geoResponse.json();

  if (!geo.results || !geo.results.length) {
    return "❌ Город не найден.";
  }

  const place = geo.results[0];

  const url = new URL(
    "https://api.open-meteo.com/v1/forecast"
  );

  url.searchParams.set("latitude", place.latitude);
  url.searchParams.set("longitude", place.longitude);
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code"
  );

  const response = await fetch(url);
  const data = await response.json();
  const current = data.current;

  const descriptions = {
    0: "Ясно ☀️",
    1: "Преимущественно ясно 🌤️",
    2: "Переменная облачность ⛅",
    3: "Облачно ☁️",
    45: "Туман 🌫️",
    48: "Изморозь 🌫️",
    51: "Лёгкая морось 🌧️",
    61: "Дождь 🌧️",
    63: "Умеренный дождь 🌧️",
    65: "Сильный дождь 🌧️",
    71: "Снег ❄️",
    80: "Ливень 🌧️",
    95: "Гроза ⛈️"
  };

  return (
    `🌤️ Погода: ${place.name}\n\n` +
    `${descriptions[current.weather_code] || "Переменная погода"}\n\n` +
    `🌡️ Температура: ${current.temperature_2m}°C\n` +
    `🤔 Ощущается: ${current.apparent_temperature}°C\n` +
    `💧 Влажность: ${current.relative_humidity_2m}%\n` +
    `💨 Ветер: ${current.wind_speed_10m} км/ч`
  );
}

// Безопасный калькулятор: без eval и выполнения кода
function calculate(expression) {
  const s = expression.replace(/\s/g, "");

  if (!s || s.length > 100 || !/^[0-9+\-*/().%^]+$/.test(s)) {
    throw new Error("Недопустимое выражение");
  }

  let pos = 0;

  function primary() {
    if (s[pos] === "+") {
      pos++;
      return primary();
    }

    if (s[pos] === "-") {
      pos++;
      return -primary();
    }

    if (s[pos] === "(") {
      pos++;
      const value = sum();

      if (s[pos] !== ")") {
        throw new Error("Не хватает )");
      }

      pos++;
      return value;
    }

    const match = s.slice(pos).match(/^(?:\d+\.?\d*|\.\d+)/);

    if (!match) throw new Error("Ожидается число");

    pos += match[0].length;
    return Number(match[0]);
  }

  function power() {
    let a = primary();

    if (s[pos] === "^") {
      pos++;
      a = Math.pow(a, power());
    }

    return a;
  }

  function product() {
    let a = power();

    while (s[pos] === "*" || s[pos] === "/" || s[pos] === "%") {
      const op = s[pos++];
      const b = power();

      if ((op === "/" || op === "%") && b === 0) {
        throw new Error("Деление на ноль");
      }

      if (op === "*") a *= b;
      if (op === "/") a /= b;
      if (op === "%") a %= b;
    }

    return a;
  }

  function sum() {
    let a = product();

    while (s[pos] === "+" || s[pos] === "-") {
      const op = s[pos++];
      const b = product();

      a = op === "+" ? a + b : a - b;
    }

    return a;
  }

  const result = sum();

  if (pos !== s.length || !Number.isFinite(result)) {
    throw new Error("Ошибка в выражении");
  }

  return result;
}

async function searchWeb(query) {
  const url = new URL(
    "https://api.duckduckgo.com/"
  );

  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("skip_disambig", "1");

  const response = await fetch(url);
  const data = await response.json();

  const results = [];

  if (data.AbstractText) {
    results.push(data.AbstractText);
  }

  for (const item of data.RelatedTopics || []) {
    if (item.Text) results.push(item.Text);
    if (results.length >= 5) break;
  }

  if (!results.length) {
    return "😕 Не нашёл быстрый ответ. Попробуй другой запрос.";
  }

  return "🔎 Результаты поиска:\n\n" +
    results.map((x, i) => `${i + 1}. ${x}`).join("\n\n");
}

async function showProfile(chatId, id) {
  const user = getUser(id);

  await send(
    chatId,
    `👤 <b>ТВОЙ ПРОФИЛЬ</b>\n\n` +
    `🆔 ID: <code>${id}</code>\n` +
    `👋 Имя: ${escapeHTML(user.name)}\n` +
    `💬 Сообщений: ${user.messages}\n` +
    `⭐ Очки: ${user.points}\n` +
    `🏆 Побед: ${user.wins}\n` +
    `🌐 Язык: ${user.language}`
  );
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

async function handleMessage(message) {
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const id = message.from.id;
  const name = message.from.first_name || "Игрок";
  const raw = message.text.trim();
  const lower = raw.toLowerCase();
  const command = lower.split(/\s+/)[0].split("@")[0];

  const user = getUser(id, name);

  user.messages++;
  db.stats.messages++;
  saveDB();

  if (sessions[id]) {
    const session = sessions[id];
    delete sessions[id];

    if (session.type === "weather") {
      try {
        await send(chatId, await weather(raw));
      } catch {
        await send(chatId, "❌ Не удалось получить погоду.");
      }
      return;
    }

    if (session.type === "search") {
      try {
        await send(chatId, await searchWeb(raw));
      } catch {
        await send(chatId, "❌ Поиск временно недоступен.");
      }
      return;
    }

    if (session.type === "translate") {
      const parts = session.lang.split(">");
      try {
        const result = await translate(raw, parts[0], parts[1]);
        await send(chatId, "🌍 Перевод:\n\n" + result);
      } catch {
        await send(chatId, "❌ Не удалось перевести текст.");
      }
      return;
    }

    if (session.type === "calc") {
      try {
        await send(chatId, "🧮 Ответ: " + calculate(raw));
      } catch (e) {
        await send(chatId, "❌ " + e.message);
      }
      return;
    }

    if (session.type === "riddle") {
      const correct = raw.toLowerCase() === session.answer.toLowerCase();

      if (correct) {
        user.points += 10;
        user.wins++;
        saveDB();
        await send(chatId, "🎉 Правильно! +10 очков!");
      } else {
        await send(chatId, "❌ Правильный ответ: " + session.answer);
      }

      return;
    }
  }

  if (command === "/start") {
    db.stats.started++;
    saveDB();

    await send(
      chatId,
      `🚀 <b>GROOR BOT 2.0</b>\n\n` +
      `Привет, ${escapeHTML(name)}!\n` +
      `Твой бесплатный помощник готов.\n\n` +
      `Выбирай функцию в меню 👇`,
      mainMenu()
    );
    return;
  }

  if (command === "/help") {
    await send(
      chatId,
      "📋 <b>КОМАНДЫ GROOR BOT</b>\n\n" +
      "/start — главное меню\n" +
      "/help — помощь\n" +
      "/profile — профиль\n" +
      "/ping — проверка связи\n" +
      "/joke — шутка\n" +
      "/fact — интересный факт\n" +
      "/weather — погода\n" +
      "/search — поиск\n" +
      "/translate — переводчик\n" +
      "/calc — калькулятор\n" +
      "/quiz — викторина\n" +
      "/riddle — загадка\n" +
      "/id — твой ID\n" +
      "/admin — админка"
    );
    return;
  }

  if (command === "/ping") {
    await send(chatId, "🏓 Pong! GROOR BOT работает!");
    return;
  }

  if (command === "/id") {
    await send(chatId, `🆔 Твой ID: <code>${id}</code>`);
    return;
  }

  if (command === "/profile") {
    await showProfile(chatId, id);
    return;
  }

  if (command === "/joke") {
    await send(chatId, jokes[Math.floor(Math.random() * jokes.length)]);
    return;
  }

  if (command === "/fact") {
    await send(chatId, "🧠 " + facts[Math.floor(Math.random() * facts.length)]);
    return;
  }

  if (command === "/weather") {
    const city = raw.slice(command.length).trim();

    if (!city) {
      sessions[id] = { type: "weather" };
      await send(chatId, "🌤️ Напиши название города:");
      return;
    }

    try {
      await send(chatId, await weather(city));
    } catch {
      await send(chatId, "❌ Погода временно недоступна.");
    }
    return;
  }

  if (command === "/search") {
    const query = raw.slice(command.length).trim();

    if (!query) {
      sessions[id] = { type: "search" };
      await send(chatId, "🔎 Что будем искать?");
      return;
    }

    try {
      await send(chatId, await searchWeb(query));
    } catch {
      await send(chatId, "❌ Поиск временно недоступен.");
    }
    return;
  }

  if (command === "/translate") {
    const args = raw.slice(command.length).trim();
    const match = args.match(/^([a-z]{2})>([a-z]{2})\s+(.+)$/i);

    if (!match) {
      sessions[id] = { type: "translate", lang: "ru>en" };
      await send(chatId,
        "🌍 Напиши текст для перевода на английский.\n\n" +
        "Или используй формат:\n" +
        "/translate en>ru Hello"
      );
      return;
    }

    try {
      const result = await translate(match[3], match[1], match[2]);
      await send(chatId, "🌍 Перевод:\n\n" + result);
    } catch {
      await send(chatId, "❌ Перевод временно недоступен.");
    }
    return;
  }

  if (command === "/calc") {
    const expression = raw.slice(command.length).trim();

    if (!expression) {
      sessions[id] = { type: "calc" };
      await send(chatId, "🧮 Напиши пример, например: 25 * (4 + 2)");
      return;
    }

    try {
      await send(chatId, "🧮 Ответ: " + calculate(expression));
    } catch (e) {
      await send(chatId, "❌ " + e.message);
    }
    return;
  }

  if (command === "/quiz") {
    await sendQuiz(chatId);
    return;
  }

  if (command === "/riddle") {
    await sendRiddle(chatId, id);
    return;
  }

  if (command === "/admin") {
    if (!ADMIN_ID || String(id) !== String(ADMIN_ID)) {
      await send(chatId, "⛔ Нет доступа.");
      return;
    }

    await send(
      chatId,
      `🛡️ <b>GROOR ADMIN</b>\n\n` +
      `👥 Пользователей: ${Object.keys(db.users).length}\n` +
      `💬 Сообщений: ${db.stats.messages}\n` +
      `🚀 Запусков: ${db.stats.started}`
    );
    return;
  }

  if (command.startsWith("/")) {
    await send(chatId, "🤔 Неизвестная команда. Напиши /help");
    return;
  }

  await send(
    chatId,
    "Привет! Я GROOR BOT 🤖\nВыбирай функцию в меню или напиши /help.",
    mainMenu()
  );
}

async function sendQuiz(chatId) {
  const q = quiz[Math.floor(Math.random() * quiz.length)];

  const keyboard = q.options.map((option, index) => [{
    text: option,
    callback_data: `quiz:${q.answer}:${index}`
  }]);

  await send(chatId, "🎮 <b>ВИКТОРИНА</b>\n\n" + q.q, keyboard);
}

async function sendRiddle(chatId, id) {
  const r = riddles[Math.floor(Math.random() * riddles.length)];

  sessions[id] = {
    type: "riddle",
    answer: r.a
  };

  await send(chatId, "🧩 <b>ЗАГАДКА</b>\n\n" + r.q);
}

async function handleCallback(query) {
  const id = query.from.id;
  const chatId = query.message.chat.id;
  const data = query.data;

  await answerCallback(query.id);

  if (data.startsWith("quiz:")) {
    const [, correct, selected] = data.split(":");

    if (correct === selected) {
      const user = getUser(id);
      user.points += 10;
      user.wins++;
      saveDB();

      await send(chatId, "🎉 Правильно! +10 очков!", [
        [{ text: "🎮 Ещё вопрос", callback_data: "quiz" }]
      ]);
    } else {
      await send(chatId, "❌ Неправильно! Попробуй ещё раз.", [
        [{ text: "🎮 Новый вопрос", callback_data: "quiz" }]
      ]);
    }
    return;
  }

  switch (data) {
    case "home":
      await send(chatId, "🏠 Главное меню GROOR BOT", mainMenu());
      break;

    case "help":
      await send(chatId, "📋 Используй /help для списка команд.");
      break;

    case "profile":
      await showProfile(chatId, id);
      break;

    case "games":
      await send(chatId, "🎮 <b>ИГРЫ</b>", [
        [{ text: "🧠 Викторина", callback_data: "quiz" }],
        [{ text: "🧩 Загадка", callback_data: "riddle" }],
        [{ text: "🏠 Меню", callback_data: "home" }]
      ]);
      break;

    case "fun":
      await send(chatId, "😂 <b>РАЗВЛЕЧЕНИЯ</b>", [
        [{ text: "😂 Шутка", callback_data: "joke" }],
        [{ text: "🧠 Факт", callback_data: "fact" }],
        [{ text: "🏠 Меню", callback_data: "home" }]
      ]);
      break;

    case "joke":
      await send(chatId, jokes[Math.floor(Math.random() * jokes.length)]);
      break;

    case "fact":
      await send(chatId, "🧠 " + facts[Math.floor(Math.random() * facts.length)]);
      break;

    case "quiz":
      await sendQuiz(chatId);
      break;

    case "riddle":
      await sendRiddle(chatId, id);
      break;

    case "weather":
      sessions[id] = { type: "weather" };
      await send(chatId, "🌤️ Напиши название города:");
      break;

    case "search":
      sessions[id] = { type: "search" };
      await send(chatId, "🔎 Что будем искать?");
      break;

    case "translate":
      sessions[id] = { type: "translate", lang: "ru>en" };
      await send(chatId, "🌍 Напиши текст для перевода на английский.");
      break;

    case "calc":
      sessions[id] = { type: "calc" };
      await send(chatId, "🧮 Напиши математический пример.");
      break;
  }
}

async function handleUpdate(update) {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
  } else if (update.message) {
    await handleMessage(update.message);
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });

    return res.end(`
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>GROOR BOT 2.0</title>
        <style>
          *{box-sizing:border-box}
          body{
            margin:0;min-height:100vh;display:grid;
            place-items:center;background:#080d1c;
            color:white;font-family:Arial,sans-serif;
          }
          .card{
            width:90%;max-width:440px;padding:40px 25px;
            text-align:center;border:1px solid #263b66;
            border-radius:28px;
            background:linear-gradient(145deg,#182548,#0d1428);
            box-shadow:0 25px 80px #0009;
          }
          h1{font-size:38px;margin-bottom:8px}
          p{color:#9aadd3}
          .status{
            display:inline-block;padding:11px 20px;
            border-radius:30px;background:#123b2c;
            color:#70ffb2;margin:20px 0;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🤖 GROOR BOT</h1>
          <p>Version 2.0 FREE</p>
          <div class="status">● SERVER ONLINE</div>
          <p>Telegram assistant is running!</p>
          <p>🌍 Games · Weather · Translation · More</p>
        </div>
      </body>
      </html>
    `);
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json"
    });

    return res.end(JSON.stringify({
      bot: "GROOR BOT",
      version: "2.0",
      status: "online",
      users: Object.keys(db.users).length
    }));
  }

  if (req.method === "POST" && req.url === "/webhook") {
    if (
      SECRET &&
      req.headers["x-telegram-bot-api-secret-token"] !== SECRET
    ) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    let body = "";
    let tooLarge = false;

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 1000000) {
        tooLarge = true;
        req.destroy();
      }
    });

    req.on("end", async () => {
      if (tooLarge) return;

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

  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("404 Not Found");
});

server.listen(PORT, () => {
  console.log(`GROOR BOT 2.0 running on port ${PORT}`);
});
