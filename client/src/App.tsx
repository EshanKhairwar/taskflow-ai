import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FormEvent } from "react";

import {
  Activity,
  UserRound,
  ShieldCheck,
  Camera,
  Save,
  Pencil,
  Upload,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
  CalendarDays,
  BarChart3,
  X,
} from "lucide-react";

import { apiRequest } from "./api/client";
import { logoutUser } from "./api/auth.api";
import { socket } from "./socket";

import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";

import ProjectBoard from "./pages/ProjectBoard";

import TaskCalendar from "./pages/TaskCalendar";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import TeamTab from "./pages/TeamTab";
import MyTasks from "./pages/MyTasks";
import ProjectsTab from "./pages/ProjectsTab";

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

interface Project {
  _id?: string;

  id?: string;

  name: string;

  description?: string;

  status?: string;

  createdAt?: string;

  updatedAt?: string;
}

type ProjectsResponse = Project[] | { projects?: Project[]; data?: Project[] };

interface CurrentUser {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
  avatar?: string;
  avatarUrl?: string;
  profileImage?: string;
}

interface ActivityItem {
  _id: string;
  type: string;
  message: string;
  createdAt: string;
  actor?: { name?: string; email?: string } | null;
  project?: { _id?: string; name?: string } | null;
  task?: { _id?: string; title?: string } | null;
}

interface NotificationItem {
  _id: string;
  type: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  actor?: { name?: string; email?: string } | null;
  project?: { name?: string } | null;
  task?: { title?: string } | null;
}

const projectColors = [
  "bg-blue-100 text-blue-600",

  "bg-sky-100 text-sky-600",

  "bg-orange-100 text-orange-600",

  "bg-emerald-100 text-emerald-600",
];

function normalizeProjects(response: ProjectsResponse): Project[] {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response.projects)) return response.projects;

  if (Array.isArray(response.data)) return response.data;

  return [];
}

function formatDate(date?: string) {
  if (!date) return "Recently created";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Recently created";
  }

  return `Updated ${parsed.toLocaleDateString(undefined, {
    month: "short",

    day: "numeric",
  })}`;
}

function getInitials(name: string) {
  return name

    .trim()

    .split(/\s+/)

    .slice(0, 2)

    .map((part) => part[0]?.toUpperCase() ?? "")

    .join("");
}

function formatRelativeTime(date?: string) {
  if (!date) return "Recently";
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return "Recently";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function App() {
  const [timeGreeting, setTimeGreeting] = useState<string>(getTimeBasedGreeting);
  const [currentDateTime, setCurrentDateTime] = useState<Date>(() => new Date());

  useEffect(() => {
    // Keep the greeting, clock, and date in sync with the browser's local time.
    const updateDateTime = () => {
      const now = new Date();
      setTimeGreeting(getTimeBasedGreeting());
      setCurrentDateTime(now);
    };

    updateDateTime();
    const intervalId = window.setInterval(updateDateTime, 1_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const liveTime = currentDateTime.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const liveDayAndDate = currentDateTime.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  // Verify the existing HTTP-only cookie before deciding which page to show.
  console.log("🚀 App component rendered. Checking authentication status...");

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [avatarDataUrlDraft, setAvatarDataUrlDraft] = useState<string | null>(
    null,
  );
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [authPage, setAuthPage] = useState<"login" | "signup">("login");

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [logoutError, setLogoutError] = useState("");

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notificationToast, setNotificationToast] = useState<NotificationItem | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);

  const [taskStats, setTaskStats] = useState({
    open: 0,
    completed: 0,
    dueSoon: 0,
  });
  const [taskStatsLoading, setTaskStatsLoading] = useState(true);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");

  const [activeNav, setActiveNav] = useState("Overview");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);

  const [projectName, setProjectName] = useState("");

  const [description, setDescription] = useState("");

  const [creating, setCreating] = useState(false);

  const [createError, setCreateError] = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);

    setLoadError("");

    try {
      const response = await apiRequest<ProjectsResponse>("/projects");

      setProjects(normalizeProjects(response));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load projects.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActivities = useCallback(async () => {
    setActivityLoading(true);
    setActivityError("");
    try {
      const response = await apiRequest<{ activities: ActivityItem[] }>(
        "/activity?limit=10",
        { method: "GET" },
      );
      setActivities(
        Array.isArray(response.activities) ? response.activities : [],
      );
    } catch (error) {
      setActivityError(
        error instanceof Error
          ? error.message
          : "Unable to load recent activity.",
      );
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await apiRequest<{ count: number }>(
        "/notifications/unread-count",
        { method: "GET" },
      );
      setUnreadCount(Number.isFinite(response.count) ? response.count : 0);
    } catch (error) {
      console.error("Failed to load unread notification count:", error);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationError("");
    try {
      const response = await apiRequest<{ notifications: NotificationItem[] }>(
        "/notifications?limit=20",
        { method: "GET" },
      );
      const nextNotifications = Array.isArray(response.notifications)
        ? response.notifications
        : [];
      nextNotifications.forEach((notification) => {
        if (notification._id) {
          seenNotificationIds.current.add(notification._id);
        }
      });
      setNotifications(nextNotifications);
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to load notifications.",
      );
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  // Keep the existing notification dropdown in sync with persisted Socket.IO events.
  useEffect(() => {
    if (!isAuthenticated) return;

    function handleNewNotification(notification: NotificationItem) {
      const id = notification?._id;
      if (!id || seenNotificationIds.current.has(id)) return;

      seenNotificationIds.current.add(id);
      setNotifications((current) => [notification, ...current].slice(0, 20));
      setNotificationToast(notification);

      if (!notification.readAt) {
        setUnreadCount((count) => count + 1);
      }
    }

    function handleConnect() {
      void loadUnreadCount();
    }

    function handleConnectError(error: Error) {
      console.warn("[Socket] Notification connection failed:", error.message);
    }

    socket.on("notification:new", handleNewNotification);
    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.disconnect();
    };
  }, [isAuthenticated, loadUnreadCount, loadNotifications]);

  // Show a brief in-app toast for incoming real-time notifications.
  useEffect(() => {
    if (!notificationToast) return;
    const timer = window.setTimeout(() => setNotificationToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [notificationToast]);

  async function handleNotificationsClick() {
    const willOpen = !notificationsOpen;
    setNotificationsOpen(willOpen);
    if (willOpen) {
      await Promise.all([loadNotifications(), loadUnreadCount()]);
    }
  }

  async function handleMarkNotificationRead(id: string) {
    setNotificationError("");
    try {
      await apiRequest<{ notification: NotificationItem }>(
        `/notifications/${id}/read`,
        { method: "PATCH" },
      );
      setNotifications((current) =>
        current.map((item) =>
          item._id === id
            ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
            : item,
        ),
      );
      await loadUnreadCount();
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to mark notification as read.",
      );
    }
  }

  async function handleMarkAllRead() {
    setMarkingAllRead(true);
    setNotificationError("");
    try {
      await apiRequest<{ updated: number }>("/notifications/read-all", {
        method: "PATCH",
      });
      const now = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => ({ ...item, readAt: item.readAt ?? now })),
      );
      setUnreadCount(0);
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to mark notifications as read.",
      );
    } finally {
      setMarkingAllRead(false);
    }
  }

  // Restore the session after refresh by asking the backend to verify the cookie.

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const response = await apiRequest<{ user: CurrentUser }>("/auth/me", {
          method: "GET",
        });

        if (!cancelled) {
          setCurrentUser(response.user ?? null);
          setIsAuthenticated(true);
        }
      } catch {
        if (!cancelled) setIsAuthenticated(false);
      } finally {
        if (!cancelled) setIsCheckingAuth(false);
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Do not call the protected projects API until session verification/login succeeds.

  useEffect(() => {
    if (!isAuthenticated) return;

    void loadProjects();
  }, [isAuthenticated, loadProjects]);

  // Load task statistics across all projects the signed-in user can access.
  useEffect(() => {
    let cancelled = false;

    async function loadTaskStats() {
      if (!isAuthenticated) {
        setTaskStats({ open: 0, completed: 0, dueSoon: 0 });
        setTaskStatsLoading(false);
        return;
      }

      if (loading) return;
      if (projects.length === 0) {
        setTaskStats({ open: 0, completed: 0, dueSoon: 0 });
        setTaskStatsLoading(false);
        return;
      }

      setTaskStatsLoading(true);
      try {
        const taskLists = await Promise.all(
          projects.map(async (project) => {
            const projectId = project._id ?? project.id;
            if (!projectId)
              return [] as Array<{ status?: string; dueDate?: string | null }>;

            const collected: Array<{
              status?: string;
              dueDate?: string | null;
            }> = [];
            let page = 1;
            let totalPages = 1;

            do {
              const response = await apiRequest<{
                tasks?: Array<{ status?: string; dueDate?: string | null }>;
                pagination?: { totalPages?: number };
              }>(
                `/projects/${encodeURIComponent(projectId)}/tasks?page=${page}&limit=100`,
              );
              if (Array.isArray(response.tasks))
                collected.push(...response.tasks);
              totalPages = Math.max(
                1,
                Number(response.pagination?.totalPages) || 1,
              );
              page += 1;
            } while (page <= totalPages);

            return collected;
          }),
        );

        if (cancelled) return;
        const tasks = taskLists.flat();
        const now = Date.now();
        const nextSevenDays = now + 7 * 24 * 60 * 60 * 1000;
        const completed = tasks.filter((task) => task.status === "done").length;
        const openTasks = tasks.filter((task) => task.status !== "done");
        const dueSoon = openTasks.filter((task) => {
          if (!task.dueDate) return false;
          const due = new Date(task.dueDate).getTime();
          return Number.isFinite(due) && due >= now && due <= nextSevenDays;
        }).length;

        setTaskStats({ open: openTasks.length, completed, dueSoon });
      } catch (error) {
        console.error("Failed to load dashboard task statistics:", error);
        if (!cancelled) setTaskStats({ open: 0, completed: 0, dueSoon: 0 });
      } finally {
        if (!cancelled) setTaskStatsLoading(false);
      }
    }

    void loadTaskStats();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loading, projects]);

  useEffect(() => {
    if (!isAuthenticated) {
      setActivities([]);
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsOpen(false);
      return;
    }
    void loadActivities();
    void loadUnreadCount();
  }, [isAuthenticated, loadActivities, loadUnreadCount]);

  async function handleLogout() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    setLogoutError("");

    try {
      await logoutUser();

      setIsAuthenticated(false);
      setCurrentUser(null);

      setProjects([]);

      setSearch("");

      setMobileMenuOpen(false);

      setAccountMenuOpen(false);
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Unable to log out. Please try again.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return projects;

    return projects.filter((project) =>
      `${project.name} ${project.description ?? ""}`

        .toLowerCase()

        .includes(query),
    );
  }, [projects, search]);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setCreateError("");

    if (projectName.trim().length < 2) {
      setCreateError("Project name must contain at least 2 characters.");

      return;
    }

    setCreating(true);

    try {
      const response = await apiRequest<Project | { project: Project }>(
        "/projects",

        {
          method: "POST",

          body: JSON.stringify({
            name: projectName.trim(),

            description: description.trim(),
          }),
        },
      );

      const created = "project" in response ? response.project : response;

      if (created?.name) {
        setProjects((current) => [
          created,

          ...current.filter(
            (project) =>
              (project._id ?? project.id) !== (created._id ?? created.id),
          ),
        ]);
      } else {
        await loadProjects();
      }

      setProjectName("");

      setDescription("");

      setModalOpen(false);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Unable to create project.",
      );
    } finally {
      setCreating(false);
    }
  }

  const navigation = [
    { label: "Overview", icon: LayoutDashboard },

    { label: "My tasks", icon: ListTodo },

    { label: "Projects", icon: FolderKanban },

    { label: "Team", icon: Users },
    { label: "Calendar", icon: CalendarDays },
    { label: "Analytics", icon: BarChart3 },
    { label: "Account", icon: UserRound },
  ];

  useEffect(() => {
    setProfileNameDraft(currentUser?.name ?? "");
    setAvatarDataUrlDraft(null);
    setAvatarRemoved(false);
  }, [
    currentUser?.id,
    currentUser?._id,
    currentUser?.name,
    currentUser?.avatarUrl,
    currentUser?.avatar,
    currentUser?.profileImage,
  ]);

  const displayName = currentUser?.name?.trim() || "TaskFlow member";
  const displayEmail = currentUser?.email?.trim() || "Email not available";
  const avatarUrl =
    currentUser?.avatarUrl || currentUser?.avatar || currentUser?.profileImage;
  const userInitials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "TF";

  useEffect(() => {
    if (activeNav !== "Account" || !isAuthenticated) return;
    let cancelled = false;
    setProfileLoading(true);
    setProfileError("");
    apiRequest<{ user: CurrentUser }>("/auth/me", { method: "GET" })
      .then((response) => {
        if (!cancelled) setCurrentUser(response.user ?? null);
      })
      .catch((error) => {
        if (!cancelled)
          setProfileError(
            error instanceof Error
              ? error.message
              : "Unable to load account details.",
          );
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeNav, isAuthenticated]);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    const trimmedName = profileNameDraft.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setProfileError("Name must be between 2 and 80 characters.");
      return;
    }

    setSavingProfile(true);
    try {
      const response = await apiRequest<{ user: CurrentUser }>(
        "/auth/me/profile",
        {
          method: "PATCH",
          body: JSON.stringify({
            name: trimmedName,
            avatarDataUrl: avatarRemoved ? null : avatarDataUrlDraft,
            removeAvatar: avatarRemoved,
          }),
        },
      );
      setCurrentUser(response.user);
      setProfileNameDraft(response.user.name ?? trimmedName);
      setAvatarDataUrlDraft(null);
      setAvatarRemoved(false);
      setProfileSuccess("Your profile has been updated successfully.");
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Unable to save your profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  function handleAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setProfileError("Choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError("Profile photo must be 2 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarDataUrlDraft(reader.result);
        setAvatarRemoved(false);
        setProfileError("");
        setProfileSuccess("");
      }
    };
    reader.onerror = () =>
      setProfileError("Could not read this image. Please try another file.");
    reader.readAsDataURL(file);
  }

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-400/30 border-t-blue-400" />

          <p className="text-sm text-slate-300">Restoring your session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authPage === "signup") {
      return (
        <SignupPage
          onSignup={() => {
            setAuthPage("login");
            void apiRequest<{ user: CurrentUser }>("/auth/me", {
              method: "GET",
            })
              .then((response) => {
                setCurrentUser(response.user ?? null);
                setIsAuthenticated(true);
              })
              .catch(() => {
                setCurrentUser(null);
                setIsAuthenticated(false);
              });
          }}
          onSwitchToLogin={() => setAuthPage("login")}
        />
      );
    }
    return (
      <LoginPage
        onLogin={() => setIsAuthenticated(true)}
        onSwitchToSignup={() => setAuthPage("signup")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {notificationToast && (
        <div className="fixed right-4 top-4 z-[100] w-[min(380px,calc(100vw-2rem))] animate-in slide-in-from-top-2 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white shadow-2xl shadow-slate-950/30" role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-300">
              <Bell size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">New notification</p>
              <p className="mt-1 line-clamp-3 text-sm leading-5 text-slate-300">
                {notificationToast.message || "You have a new TaskFlow update."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setNotificationToast(null);
                  setNotificationsOpen(true);
                  void Promise.all([loadNotifications(), loadUnreadCount()]);
                }}
                className="mt-2 text-xs font-semibold text-blue-300 transition hover:text-blue-200"
              >
                View notifications
              </button>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setNotificationToast(null)}
              className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile backdrop */}

      {mobileMenuOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 md:hidden"
        />
      )}

      {/* Sidebar */}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh max-h-dvh w-64 flex-col overflow-x-hidden overflow-y-scroll overscroll-y-contain border-r border-slate-200 bg-white px-4 py-6 transition-transform duration-200 [scrollbar-width:thin] [&>*]:shrink-0 md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-2">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 text-white shadow-lg shadow-blue-200">
            <Sparkles size={19} />
          </div>

          <span className="text-xl font-extrabold tracking-tight text-slate-900">
            TaskFlow <span className="text-blue-600">AI</span>
          </span>

          <button
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
            className="ml-auto grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <button className="mt-8 flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50">
          <span className="grid size-9 place-items-center rounded-lg bg-blue-100 font-bold text-blue-700">
            T
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold">
              TaskFlow Workspace
            </span>

            <span className="mt-1 block text-[11px] text-slate-400">
              Free plan
            </span>
          </span>

          <ChevronDown size={16} className="text-slate-400" />
        </button>

        <p className="mb-3 mt-8 px-3 text-[10px] font-bold tracking-[0.16em] text-slate-400">
          WORKSPACE
        </p>

        <nav className="space-y-1">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => {
                setActiveNav(label);

                setMobileMenuOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                activeNav === label
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Icon size={18} />

              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="mb-3 mt-8 flex items-center justify-between px-3">
          <p className="text-[10px] font-bold tracking-[0.16em] text-slate-400">
            YOUR PROJECTS
          </p>

          <button
            aria-label="Create project"
            onClick={() => setModalOpen(true)}
            className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-700"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="space-y-1">
          {projects.slice(0, 5).map((project, index) => (
            <button
              key={project._id ?? project.id ?? project.name}
              onClick={() => setActiveNav("Projects")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50"
            >
              <span
                className={`size-2 rounded-sm ${
                  [
                    "bg-blue-500",

                    "bg-sky-500",

                    "bg-orange-500",

                    "bg-emerald-500",
                  ][index % 4]
                }`}
              />

              <span className="truncate">{project.name}</span>
            </button>
          ))}

          {!projects.length && !loading && (
            <p className="px-3 py-2 text-xs text-slate-400">
              Your projects will appear here.
            </p>
          )}
        </div>

        <div className="mt-auto space-y-1 border-t border-slate-100 pt-5">
          <button
            onClick={() => setActiveNav("Settings")}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Settings size={18} />
            Settings
          </button>

          <button
            onClick={() => setActiveNav("Help & support")}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-50"
          >
            <CircleHelp size={18} />
            Help & support
          </button>

          <div className="mt-4 border-t border-slate-100 px-2 pt-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                TF
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">
                  Workspace member
                </span>

                <span className="mt-1 block text-[10px] text-slate-400">
                  Personal workspace
                </span>
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}

      <main className="min-h-screen min-h-dvh pb-8 md:pl-64">
        <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation"
              onClick={() => setMobileMenuOpen(true)}
              className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-2 text-xs">
              <span className="hidden text-slate-400 sm:inline">Workspace</span>

              <span className="hidden text-slate-300 sm:inline">/</span>

              <span className="font-semibold">{activeNav}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <label className="flex h-9 w-9 items-center justify-center gap-2 rounded-lg text-slate-400 sm:w-56 sm:border sm:border-slate-200 sm:bg-white sm:px-3">
              <Search size={16} />

              <input
                aria-label="Search projects"
                placeholder="Search projects..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="workspace-search-input hidden min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-500 sm:block"
              />
            </label>

            <div className="relative">
              <button
                type="button"
                aria-label="Notifications"
                aria-haspopup="dialog"
                aria-expanded={notificationsOpen}
                onClick={() => void handleNotificationsClick()}
                className="relative grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close notifications"
                    onClick={() => setNotificationsOpen(false)}
                    className="fixed inset-0 z-40 cursor-default"
                  />
                  <section
                    role="dialog"
                    aria-label="Notifications"
                    className="fixed left-3 right-3 top-16 z-50 flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:max-h-[min(32rem,calc(100dvh-6rem))] sm:w-[min(360px,calc(100vw-2rem))]"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <h2 className="text-sm font-bold">Notifications</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {unreadCount} unread
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleMarkAllRead()}
                        disabled={unreadCount === 0 || markingAllRead}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {markingAllRead ? "Updating..." : "Mark all read"}
                      </button>
                    </div>

                    {notificationError && (
                      <div
                        role="alert"
                        className="px-4 py-3 text-xs text-rose-600"
                      >
                        {notificationError}
                        <button
                          type="button"
                          onClick={() => void loadNotifications()}
                          className="ml-2 font-semibold underline"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                      {notificationsLoading ? (
                        <p className="px-4 py-8 text-center text-sm text-slate-500">
                          Loading notifications...
                        </p>
                      ) : notifications.length === 0 ? (
                        <div className="px-4 py-10 text-center">
                          <Bell
                            className="mx-auto mb-3 text-slate-300"
                            size={26}
                          />
                          <p className="text-sm font-semibold">
                            You’re all caught up
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            New notifications will appear here.
                          </p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <button
                            key={notification._id}
                            type="button"
                            onClick={() => {
                              if (!notification.readAt)
                                void handleMarkNotificationRead(
                                  notification._id,
                                );
                            }}
                            className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${!notification.readAt ? "bg-blue-50/60" : ""}`}
                          >
                            <span className="flex items-start gap-3">
                              <span
                                className={`mt-1 size-2 shrink-0 rounded-full ${notification.readAt ? "bg-slate-200" : "bg-blue-500"}`}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-semibold leading-5">
                                  {notification.message}
                                </span>
                                <span className="mt-1 block text-[11px] text-slate-500">
                                  {notification.actor?.name ??
                                    "TaskFlow member"}
                                  {notification.project?.name
                                    ? ` · ${notification.project.name}`
                                    : ""}
                                </span>
                                <span className="mt-1 block text-[10px] text-slate-400">
                                  {formatRelativeTime(notification.createdAt)}
                                </span>
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="border-t border-slate-100 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          void loadNotifications();
                          void loadUnreadCount();
                        }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Refresh notifications
                      </button>
                    </div>
                  </section>
                </>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`${displayName} avatar`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    userInitials
                  )}
                </span>

                <ChevronDown
                  size={15}
                  className={`text-slate-500 transition-transform ${accountMenuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {accountMenuOpen && (
                <div
                  role="menu"
                  aria-label="Account menu"
                  className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60"
                >
                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {displayName}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {displayEmail}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveNav("Account");
                        setAccountMenuOpen(false);
                      }}
                      className="mt-3 w-full rounded-lg px-2 py-2 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      View account
                    </button>
                  </div>

                  {logoutError && (
                    <p role="alert" className="px-3 pt-2 text-xs text-red-600">
                      {logoutError}
                    </p>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleLogout()}
                    disabled={isLoggingOut}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LogOut size={16} />

                    {isLoggingOut ? "Logging out..." : "Log out"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {selectedProject ? (
          <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
            <button
              type="button"
              onClick={() => {
                setSelectedProject(null);

                setActiveNav("Overview");
              }}
              className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Back to projects
            </button>

            <ProjectBoard
              projectId={selectedProject._id ?? selectedProject.id ?? ""}
              projectName={selectedProject.name}
            />
          </div>
        ) : activeNav === "Calendar" ? (
          <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
            <TaskCalendar
              projects={projects}
              onOpenProject={(project) => {
                setSelectedProject(project);
                setActiveNav(project.name);
              }}
            />
          </div>
        ) : activeNav === "Analytics" ? (
          <AnalyticsDashboard
            projects={projects}
            onOpenProject={(project) => {
              setSelectedProject(project);
              setActiveNav(project.name);
            }}
          />
        ) : activeNav === "My tasks" ? (
          <MyTasks />
        ) : activeNav === "Projects" ? (
          <ProjectsTab
            projects={projects}
            filteredProjects={filteredProjects}
            loading={loading}
            loadError={loadError}
            search={search}
            onCreateProject={() => setModalOpen(true)}
            onOpenProject={(project) => {
              setSelectedProject(project);
              setActiveNav(project.name);
            }}
            onRefreshProjects={() => void loadProjects()}
          />
        ) : activeNav === "Team" ? (
          <TeamTab projects={projects} />
        ) : activeNav === "Settings" ? (
          <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-blue-500">
              Preferences
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Settings
            </h1>
            <section className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="font-bold text-slate-900">Workspace settings</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Manage your TaskFlow AI workspace preferences.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Workspace name
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  TaskFlow Workspace
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Plan</p>
                <p className="mt-1 text-sm text-slate-500">Free plan</p>
              </div>
              <button
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              >
                <LogOut size={16} />
                {isLoggingOut ? "Logging out..." : "Log out"}
              </button>
            </section>
          </div>
        ) : activeNav === "Account" ? (
          <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-500">
              Personal profile
            </p>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  My account
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Update your name and profile photo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfileLoading(true);
                  setProfileError("");
                  setProfileSuccess("");
                  void apiRequest<{ user: CurrentUser }>("/auth/me", {
                    method: "GET",
                  })
                    .then((response) => setCurrentUser(response.user ?? null))
                    .catch((error) =>
                      setProfileError(
                        error instanceof Error
                          ? error.message
                          : "Unable to refresh account details.",
                      ),
                    )
                    .finally(() => setProfileLoading(false));
                }}
                disabled={profileLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                <Activity
                  size={16}
                  className={profileLoading ? "animate-spin" : ""}
                />
                {profileLoading ? "Refreshing…" : "Refresh details"}
              </button>
            </div>

            {profileError && (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {profileError}
              </p>
            )}
            {profileSuccess && (
              <p
                role="status"
                className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              >
                {profileSuccess}
              </p>
            )}

            <form
              onSubmit={handleSaveProfile}
              className="mt-7 grid gap-6 lg:grid-cols-[1.4fr_1fr]"
            >
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="bg-gradient-to-r from-blue-600 via-sky-600 to-blue-600 px-6 py-7 sm:px-8">
                  <p className="text-sm font-medium text-white/75">
                    TaskFlow AI account
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-white">
                    Profile information
                  </h2>
                  <p className="mt-2 text-sm text-white/80">
                    Personalize how you appear in your workspace.
                  </p>
                </div>
                <div className="space-y-6 p-6 sm:p-8">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-blue-100 bg-blue-100 text-3xl font-extrabold text-blue-700 shadow-sm">
                      {avatarDataUrlDraft || (!avatarRemoved && avatarUrl) ? (
                        <img
                          src={avatarDataUrlDraft || avatarUrl}
                          alt={`${displayName} avatar`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        userInitials
                      )}
                      <span className="pointer-events-none absolute bottom-0 right-0 grid size-8 place-items-center rounded-full border-2 border-white bg-blue-600 text-white">
                        <Camera size={15} />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900">
                        Profile photo
                      </h3>
                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        JPG, PNG, or WEBP. Maximum size 2 MB.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                          <Upload size={16} /> Choose photo
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleAvatarFileChange}
                            className="sr-only"
                          />
                        </label>
                        {(avatarDataUrlDraft ||
                          (!avatarRemoved && avatarUrl)) && (
                          <button
                            type="button"
                            onClick={() => {
                              setAvatarDataUrlDraft(null);
                              setAvatarRemoved(true);
                              setProfileSuccess("");
                            }}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Remove photo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-6">
                    <label
                      htmlFor="profile-name"
                      className="mb-2 block text-sm font-semibold text-slate-800"
                    >
                      Full name
                    </label>
                    <input
                      id="profile-name"
                      value={profileNameDraft}
                      onChange={(event) => {
                        setProfileNameDraft(event.target.value);
                        setProfileSuccess("");
                      }}
                      minLength={2}
                      maxLength={80}
                      required
                      autoComplete="name"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      placeholder="Enter your name"
                    />
                    <label
                      htmlFor="profile-email"
                      className="mb-2 mt-5 block text-sm font-semibold text-slate-800"
                    >
                      Email address
                    </label>
                    <input
                      id="profile-email"
                      value={displayEmail}
                      readOnly
                      className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                    />
                    <p className="mt-2 text-xs text-slate-400">
                      Email address cannot be changed here.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save size={16} />
                      {savingProfile ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={() => {
                        setProfileNameDraft(currentUser?.name ?? "");
                        setAvatarDataUrlDraft(null);
                        setAvatarRemoved(false);
                        setProfileError("");
                        setProfileSuccess("");
                      }}
                      className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </section>

              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                      <ShieldCheck size={19} />
                    </span>
                    <div>
                      <h2 className="font-bold text-slate-900">
                        Account details
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Your signed-in account
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        User ID
                      </p>
                      <p className="mt-1 break-all text-sm font-semibold text-slate-700">
                        {currentUser?.id || currentUser?._id || "—"}
                      </p>
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Name
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold text-slate-700">
                        {displayName}
                      </p>
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Email
                      </p>
                      <p className="mt-1 break-all text-sm font-semibold text-slate-700">
                        {displayEmail}
                      </p>
                    </div>
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Status
                      </p>
                      <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Signed in
                      </span>
                    </div>
                  </div>
                </section>
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                      <Pencil size={18} />
                    </span>
                    <div>
                      <h2 className="font-bold text-slate-900">Profile tip</h2>
                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        Use a clear photo and the name your teammates recognize.
                        Your changes are saved to your account when you click
                        Save changes.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </form>
          </div>
        ) : activeNav === "Help & support" ? (
          <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-blue-500">
              Support
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Help & support
            </h1>
            <section className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex gap-3">
                <CircleHelp className="mt-0.5 text-blue-500" />
                <div>
                  <h2 className="font-bold text-slate-900">Getting started</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Create a project, open its Kanban board, and organize work
                    into tasks.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <FolderKanban className="mt-0.5 text-blue-500" />
                <div>
                  <h2 className="font-bold text-slate-900">Projects</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Use Projects to create projects and open their boards.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Users className="mt-0.5 text-blue-500" />
                <div>
                  <h2 className="font-bold text-slate-900">Team</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Team management can be enabled once the team API is
                    available.
                  </p>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
            {/* Welcome */}

            <section className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="mb-3 flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-blue-500">
                  <span className="size-1.5 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                  YOUR WORKSPACE AT A GLANCE
                </p>

                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                  {timeGreeting} <span className="text-blue-500">✦</span>
                </h1>

                <p className="mt-2 text-sm text-slate-400">
                  Here’s what’s happening with your projects today.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 shadow-sm">
                    <CalendarDays size={16} className="shrink-0 text-blue-400" />
                    <span className="text-sm font-medium text-slate-200">{liveDayAndDate}</span>
                  </div>
                  <div
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-2.5 shadow-sm"
                    aria-label={`Current local time ${liveTime}`}
                  >
                    <Clock3 size={16} className="shrink-0 text-blue-400" />
                    <time className="min-w-[5.5rem] font-mono text-sm font-semibold tabular-nums text-blue-300">
                      {liveTime}
                    </time>
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Live</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700"
              >
                <Plus size={18} />
                New project
              </button>
            </section>

            {/* Statistics */}

            <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  title: "Total projects",

                  value: loading ? "—" : String(projects.length),

                  sub: "Projects you can access",

                  icon: FolderKanban,

                  color: "bg-blue-100 text-blue-600",
                },

                {
                  title: "Open tasks",

                  value: taskStatsLoading ? "—" : String(taskStats.open),

                  sub: "Tasks not yet completed",

                  icon: ListTodo,

                  color: "bg-sky-100 text-sky-600",
                },

                {
                  title: "Tasks completed",

                  value: taskStatsLoading ? "—" : String(taskStats.completed),

                  sub: "Tasks marked as done",

                  icon: CheckCircle2,

                  color: "bg-emerald-100 text-emerald-600",
                },

                {
                  title: "Due soon",

                  value: taskStatsLoading ? "—" : String(taskStats.dueSoon),

                  sub: "Due in the next 7 days",

                  icon: Clock3,

                  color: "bg-orange-100 text-orange-600",
                },
              ].map(({ title, value, sub, icon: Icon, color }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span
                      className={`grid size-10 place-items-center rounded-xl ${color}`}
                    >
                      <Icon size={19} />
                    </span>

                    <span className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] text-slate-400">
                      Overview
                    </span>
                  </div>

                  <p className="text-3xl font-extrabold tracking-tight text-slate-900">
                    {value}
                  </p>

                  <p className="mt-2 text-sm font-semibold">{title}</p>

                  <p className="mt-1 text-xs text-slate-400">{sub}</p>
                </article>
              ))}
            </section>

            {/* Projects and AI panel */}

            <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-6 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {activeNav === "Projects"
                        ? "All projects"
                        : "Your projects"}
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Keep your work organized and moving forward.
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveNav("Projects")}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    View all <ArrowUpRight size={14} />
                  </button>
                </div>

                {loadError && (
                  <div className="mb-4 flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-semibold text-rose-800">
                        Couldn’t load projects
                      </p>

                      <p className="mt-1 break-words text-xs text-rose-700">
                        {loadError}
                      </p>
                    </div>

                    <button
                      onClick={() => void loadProjects()}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {loading ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[1, 2, 3, 4].map((item) => (
                      <div
                        key={item}
                        className="animate-pulse rounded-xl border border-slate-200 p-4"
                      >
                        <div className="mb-4 size-9 rounded-xl bg-slate-100" />

                        <div className="mb-3 h-3 w-2/3 rounded bg-slate-100" />

                        <div className="mb-6 h-3 w-full rounded bg-slate-100" />

                        <div className="h-3 w-1/2 rounded bg-slate-100" />
                      </div>
                    ))}
                  </div>
                ) : filteredProjects.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredProjects.map((project, index) => (
                      <article
                        key={project._id ?? project.id ?? project.name}
                        className="group rounded-xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md hover:shadow-blue-100/60"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <span
                            className={`grid size-10 place-items-center rounded-xl ${projectColors[index % projectColors.length]}`}
                          >
                            <FolderKanban size={19} />
                          </span>

                          <span className="rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
                            {project.status ?? "Project"}
                          </span>
                        </div>

                        <h3 className="break-words text-sm font-bold text-slate-800">
                          {project.name}
                        </h3>

                        <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">
                          {project.description?.trim() ||
                            "A place to plan work, track progress, and collaborate."}
                        </p>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                          <span className="grid size-7 place-items-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-700">
                            {getInitials(project.name) || "P"}
                          </span>

                          <span className="text-[10px] text-slate-400">
                            {formatDate(project.updatedAt ?? project.createdAt)}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            const id = project._id ?? project.id;

                            if (!id) {
                              setLoadError(
                                "This project is missing its ID. Refresh the project list and try again.",
                              );

                              return;
                            }

                            setSelectedProject(project);

                            setActiveNav(project.name);
                          }}
                          className="mt-3 flex w-full items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 transition hover:border-blue-400 hover:bg-blue-100 hover:text-blue-900"
                        >
                          <span>Open Kanban board</span>

                          <ArrowUpRight size={15} />
                        </button>
                      </article>
                    ))}

                    <button
                      onClick={() => setModalOpen(true)}
                      className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-5 text-center transition hover:border-blue-400 hover:bg-blue-50"
                    >
                      <span className="grid size-10 place-items-center rounded-xl bg-blue-100 text-blue-600">
                        <Plus size={20} />
                      </span>

                      <span className="text-xs font-bold text-slate-700">
                        Create a new project
                      </span>

                      <span className="text-[11px] text-slate-400">
                        Start with a fresh workspace
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center px-5 py-10 text-center">
                    <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-blue-100 text-blue-600">
                      <FolderKanban size={26} />
                    </span>

                    <h3 className="text-sm font-bold text-slate-800">
                      {search
                        ? "No matching projects"
                        : "Your next big idea starts here"}
                    </h3>

                    <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">
                      {search
                        ? "Try a different search term."
                        : "Create a project to organize tasks, set priorities, and track progress in one place."}
                    </p>

                    {!search && (
                      <button
                        onClick={() => setModalOpen(true)}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        <Plus size={16} /> Create your first project
                      </button>
                    )}
                  </div>
                )}
              </div>

              <aside className="space-y-5">
                <section className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-sky-950 via-blue-900 to-blue-600 p-6 text-white shadow-lg shadow-blue-200/50">
                  <div className="absolute -right-12 -top-12 -z-10 size-48 rounded-full bg-blue-300/20 blur-2xl" />

                  <div className="mb-5 flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-xl border border-white/20 bg-white/10 text-blue-100">
                      <Sparkles size={20} />
                    </span>

                    <span className="rounded-md border border-white/20 px-2 py-1 text-[9px] font-semibold tracking-widest text-blue-100">
                      TASKFLOW AI
                    </span>
                  </div>

                  <h2 className="text-2xl font-extrabold leading-tight tracking-tight">
                    Make room for
                    <br />
                    your best work.
                  </h2>

                  <p className="mt-3 text-xs leading-5 text-blue-100/80">
                    Turn big goals into clear next steps. Open a project to
                    generate task drafts and suggested subtasks with AI.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      if (projects.length > 0) {
                        // The AI planner is available in the new-task form on a project board.
                        const project = projects[0];
                        setSelectedProject(project);
                        setActiveNav(project.name);
                      } else {
                        // A project is required by the AI task-generation API.
                        setActiveNav("Projects");
                        setModalOpen(true);
                      }
                    }}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-xs font-bold text-blue-800 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white/80"
                  >
                    {projects.length > 0
                      ? "Open AI planner"
                      : "Create a project to start"}
                    <ArrowUpRight size={15} />
                  </button>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        Recent activity
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        The latest updates across your projects.
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Refresh recent activity"
                      onClick={() => void loadActivities()}
                      disabled={activityLoading}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"
                    >
                      <Activity
                        size={18}
                        className={activityLoading ? "animate-pulse" : ""}
                      />
                    </button>
                  </div>

                  {activityLoading && activities.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">
                      Loading recent activity...
                    </p>
                  ) : activityError ? (
                    <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                      <p role="alert" className="text-xs text-rose-700">
                        {activityError}
                      </p>
                      <button
                        type="button"
                        onClick={() => void loadActivities()}
                        className="mt-2 text-xs font-semibold text-rose-700 underline"
                      >
                        Try again
                      </button>
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="flex flex-col items-center px-3 py-7 text-center">
                      <span className="mb-3 grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
                        <Clock3 size={20} />
                      </span>
                      <p className="text-xs font-semibold text-slate-700">
                        It’s quiet for now
                      </p>
                      <p className="mt-1 max-w-xs text-[11px] leading-5 text-slate-400">
                        Project activity will appear here as you create or
                        update tasks.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto overscroll-contain divide-y divide-slate-100 pr-1 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
                      {activities.map((item) => (
                        <div
                          key={item._id}
                          className="flex gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                            {item.type === "comment.added" ? (
                              <MessageSquare size={17} />
                            ) : item.type.startsWith("task.") ? (
                              <ListTodo size={17} />
                            ) : (
                              <FolderKanban size={17} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-xs font-semibold leading-5 text-slate-700">
                              {item.message}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {item.actor?.name ??
                                item.actor?.email ??
                                "Workspace member"}
                              {item.project?.name
                                ? ` · ${item.project.name}`
                                : ""}
                            </p>
                            {item.task?.title && (
                              <p className="mt-1 truncate text-[11px] text-blue-600">
                                Task: {item.task.title}
                              </p>
                            )}
                            <p className="mt-1 text-[10px] text-slate-400">
                              {formatRelativeTime(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="mt-3 flex gap-2 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-500">
                    <Sparkles
                      size={15}
                      className="mt-0.5 shrink-0 text-blue-500"
                    />
                    Tip: break large tasks into smaller, actionable steps.
                  </p>
                </section>
              </aside>
            </section>

            <footer className="flex justify-between gap-4 py-6 text-[10px] text-slate-400">
              <span>© 2026 TaskFlow AI</span>

              <span>
                Built for focused work{" "}
                <span className="text-blue-500">✦</span>
              </span>
            </footer>
          </div>
        )}
      </main>

      {/* Create project modal */}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
            className="my-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7"
          >
            <div className="mb-6 flex items-start justify-between">
              <div className="flex gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-blue-100 text-blue-600">
                  <FolderKanban size={20} />
                </span>

                <div>
                  <h2
                    id="create-project-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    Create a project
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Give your next piece of work a home.
                  </p>
                </div>
              </div>

              <button
                className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                aria-label="Close modal"
                onClick={() => setModalOpen(false)}
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleCreateProject}>
              <label
                htmlFor="project-name"
                className="mb-2 block text-xs font-semibold text-slate-700"
              >
                Project name <span className="text-rose-500">*</span>
              </label>

              <input
                id="project-name"
                autoFocus
                required
                minLength={2}
                maxLength={100}
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="e.g. Website redesign"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />

              <label
                htmlFor="project-description"
                className="mb-2 mt-5 block text-xs font-semibold text-slate-700"
              >
                Description{" "}
                <span className="font-normal text-slate-400">Optional</span>
              </label>

              <textarea
                id="project-description"
                rows={3}
                maxLength={3000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What are you planning to accomplish?"
                className="w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm leading-5 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />

              {createError && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"
                >
                  {createError}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-200 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {creating ? (
                    "Creating..."
                  ) : (
                    <>
                      <Plus size={16} /> Create project
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
