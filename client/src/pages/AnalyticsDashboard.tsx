import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FolderKanban,
  RefreshCw,
  Target,
  Users,
  UserRound,
} from "lucide-react";
import { apiRequest } from "../api/client";

interface Project {
  _id?: string;
  id?: string;
  name: string;
  status?: string;
  dueDate?: string | null;
}

type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
type TaskPriority = "low" | "medium" | "high";

interface AnalyticsTask {
  _id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  project: string | { _id: string };
  createdAt?: string;
  updatedAt?: string;
}

interface TaskListResponse {
  tasks?: AnalyticsTask[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ProjectTasks {
  project: Project;
  tasks: AnalyticsTask[];
}

interface TeamMemberMetric {
  userId: string;
  name: string;
  email: string;
  projectCount: number;
  assigned: number;
  completed: number;
  inProgress: number;
  inReview: number;
  overdue: number;
  highPriority: number;
  completionRate: number;
}

interface TeamProductivityResponse {
  summary?: {
    members: number;
    assigned: number;
    completed: number;
    overdue: number;
  };
  members?: TeamMemberMetric[];
}

interface AnalyticsDashboardProps {
  projects: Project[];
  onOpenProject: (project: Project) => void;
}

const statusMeta: Record<TaskStatus, { label: string; color: string; bar: string }> = {
  todo: { label: "To do", color: "text-slate-600", bar: "bg-slate-400" },
  in_progress: { label: "In progress", color: "text-sky-700", bar: "bg-sky-500" },
  in_review: { label: "In review", color: "text-amber-700", bar: "bg-amber-500" },
  done: { label: "Completed", color: "text-emerald-700", bar: "bg-emerald-500" },
};

const priorityMeta: Record<TaskPriority, { label: string; bar: string; text: string }> = {
  low: { label: "Low", bar: "bg-slate-400", text: "text-slate-600" },
  medium: { label: "Medium", bar: "bg-amber-500", text: "text-amber-700" },
  high: { label: "High", bar: "bg-rose-500", text: "text-rose-700" },
};

const validStatuses: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];
const validPriorities: TaskPriority[] = ["low", "medium", "high"];

function normalizeStatus(value: unknown): TaskStatus {
  return validStatuses.includes(value as TaskStatus) ? (value as TaskStatus) : "todo";
}

function normalizePriority(value: unknown): TaskPriority {
  return validPriorities.includes(value as TaskPriority) ? (value as TaskPriority) : "medium";
}

function projectIdOf(project: Project) {
  return project._id ?? project.id ?? "";
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatShortDate(value?: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getDueDate(task: AnalyticsTask): Date | null {
  if (!task.dueDate) return null;
  const date = new Date(task.dueDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  tone: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className={`grid size-10 place-items-center rounded-xl ${tone}`}>
          <Icon size={19} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Live data
        </span>
      </div>
      <p className="text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </article>
  );
}

export default function AnalyticsDashboard({
  projects,
  onOpenProject,
}: AnalyticsDashboardProps) {
  const [projectTasks, setProjectTasks] = useState<ProjectTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [teamMetrics, setTeamMetrics] = useState<TeamMemberMetric[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState("");

  const loadAnalytics = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const results = await Promise.all(
        projects.map(async (project): Promise<ProjectTasks> => {
          const id = projectIdOf(project);
          if (!id) return { project, tasks: [] };

          const allTasks: AnalyticsTask[] = [];
          let page = 1;
          let totalPages = 1;

          // The API caps page size at 100. Fetch every page so the analytics
          // represent all project tasks rather than only the first page.
          do {
            const response = await apiRequest<TaskListResponse>(
              `/projects/${encodeURIComponent(id)}/tasks?page=${page}&limit=100`,
              { method: "GET" },
            );
            const pageTasks = Array.isArray(response.tasks) ? response.tasks : [];
            allTasks.push(...pageTasks.map((task) => ({
              ...task,
              status: normalizeStatus(task.status),
              priority: normalizePriority(task.priority),
            })));
            totalPages = Math.max(1, response.pagination?.totalPages ?? (pageTasks.length < 100 ? page : page + 1));
            page += 1;
          } while (page <= totalPages && page <= 1000);

          return { project, tasks: allTasks };
        }),
      );

      setProjectTasks(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load analytics data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projects]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const loadTeamProductivity = useCallback(async () => {
    setTeamLoading(true);
    setTeamError("");
    try {
      const response = await apiRequest<TeamProductivityResponse>(
        "/analytics/team-productivity",
        { method: "GET" },
      );
      setTeamMetrics(Array.isArray(response.members) ? response.members : []);
    } catch (err) {
      setTeamError(
        err instanceof Error
          ? err.message
          : "Could not load team productivity.",
      );
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeamProductivity();
  }, [loadTeamProductivity]);

  const tasks = useMemo(
    () => projectTasks.flatMap((item) => item.tasks),
    [projectTasks],
  );

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = dayStart(now);
    const sevenDaysFromNow = todayStart + 7 * 24 * 60 * 60 * 1000;
    const completed = tasks.filter((task) => task.status === "done").length;
    const open = tasks.length - completed;
    const overdue = tasks.filter((task) => {
      const due = getDueDate(task);
      return Boolean(due && dayStart(due) < todayStart && task.status !== "done");
    }).length;
    const dueSoon = tasks.filter((task) => {
      const due = getDueDate(task);
      const dueDay = due ? dayStart(due) : null;
      return dueDay !== null && dueDay >= todayStart && dueDay <= sevenDaysFromNow && task.status !== "done";
    }).length;

    return {
      total: tasks.length,
      completed,
      open,
      overdue,
      dueSoon,
      completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    };
  }, [tasks]);

  const statusCounts = useMemo(() => ({
    todo: tasks.filter((task) => task.status === "todo").length,
    in_progress: tasks.filter((task) => task.status === "in_progress").length,
    in_review: tasks.filter((task) => task.status === "in_review").length,
    done: tasks.filter((task) => task.status === "done").length,
  }), [tasks]);

  const priorityCounts = useMemo(() => ({
    low: tasks.filter((task) => task.priority === "low").length,
    medium: tasks.filter((task) => task.priority === "medium").length,
    high: tasks.filter((task) => task.priority === "high").length,
  }), [tasks]);

  const projectSummaries = useMemo(() => {
    return projectTasks.map(({ project, tasks: projectTaskList }) => {
      const completed = projectTaskList.filter((task) => task.status === "done").length;
      return {
        project,
        total: projectTaskList.length,
        completed,
        open: projectTaskList.length - completed,
        percent: projectTaskList.length ? Math.round((completed / projectTaskList.length) * 100) : 0,
      };
    }).sort((a, b) => b.total - a.total);
  }, [projectTasks]);

  const upcomingTasks = useMemo(() => {
    const todayStart = dayStart(new Date());
    return projectTasks.flatMap(({ project, tasks: projectTaskList }) =>
      projectTaskList
        .filter((task) => task.status !== "done" && getDueDate(task))
        .map((task) => ({ task, project, due: getDueDate(task)! })),
    )
      .filter(({ due }) => dayStart(due) >= todayStart)
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .slice(0, 6);
  }, [projectTasks]);

  const hasTasks = tasks.length > 0;

  return (
    <section className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-violet-600">
            <BarChart3 size={15} /> WORKSPACE INSIGHTS
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Analytics dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            A live overview of task progress, priorities, and deadlines across your projects.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAnalytics(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh data"}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-5 flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center">
          <span>{error}</span>
          <button type="button" onClick={() => void loadAnalytics(true)} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total tasks" value={stats.total} detail={`Across ${projects.length} accessible project${projects.length === 1 ? "" : "s"}`} icon={CircleDashed} tone="bg-violet-100 text-violet-700" />
            <MetricCard label="Open tasks" value={stats.open} detail="Tasks not marked as completed" icon={Activity} tone="bg-sky-100 text-sky-700" />
            <MetricCard label="Completed" value={stats.completed} detail={`${stats.completionRate}% overall completion`} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" />
            <MetricCard label="Overdue" value={stats.overdue} detail={`${stats.dueSoon} open task${stats.dueSoon === 1 ? "" : "s"} due in the next 7 days`} icon={AlertTriangle} tone="bg-rose-100 text-rose-700" />
          </div>

          <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Task status</h2>
                  <p className="mt-1 text-xs text-slate-500">How work is distributed across your workflow.</p>
                </div>
                <span className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-700">{stats.completionRate}% done</span>
              </div>

              <div className="mb-6 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-label="Task status distribution">
                {(["todo", "in_progress", "in_review", "done"] as TaskStatus[]).map((status) => (
                  <div
                    key={status}
                    title={`${statusMeta[status].label}: ${statusCounts[status]}`}
                    className={statusMeta[status].bar}
                    style={{ width: stats.total ? `${(statusCounts[status] / stats.total) * 100}%` : "0%" }}
                  />
                ))}
              </div>

              <div className="space-y-4">
                {(["todo", "in_progress", "in_review", "done"] as TaskStatus[]).map((status) => {
                  const count = statusCounts[status];
                  const percent = stats.total ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={status}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className={`text-sm font-semibold ${statusMeta[status].color}`}>{statusMeta[status].label}</span>
                        <span className="text-xs font-semibold tabular-nums text-slate-500">{count} <span className="font-normal text-slate-400">({percent}%)</span></span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full transition-all ${statusMeta[status].bar}`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {!hasTasks && <p className="mt-5 text-sm text-slate-400">Create tasks in a project to see your status chart.</p>}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-6">
                <h2 className="text-base font-bold text-slate-900">Priority breakdown</h2>
                <p className="mt-1 text-xs text-slate-500">See where urgent work is concentrated.</p>
              </div>
              <div className="space-y-5">
                {(["high", "medium", "low"] as TaskPriority[]).map((priority) => {
                  const count = priorityCounts[priority];
                  const percent = stats.total ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={priority}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className={`text-sm font-semibold ${priorityMeta[priority].text}`}>{priorityMeta[priority].label} priority</span>
                        <span className="text-xs font-semibold tabular-nums text-slate-500">{count} ({percent}%)</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${priorityMeta[priority].bar}`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 rounded-xl border border-rose-100 bg-rose-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-rose-600"><AlertTriangle size={17} /></span>
                  <div>
                    <p className="text-sm font-bold text-rose-800">{priorityCounts.high} high-priority task{priorityCounts.high === 1 ? "" : "s"}</p>
                    <p className="mt-1 text-xs leading-5 text-rose-700">Review these first to keep important work moving.</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-violet-600">
                  <Users size={14} /> TEAM PERFORMANCE
                </p>
                <h2 className="text-base font-bold text-slate-900">Team productivity</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Assigned workload, completion, and overdue tasks for members in your accessible projects.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadTeamProductivity()}
                disabled={teamLoading}
                className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw size={13} className={teamLoading ? "animate-spin" : ""} />
                Refresh team
              </button>
            </div>

            {teamError ? (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <p>{teamError}</p>
                <button type="button" onClick={() => void loadTeamProductivity()} className="mt-2 font-semibold underline">Try again</button>
              </div>
            ) : teamLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
              </div>
            ) : teamMetrics.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-3">Team member</th>
                      <th className="px-3 py-3">Assigned</th>
                      <th className="px-3 py-3">Completed</th>
                      <th className="px-3 py-3">In progress</th>
                      <th className="px-3 py-3">Overdue</th>
                      <th className="px-3 py-3">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMetrics.map((member) => (
                      <tr key={member.userId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                              {member.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || <UserRound size={15} />}
                            </span>
                            <span className="min-w-0">
                              <span className="block max-w-[190px] truncate text-sm font-semibold text-slate-800">{member.name}</span>
                              <span className="block max-w-[190px] truncate text-[11px] text-slate-400">{member.projectCount} project{member.projectCount === 1 ? "" : "s"}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold tabular-nums text-slate-700">{member.assigned}</td>
                        <td className="px-3 py-3 text-sm font-semibold tabular-nums text-emerald-700">{member.completed}</td>
                        <td className="px-3 py-3 text-sm font-semibold tabular-nums text-sky-700">{member.inProgress}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${member.overdue ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"}`}>{member.overdue}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-violet-500" style={{ width: `${member.completionRate}%` }} />
                            </div>
                            <span className="text-xs font-bold tabular-nums text-slate-600">{member.completionRate}%</span>
                          </div>
                          {member.highPriority > 0 && <span className="mt-1 block text-[10px] font-medium text-rose-600">{member.highPriority} high priority</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                <Users size={22} className="mx-auto text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">No team members found</p>
                <p className="mt-1 text-xs text-slate-400">Add team members to your projects and assign tasks to see productivity metrics.</p>
              </div>
            )}
          </section>

          <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Project progress</h2>
                  <p className="mt-1 text-xs text-slate-500">Completion percentage for each project.</p>
                </div>
                <FolderKanban size={18} className="text-slate-400" />
              </div>
              {projectSummaries.length ? (
                <div className="space-y-5">
                  {projectSummaries.map((summary) => (
                    <div key={projectIdOf(summary.project) || summary.project.name}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <button type="button" onClick={() => onOpenProject(summary.project)} className="truncate text-left text-sm font-semibold text-slate-700 hover:text-violet-700">
                          {summary.project.name}
                        </button>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{summary.percent}% · {summary.completed}/{summary.total}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${summary.percent}%` }} />
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400">{summary.open} open task{summary.open === 1 ? "" : "s"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">No projects are available yet.</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Upcoming deadlines</h2>
                  <p className="mt-1 text-xs text-slate-500">The next open tasks with a due date.</p>
                </div>
                <CalendarClock size={18} className="text-slate-400" />
              </div>
              {upcomingTasks.length ? (
                <div className="space-y-3">
                  {upcomingTasks.map(({ task, project, due }) => (
                    <button
                      type="button"
                      key={`${projectIdOf(project)}-${task._id}`}
                      onClick={() => onOpenProject(project)}
                      className="flex w-full items-start gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-violet-200 hover:bg-violet-50/50"
                    >
                      <span className={`mt-0.5 size-2 shrink-0 rounded-full ${priorityMeta[task.priority].bar}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-700">{task.title}</span>
                        <span className="mt-1 block truncate text-xs text-slate-400">{project.name}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-slate-500">{formatShortDate(due.toISOString())}</span>
                      <ArrowRight size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <span className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-400"><Clock3 size={19} /></span>
                  <p className="mt-3 text-sm font-semibold text-slate-700">No upcoming deadlines</p>
                  <p className="mt-1 text-xs text-slate-400">Add due dates to open tasks to see them here.</p>
                </div>
              )}
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-violet-600 shadow-sm"><Target size={19} /></span>
              <div>
                <p className="text-sm font-bold text-slate-800">Workspace completion</p>
                <p className="mt-1 text-xs text-slate-500">{stats.completed} of {stats.total} tasks completed across your projects.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-28 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-violet-600" style={{ width: `${stats.completionRate}%` }} />
              </div>
              <span className="text-lg font-extrabold text-violet-800">{stats.completionRate}%</span>
            </div>
          </div>
        </>
      )}

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
        <span>Analytics are calculated from task records returned by your project API.</span>
        <span>{projectTasks.length} project{projectTasks.length === 1 ? "" : "s"} loaded · {tasks.length} tasks loaded</span>
      </footer>
    </section>
  );
}
