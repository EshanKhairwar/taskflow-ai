import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "node:http";
import jwt, { type JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import Project from "./models/Project.js";

let io: Server | null = null;

function getAllowedOrigin(): string {
  return (process.env.CLIENT_URL || "http://localhost:5173")
    .trim()
    .replace(/\/+$/, "");
}

/** Authenticate sockets with the same HTTP-only JWT cookie used by REST APIs. */
function authenticateSocket(socket: Socket): string | null {
  const cookieHeader = socket.handshake.headers.cookie;
  const secret = process.env.JWT_SECRET;
  if (!cookieHeader || !secret) return null;

  const tokenCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("token="));

  if (!tokenCookie) return null;

  try {
    const token = decodeURIComponent(tokenCookie.slice("token=".length));
    const payload = jwt.verify(token, secret);
    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      !mongoose.isValidObjectId(payload.sub)
    ) return null;
    return (payload as JwtPayload).sub as string;
  } catch {
    return null;
  }
}

function validProjectId(value: unknown): value is string {
  return typeof value === "string" && mongoose.isValidObjectId(value);
}

/** Initialize Socket.IO once on the same HTTP server as Express. */
export function initSocketServer(httpServer: HttpServer): Server {
  if (io) return io;

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

    // Clients may request a room, but the server must verify membership.
    socket.on(
      "project:join",
      async (
        payload: { projectId?: unknown } | undefined,
        acknowledge?: (result: { ok: boolean; message?: string }) => void,
      ) => {
        try {
          const projectId = payload?.projectId;
          if (!validProjectId(projectId)) {
            acknowledge?.({ ok: false, message: "Invalid project ID" });
            return;
          }

          const hasAccess = await Project.exists({
            _id: projectId,
            $or: [{ owner: userId }, { "members.user": userId }],
          });

          if (!hasAccess) {
            acknowledge?.({ ok: false, message: "Project access denied" });
            return;
          }

          await socket.join(`project:${projectId}`);
          acknowledge?.({ ok: true });
          socket.emit("project:joined", { projectId });
        } catch (error) {
          console.error("[Socket] Failed to join project room:", error);
          acknowledge?.({ ok: false, message: "Could not join project room" });
        }
      },
    );

    socket.on(
      "project:leave",
      (payload: { projectId?: unknown } | undefined) => {
        const projectId = payload?.projectId;
        if (validProjectId(projectId)) {
          void socket.leave(`project:${projectId}`);
        }
      },
    );

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Disconnected: ${userId}. Reason: ${reason}`);
    });
  });

  console.log(`[Socket] Server initialized. Allowed origin: ${allowedOrigin}`);
  return io;
}

export function getSocketServer(): Server {
  if (!io) throw new Error("Socket.IO server has not been initialized");
  return io;
}

export function emitNotificationToUser(userId: string, notification: unknown): void {
  if (!io) {
    console.warn("[Socket] Server not initialized");
    return;
  }
  io.to(`user:${userId}`).emit("notification:new", notification);
}

/** Broadcast only server-created events to members currently in this room. */
export function emitProjectEvent(
  projectId: string,
  event: "project:task-changed",
  payload: unknown,
): void {
  if (!io) {
    console.warn("[Socket] Server not initialized");
    return;
  }
  io.to(`project:${projectId}`).emit(event, payload);
}
