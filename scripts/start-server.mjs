/**
 * Node.js HTTP server wrapper para o TanStack Start (Vite build).
 * Converte Node.js req/res para Web API Request/Response.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const port = parseInt(process.env.PORT ?? "3000");
const __dir = fileURLToPath(new URL(".", import.meta.url));
const clientDir = join(__dir, "../dist/client");

// Mapa básico de mime types
const MIME = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

const { default: app } = await import("../dist/server/server.js");

const server = createServer(async (req, res) => {
  try {
    const urlPath = new URL(req.url, "http://localhost").pathname;

    // Serve arquivos estáticos do client build
    if (urlPath.startsWith("/assets/") || urlPath === "/favicon.ico") {
      const filePath = join(clientDir, urlPath);
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = extname(filePath);
        res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        createReadStream(filePath).pipe(res);
        return;
      }
    }

    // Converte para Web API Request
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v != null) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    }

    let body = undefined;
    if (!["GET", "HEAD"].includes(req.method ?? "GET")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks);
    }

    const request = new Request(url, { method: req.method, headers, body });
    const response = await app.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("[server] erro:", err);
    res.statusCode = 500;
    res.end("Erro interno do servidor");
  }
});

server.listen(port, () => {
  console.log(`[dashboard-febracis] rodando em http://0.0.0.0:${port}`);
});
