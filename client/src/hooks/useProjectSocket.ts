import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

type ProjectTaskChanged = {
  projectId?: string;
  taskId?: string;
  action?: "created" | "updated" | "moved" | "deleted";
};

type ProjectPresence = {
  projectId?: string;
  onlineUserIds?: string[];
};

const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const apiUrl = (configuredApiUrl || "http://localhost:5000/api/v1").replace(/\/+$/, "");
const socketUrl = (import.meta.env.VITE_SOCKET_URL as string | undefined || apiUrl.replace(/\/api\/v1\/?$/, "")).replace(/\/+$/, "");

export function useProjectSocket(
  projectId: string,
  onProjectChange?: (event?: ProjectTaskChanged) => void | Promise<void>,
) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!projectId) {
      setStatus("disconnected");
      setOnlineUserIds([]);
      return;
    }

    let active = true;
    let joined = false;
    const socket: Socket = io(socketUrl, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      timeout: 10000,
      transports: ["websocket", "polling"],
    });

    const joinProject = () => {
      joined = false;
      socket.emit(
        "project:join",
        { projectId },
        (result: { ok: boolean; message?: string }) => {
          if (!active) return;
          joined = Boolean(result?.ok);
          if (!result?.ok) {
            setOnlineUserIds([]);
            console.warn("[Socket] Could not join project room:", result?.message);
          }
        },
      );
    };

    const onConnect = () => {
      if (active) setStatus("connected");
      joinProject();
    };
    const onDisconnect = () => {
      joined = false;
      if (active) {
        setStatus("disconnected");
        setOnlineUserIds([]);
      }
    };
    const onConnectError = (error: Error) => {
      if (active) setStatus("error");
      console.warn("[Socket] Connection failed:", error.message);
    };
    const handleProjectChanged = (event: ProjectTaskChanged) => {
      if (!active || !joined || event?.projectId !== projectId) return;
      void onProjectChange?.(event);
    };
    const handlePresence = (event: ProjectPresence) => {
      if (!active || event?.projectId !== projectId || !Array.isArray(event.onlineUserIds)) return;
      setOnlineUserIds(event.onlineUserIds.filter((id): id is string => typeof id === "string"));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("project:task-changed", handleProjectChanged);
    socket.on("project:presence", handlePresence);

    return () => {
      active = false;
      socket.emit("project:leave", { projectId });
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("project:task-changed", handleProjectChanged);
      socket.off("project:presence", handlePresence);
      socket.disconnect();
    };
  }, [projectId, onProjectChange]);

  return { status, onlineUserIds };
}
