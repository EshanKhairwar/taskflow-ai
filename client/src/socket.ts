import { io } from "socket.io-client";

const configuredApiUrl = import.meta.env.VITE_API_URL;
const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL;

const inferredSocketUrl = configuredApiUrl
  ? configuredApiUrl.replace(/\/api\/v1\/?$/, "")
  : "http://localhost:5000";

const SOCKET_URL = (configuredSocketUrl || inferredSocketUrl)
  .replace(/\/+$/, "");

export const socket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: false,
  transports: ["websocket", "polling"],
});
