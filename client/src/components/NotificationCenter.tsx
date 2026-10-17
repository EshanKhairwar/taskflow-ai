import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, LoaderCircle } from "lucide-react";
import { apiRequest } from "../api/client";
import { socket } from "../socket";

type NotificationItem = {
  _id?: string;
  id?: string;
  message?: string;
  type?: string;
  readAt?: string | null;
  isRead?: boolean;
  createdAt?: string;
  actor?: { name?: string } | string;
  project?: { name?: string } | string;
  task?: { title?: string } | string;
};

type ListResponse =
  | NotificationItem[]
  | {
      notifications?: NotificationItem[];
      data?: NotificationItem[];
    };

type CountResponse = {
  count?: number;
  unreadCount?: number;
  unread?: number;
};

function getId(item: NotificationItem): string {
  return item._id ?? item.id ?? "";
}

function isNotificationRead(item: NotificationItem): boolean {
  return Boolean(item.readAt || item.isRead);
}

function getUnreadCount(response: CountResponse): number {
  const value = response.unreadCount ?? response.count ?? response.unread ?? 0;
  const count = Number(value);

  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function timeAgo(value?: string): string {
  if (!value) return "Just now";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Just now";

  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days < 30) return `${days}d ago`;

  return date.toLocaleDateString();
}

function unwrapList(response: ListResponse): NotificationItem[] {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response.notifications)) {
    return response.notifications;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return [];
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingIds, setMarkingIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(open);
  const seenNotificationIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    isOpenRef.current = open;
  }, [open]);

  const loadCount = useCallback(async () => {
    try {
      const response = await apiRequest<CountResponse>(
        "/notifications/unread-count",
      );

      setUnreadCount(getUnreadCount(response));
    } catch {
      // Keep the notification button usable if the count endpoint fails.
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest<ListResponse>("/notifications");

      const next = unwrapList(response);

      next.forEach((item) => {
        const id = getId(item);
        if (id) seenNotificationIds.current.add(id);
      });

      setItems(next);
      setUnreadCount(next.filter((item) => !isNotificationRead(item)).length);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial unread count and periodic fallback refresh.
  useEffect(() => {
    void loadCount();

    const timer = window.setInterval(() => {
      void loadCount();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [loadCount]);

  // Outside click and Escape key handling.
  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Socket.IO real-time notifications.
  useEffect(() => {
    function handleNewNotification(notification: NotificationItem) {
      const id = getId(notification);

      // Prevent the same event from being processed twice.
      if (id && seenNotificationIds.current.has(id)) {
        return;
      }

      if (id) {
        seenNotificationIds.current.add(id);
      }

      setItems((current) => {
        if (id && current.some((item) => getId(item) === id)) {
          return current;
        }

        return [notification, ...current].slice(0, 50);
      });

      if (!isNotificationRead(notification)) {
        setUnreadCount((count) => count + 1);
      }
    }

    function handleConnect() {
      // Reconcile count after the initial connection or reconnection.
      void loadCount();

      if (isOpenRef.current) {
        void loadNotifications();
      }
    }

    function handleConnectError(err: Error) {
      console.error("[Socket] Notification connection failed:", err.message);
    }

    socket.on("notification:new", handleNewNotification);
    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.disconnect();
    };
  }, [loadCount, loadNotifications]);

  async function markRead(item: NotificationItem) {
    const id = getId(item);

    if (!id || isNotificationRead(item) || markingIds.includes(id)) {
      return;
    }

    setError("");
    setMarkingIds((current) => [...current, id]);

    try {
      await apiRequest(`/notifications/${encodeURIComponent(id)}/read`, {
        method: "PATCH",
      });

      const now = new Date().toISOString();

      setItems((current) =>
        current.map((entry) =>
          getId(entry) === id ? { ...entry, readAt: now, isRead: true } : entry,
        ),
      );

      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not mark notification as read.",
      );
    } finally {
      setMarkingIds((current) =>
        current.filter((currentId) => currentId !== id),
      );
    }
  }

  async function markAllRead() {
    if (!unreadCount || markingAll) return;

    setError("");
    setMarkingAll(true);

    try {
      await apiRequest("/notifications/read-all", {
        method: "PATCH",
      });

      const now = new Date().toISOString();

      setItems((current) =>
        current.map((item) =>
          isNotificationRead(item)
            ? item
            : { ...item, readAt: now, isRead: true },
        ),
      );

      setUnreadCount(0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not mark all notifications as read.",
      );
    } finally {
      setMarkingAll(false);
    }
  }

  function toggleNotifications() {
    const next = !open;

    setOpen(next);

    if (next) {
      void loadNotifications();
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={`Notifications${
          unreadCount ? `, ${unreadCount} unread` : ""
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggleNotifications}
        className="relative grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <Bell size={18} />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
        >
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Notifications
              </h2>

              <p className="mt-0.5 text-[11px] text-slate-500">
                {unreadCount} unread
              </p>
            </div>

            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={!unreadCount || markingAll}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {markingAll ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <CheckCheck size={14} />
              )}

              {markingAll ? "Marking..." : "Mark all read"}
            </button>
          </header>

          {error && (
            <div
              role="alert"
              className="mx-3 mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700"
            >
              {error}
            </div>
          )}

          <div className="max-h-[min(420px,65vh)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-xs text-slate-500">
                <LoaderCircle size={16} className="animate-spin" />
                Loading notifications...
              </div>
            ) : items.length > 0 ? (
              items.map((item, index) => {
                const id = getId(item);
                const read = isNotificationRead(item);
                const marking = markingIds.includes(id);

                return (
                  <article
                    key={id || `${item.createdAt ?? "notification"}-${index}`}
                    className={`flex gap-3 border-b border-slate-50 px-4 py-3 last:border-0 ${
                      read ? "bg-white" : "bg-blue-50/60"
                    }`}
                  >
                    <span
                      className={`mt-1 size-2 shrink-0 rounded-full ${
                        read ? "bg-slate-200" : "bg-blue-500"
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="break-words text-xs leading-5 text-slate-700">
                        {item.message || "You have a new notification."}
                      </p>

                      <p className="mt-1 text-[10px] text-slate-400">
                        {timeAgo(item.createdAt)}
                      </p>
                    </div>

                    {!read && id && (
                      <button
                        type="button"
                        aria-label="Mark notification as read"
                        title="Mark as read"
                        disabled={marking}
                        onClick={() => void markRead(item)}
                        className="self-start rounded-md p-1 text-slate-400 transition hover:bg-white hover:text-blue-700 disabled:opacity-50"
                      >
                        {marking ? (
                          <LoaderCircle size={15} className="animate-spin" />
                        ) : (
                          <Check size={15} />
                        )}
                      </button>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="px-5 py-10 text-center">
                <span className="mx-auto mb-3 grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-400">
                  <Bell size={18} />
                </span>

                <p className="text-sm font-semibold text-slate-700">
                  You’re all caught up
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  New notifications will appear here.
                </p>
              </div>
            )}
          </div>

          <footer className="border-t border-slate-100 bg-slate-50/70 px-4 py-2">
            <button
              type="button"
              onClick={() => void loadNotifications()}
              disabled={loading}
              className="w-full rounded-lg py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-blue-700 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
