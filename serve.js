// Локальний сервер для перегляду сайту з ПК і з телефону в тій самій мережі.
// Запуск: node serve.js   ->  http://localhost:8765/  і  http://<IP ПК>:8765/
// Слухає всі інтерфейси (0.0.0.0), тож телефон у тій самій Wi-Fi-мережі
// бачить сайт за IP-адресою комп'ютера. Кеш вимкнено: після правок у файлах
// досить оновити сторінку.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8765;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".webmanifest": "application/manifest+json",
};

function send(res, code, body, type) {
  res.writeHead(code, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch (e) {
    return send(res, 400, "Bad request");
  }
  if (urlPath.endsWith("/")) urlPath += "index.html";
  // Чисті адреси, як на хостингу: /ua/case-melume віддає case-melume.html.
  // Без цього локальний перегляд розходився б з тим, що бачить відвідувач.
  if (!path.extname(urlPath)) urlPath += ".html";

  // Шлях завжди лишається всередині папки сайту.
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    return send(res, 403, "Forbidden");
  }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      const nf = path.join(ROOT, "404.html");
      return fs.readFile(nf, (e2, html) =>
        e2 ? send(res, 404, "Not found") : send(res, 404, html, MIME[".html"]));
    }
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": st.size,
      "Cache-Control": "no-store",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, "0.0.0.0", () => {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list) if (i.family === "IPv4" && !i.internal) ips.push(i.address);
  }
  console.log(`Serving ${ROOT}`);
  console.log(`  PC:     http://localhost:${PORT}/`);
  for (const ip of ips) console.log(`  Phone:  http://${ip}:${PORT}/`);
}).on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `Port ${PORT} is busy` : e.message);
  process.exit(1);
});
