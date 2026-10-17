import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock3,
  ListTodo,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { apiRequest } from "../api/client";

type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
type TaskPriority = "low" | "medium" | "high";

interface ProjectInfo {
  _id: string;
  name: string;
}

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  project?: ProjectInfo | string;
}

interface TasksResponse {
  tasks?: Task[];
}

type TaskFilter = "all" | TaskStatus;

const filters: { label: string; value: TaskFilter }[] = [
  { label: "All tasks", value: "all" },
  { label: "To do", value: "todo" },
  { label: "In progress", value: "in_progress" },
  { label: "In review", value: "in_review" },
  { label: "Completed", value: "done" },
];

const statusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Completed",
};

const priorityStyles: Record<TaskPriority, string> = {
  low: "bg-sky-50 text-sky-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-rose-50 text-rose-700",
};

function getProjectName(project?: ProjectInfo | string): string {
  if (project && typeof project === "object") return project.name || "Project";
  return "Project";
}

function formatDueDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MyTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Do not append a task ID here. This endpoint lists all tasks assigned to you.
      const response = await apiRequest<TasksResponse>("/tasks/my-tasks");
      setTasks(Array.isArray(response?.tasks) ? response.tasks : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Unable to load your tasks.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    if (filter === "all") return tasks;
    return tasks.filter((task) => task.status === filter);
  }, [tasks, filter]);

  const completedCount = tasks.filter((task) => task.status === "done").length;
  const remainingCount = tasks.length - completedCount;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-blue-600">
            Your workload
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            My Tasks
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            All tasks assigned to you across your projects.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadTasks()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh tasks
        </button>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Total assigned"
          value={loading ? "—" : tasks.length}
          icon={<ListTodo size={20} />}
          iconClass="bg-blue-100 text-blue-600"
        />
        <SummaryCard
          label="Remaining"
          value={loading ? "—" : remainingCount}
          icon={<Clock3 size={20} />}
          iconClass="bg-amber-100 text-amber-600"
        />
        <SummaryCard
          label="Completed"
          value={loading ? "—" : completedCount}
          icon={<CheckCircle2 size={20} />}
          iconClass="bg-emerald-100 text-emerald-600"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-bold text-slate-900">Your task list</h2>
          <span className="text-xs text-slate-400">
            {loading ? "Loading..." : `${filteredTasks.length} tasks`}
          </span>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${filter === item.value ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {item.label}
              {item.value === "all" && !loading ? ` (${tasks.length})` : ""}
            </button>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                size={20}
                className="mt-0.5 shrink-0 text-rose-600"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-rose-800">
                  Could not load tasks
                </p>
                <p className="mt-1 break-words text-sm text-rose-700">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => void loadTasks()}
                  className="mt-3 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {!error && loading && (
          <div className="flex min-h-48 items-center justify-center gap-3 text-slate-500">
            <LoaderCircle size={23} className="animate-spin text-blue-600" />
            <span className="text-sm">Loading your tasks...</span>
          </div>
        )}

        {!loading && !error && filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-5 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-500">
              <ListTodo size={27} />
            </span>
            <h3 className="mt-4 font-bold text-slate-800">
              {tasks.length === 0
                ? "No tasks assigned yet"
                : "No tasks in this category"}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {tasks.length === 0
                ? "Tasks will appear here when they are assigned to your account."
                : "Choose another filter to see your other tasks."}
            </p>
          </div>
        )}

        {!loading && !error && filteredTasks.length > 0 && (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const dueDate = formatDueDate(task.dueDate);
              return (
                <article
                  key={task._id}
                  className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:shadow-sm sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">
                      {task.status === "done" ? (
                        <CheckCircle2 size={21} className="text-emerald-500" />
                      ) : (
                        <Circle size={21} className="text-slate-300" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                        <div className="min-w-0">
                          <h3
                            className={`break-words text-sm font-bold ${task.status === "done" ? "text-slate-400 line-through" : "text-slate-800"}`}
                          >
                            {task.title}
                          </h3>
                          {task.description && (
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-500">
                              {task.description}
                            </p>
                          )}
                        </div>
                        <span className="w-fit shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          {statusLabels[task.status] ?? task.status}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                          {getProjectName(task.project)}
                        </span>
                        {task.priority && (
                          <span
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${priorityStyles[task.priority]}`}
                          >
                            {task.priority[0].toUpperCase() +
                              task.priority.slice(1)}{" "}
                            priority
                          </span>
                        )}
                        {dueDate && (
                          <span className="text-xs text-slate-500">
                            Due {dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  iconClass,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span
          className={`grid size-10 place-items-center rounded-xl ${iconClass}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-4 text-3xl font-extrabold text-slate-900">{value}</p>
    </article>
  );
}
