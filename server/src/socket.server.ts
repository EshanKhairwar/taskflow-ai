
import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "node:http";
import jwt, { type JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";

let io: Server | null = null;

/**
 * Normalize the frontend origin.
 * Removes whitespace and trailing slashes from CLIENT_URL.
 */
function getAllowedOrigin(): string {
  return (
    process.env.CLIENT_URL || "http://localhost:5173"
  )
    .trim()
    .replace(/\/+$/, "");
}

/**
 * Authenticate Socket.IO connections using the JWT cookie.
 */
function authenticateSocket(socket: Socket): string | null {
  const cookieHeader = socket.handshake.headers.cookie;
  const secret = process.env.JWT_SECRET;

  if (!cookieHeader || !secret) {
    return null;
  }

  const tokenCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("token="));

  if (!tokenCookie) {
    return null;
  }

  try {
    const token = decodeURIComponent(
      tokenCookie.slice("token=".length),
    );

    const payload = jwt.verify(token, secret);

    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      !mongoose.isValidObjectId(payload.sub)
    ) {
      return null;
    }

    return (payload as JwtPayload).sub as string;
  } catch {
    return null;
  }
}

/**
 * Initialize the Socket.IO server.
 */
export function initSocketServer(
  httpServer: HttpServer,
): Server {
  if (io) {
    return io;
  }

  const allowedOrigin = getAllowedOrigin();

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigin,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    const userId = authenticateSocket(socket);

    if (!userId) {
      next(new Error("Unauthorized socket connection"));
      return;
    }

    socket.data.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;

    socket.join(`user:${userId}`);

    console.log(`[Socket] Connected: ${userId}`);

    socket.on("disconnect", (reason) => {
      console.log(
        `[Socket] Disconnected: ${userId}. Reason: ${reason}`,
      );
    });
  });

  console.log(
    `[Socket] Server initialized. Allowed origin: ${allowedOrigin}`,
  );

  return io;
}

/**
 * Get the initialized Socket.IO server instance.
 */
export function getSocketServer(): Server {
  if (!io) {
    throw new Error(
      "Socket.IO server has not been initialized",
    );
  }

  return io;
}

/**
 * Send a notification to a specific user's connected sockets.
 */
export function emitNotificationToUser(
  userId: string,
  notification: unknown,
): void {
  if (!io) {
    console.warn("[Socket] Server not initialized");
    return;
  }

  io.to(`user:${userId}`).emit(
    "notification:new",
    notification,
  );
}
