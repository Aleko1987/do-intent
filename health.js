// Lightweight health check shim for Render / Cloudflare
// This intentionally bypasses Encore routing

const http = require("http");

const port = process.env.PORT || 10000;

http
  .createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404);
    res.end();
  })
  .listen(port, "0.0.0.0", () => {
    console.log("[health] listening on /healthz");
  });
