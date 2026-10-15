
import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "node:http";
import jwt, { type JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";

let io: Server | null = null;

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

export function initSocketServer(httpServer: HttpServer): Server {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL ?? "http://localhost:5173",
      credentials: true,
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

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${userId}`);
    });
  });

  return io;
}

export function getSocketServer(): Server {
  if (!io) {
    throw new Error("Socket.IO server has not been initialized");
  }

  return io;
}

export function emitNotificationToUser(
  userId: string,
  notification: unknown,
): void {
  if (!io) {
    console.warn("[Socket] Server not initialized");
    return;
  }

  io.to(`user:${userId}`).emit("notification:new", notification);
}
