const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    path: "/api/socket",
  });

  io.on("connection", (socket) => {
    socket.on("disconnect", () => {});
  });

  globalThis.__io = io;

  httpServer.listen(port, hostname, () => {
    console.log(`> Servidor listo en http://${hostname}:${port}`);
  });
});
