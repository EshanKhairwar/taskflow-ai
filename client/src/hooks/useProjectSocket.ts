import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const apiUrl = (configuredApiUrl || "http://localhost:5000/api/v1").replace(/\/+$/, "");
const socketUrl = apiUrl.replace(/\/api\/v1\/?$/, "");

export function useProjectSocket(
  projectId: string,
  onProjectChange?: () => void | Promise<void>,
) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    if (!projectId) {
      setStatus("disconnected");
      return;
    }

    let active = true;
    const socket: Socket = io(socketUrl, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    });

    const onConnect = () => {
      if (active) setStatus("connected");
      socket.emit(
        "project:join",
        { projectId },
        (result: { ok: boolean; message?: string }) => {
          if (!active) return;
          if (!result?.ok) {
            console.warn("[Socket] Could not join project room:", result?.message);
          }
        },
      );
    };

    const onDisconnect = () => {
      if (active) setStatus("disconnected");
    };

    const onConnectError = (error: Error) => {
      if (active) setStatus("error");
      console.warn("[Socket] Connection failed:", error.message);
    };

    const handleProjectChanged = () => {
      if (active) void onProjectChange?.();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("project:task-changed", handleProjectChanged);

    return () => {
      active = false;
      socket.emit("project:leave", { projectId });
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("project:task-changed", handleProjectChanged);
      socket.disconnect();
    };
  }, [projectId, onProjectChange]);

  return { status };
}
