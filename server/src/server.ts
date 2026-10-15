
import "dotenv/config";
import { createServer } from "node:http";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { initSocketServer } from "./socket.server.js";

const port = Number(process.env.PORT ?? 5000);

async function startServer() {
  await connectDatabase();

  const httpServer = createServer(app);

  initSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`TaskFlow API running on port ${port}`);
    console.log("Socket.IO server initialized");
  });
}

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});
