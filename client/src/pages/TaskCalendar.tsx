import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import { apiRequest } from "../api/client";

interface Project {
  _id?: string;
  id?: string;
  name: string;
}

type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
type TaskPriority = "low" | "medium" | "high";

interface CalendarTask {
  _id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  project: string | { _id: string };
  assignee?: string | { name?: string; email?: string } | null;
}

interface TasksResponse {
  tasks: CalendarTask[];
}

interface TaskCalendarProps {
  projects: Project[];
  onOpenProject: (project: Project) => void;
}

const statusLabel: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

const statusStyles: Record<TaskStatus, string> = {
  todo: "border-slate-200 bg-slate-100 text-slate-700",
  in_progress: "border-sky-200 bg-sky-50 text-sky-700",
  in_review: "border-amber-200 bg-amber-50 text-amber-700",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getAssigneeName(task: CalendarTask) {
  if (!task.assignee || typeof task.assignee === "string") return "Unassigned";
  return task.assignee.name || task.assignee.email || "Unassigned";
}

export default function TaskCalendar({
  projects,
  onOpenProject,
}: TaskCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));

  async function loadTasks() {
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all(
        projects.map(async (project) => {
          const projectId = project._id ?? project.id;
          if (!projectId) return [] as CalendarTask[];
          const response = await apiRequest<TasksResponse>(
            `/projects/${encodeURIComponent(projectId)}/tasks?limit=100`,
            { method: "GET" },
          );
          return (response.tasks ?? []).map((task) => ({
            ...task,
            project: task.project ?? projectId,
          }));
        }),
      );
      setTasks(responses.flat());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load calendar tasks.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
    // Reload when the available project list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const projectById = useMemo(() => {
    return new Map(
      projects.flatMap((project) => {
        const id = project._id ?? project.id;
        return id ? [[id, project] as const] : [];
      }),
    );
  }, [projects]);

  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, CalendarTask[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const parsed = new Date(task.dueDate);
      if (Number.isNaN(parsed.getTime())) continue;
      const key = dateKey(parsed);
      grouped.set(key, [...(grouped.get(key) ?? []), task]);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => {
        const statusOrder = ["todo", "in_progress", "in_review", "done"];
        return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
      });
    }
    return grouped;
  }, [tasks]);

  const calendarDays = useMemo(() => {
    const first = startOfMonth(month);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - mondayOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [month]);

  const selectedTasks = tasksByDate.get(selectedDate) ?? [];
  const monthTitle = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  function changeMonth(offset: number) {
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  return (
    <section className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
            <CalendarDays size={15} /> Task planning
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {monthTitle}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Tasks are grouped by their due date. Select a day to view its
            deadlines.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              setMonth(startOfMonth(today));
              setSelectedDate(dateKey(today));
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => void loadTasks()}
            disabled={loading}
            aria-label="Refresh calendar tasks"
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </button>
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Previous month"
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Next month"
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadTasks()}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                className="px-1 py-3 text-center text-xs font-bold text-slate-500 sm:px-3"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const inMonth = day.getMonth() === month.getMonth();
              const isToday = key === dateKey(new Date());
              const isSelected = key === selectedDate;
              const dayTasks = tasksByDate.get(key) ?? [];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  aria-pressed={isSelected}
                  className={`min-h-24 border-b border-r border-slate-100 p-1.5 text-left transition sm:min-h-32 sm:p-2 ${
                    isSelected
                      ? "bg-violet-50 ring-2 ring-inset ring-violet-400"
                      : "hover:bg-slate-50"
                  } ${!inMonth ? "bg-slate-50/70 text-slate-300" : "text-slate-700"}`}
                >
                  <span
                    className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday
                        ? "bg-violet-600 text-white"
                        : inMonth
                          ? "text-slate-700"
                          : "text-slate-300"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayTasks.slice(0, 2).map((task) => (
                      <span
                        key={task._id}
                        title={task.title}
                        className={`block truncate rounded border px-1 py-1 text-[10px] font-medium sm:px-1.5 ${statusStyles[task.status]}`}
                      >
                        {task.title}
                      </span>
                    ))}
                    {dayTasks.length > 2 && (
                      <span className="block px-1 text-[10px] font-semibold text-slate-500">
                        +{dayTasks.length - 2} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                  undefined,
                  {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  },
                )}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {selectedTasks.length}{" "}
                {selectedTasks.length === 1 ? "task" : "tasks"} due
              </p>
            </div>
            {loading && (
              <span className="text-xs text-slate-400">Loading…</span>
            )}
          </div>

          {selectedTasks.length ? (
            <div className="space-y-3">
              {selectedTasks.map((task) => {
                const projectId =
                  typeof task.project === "string"
                    ? task.project
                    : task.project?._id;
                const project = projectId
                  ? projectById.get(projectId)
                  : undefined;
                return (
                  <article
                    key={task._id}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="break-words text-sm font-semibold text-slate-800">
                        {task.title}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusStyles[task.status]}`}
                      >
                        {statusLabel[task.status]}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {project?.name ?? "Project"} · {getAssigneeName(task)}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          task.priority === "high"
                            ? "text-rose-600"
                            : task.priority === "medium"
                              ? "text-amber-600"
                              : "text-emerald-600"
                        }`}
                      >
                        {task.priority[0].toUpperCase() +
                          task.priority.slice(1)}{" "}
                        priority
                      </span>
                      {project && (
                        <button
                          type="button"
                          onClick={() => onOpenProject(project)}
                          className="text-xs font-semibold text-violet-600 hover:text-violet-800"
                        >
                          Open project →
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
              <CalendarDays size={26} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                No deadlines on this day
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Choose another date or add a due date to a task.
              </p>
            </div>
          )}
        </aside>
      </div>
      <p className="mt-4 text-xs text-slate-400">
        {loading
          ? "Syncing tasks…"
          : `${tasks.length} tasks loaded from ${projects.length} projects. Tasks without due dates do not appear on the calendar.`}
      </p>
    </section>
  );
}
