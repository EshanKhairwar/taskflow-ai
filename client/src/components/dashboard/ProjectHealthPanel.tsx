import type { Task } from "../../types";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  ShieldCheck,
  Target,
} from "lucide-react";

type ProjectHealthPanelProps = {
  tasks: Task[];
  projectName: string;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export default function ProjectHealthPanel({
  tasks,
  projectName,
}: ProjectHealthPanelProps) {
  const today = startOfDay(new Date());
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const completedTasks = tasks.filter((task) => task.status === "done");
  const openTasks = tasks.filter((task) => task.status !== "done");

  const overdueTasks = openTasks.filter((task) => {
    if (!task.dueDate) return false;
    const dueDate = startOfDay(new Date(task.dueDate));
    return !Number.isNaN(dueDate.getTime()) && dueDate < today;
  });

  const dueSoonTasks = openTasks.filter((task) => {
    if (!task.dueDate) return false;
    const dueDate = startOfDay(new Date(task.dueDate));
    return !Number.isNaN(dueDate.getTime()) && dueDate >= today && dueDate <= threeDaysFromNow;
  });

  const missingDateTasks = openTasks.filter((task) => !task.dueDate);
  const completion = tasks.length
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : 0;
  const score = Math.max(0, Math.min(100, Math.round(
    100 - overdueTasks.length * 12 - dueSoonTasks.length * 4 - missingDateTasks.length * 2 + completion * 0.15,
  )));
  const tone = score >= 80 ? "text-emerald-400" : score >= 55 ? "text-amber-400" : "text-rose-400";
  const health = score >= 80 ? "Healthy" : score >= 55 ? "Needs attention" : "At risk";

  const metrics = [
    { label: "Completed", value: `${completedTasks.length}/${tasks.length}`, icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Overdue", value: overdueTasks.length, icon: AlertTriangle, color: "text-rose-400" },
    { label: "Due in 3 days", value: dueSoonTasks.length, icon: CalendarClock, color: "text-amber-400" },
    { label: "No due date", value: missingDateTasks.length, icon: Activity, color: "text-sky-400" },
  ];

  const alerts = [
    overdueTasks.length > 0 ? {
      key: "overdue", title: `${overdueTasks.length} overdue ${overdueTasks.length === 1 ? "task needs" : "tasks need"} attention`,
      description: "Review the overdue work, update its status, or agree on a new deadline.",
      icon: AlertTriangle, tone: "border-rose-500/25 bg-rose-500/10 text-rose-300",
    } : null,
    dueSoonTasks.length > 0 ? {
      key: "due-soon", title: `${dueSoonTasks.length} ${dueSoonTasks.length === 1 ? "task is" : "tasks are"} due soon`,
      description: "Confirm an owner and prioritize these tasks before their deadlines.",
      icon: CalendarClock, tone: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    } : null,
    missingDateTasks.length > 0 ? {
      key: "missing-dates", title: `${missingDateTasks.length} open ${missingDateTasks.length === 1 ? "task has" : "tasks have"} no due date`,
      description: "Add realistic due dates so the team can plan and spot risks earlier.",
      icon: CircleAlert, tone: "border-sky-500/25 bg-sky-500/10 text-sky-300",
    } : null,
  ].filter((alert): alert is NonNullable<typeof alert> => Boolean(alert));

  return (
    <section className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-400">Project health</p>
          <h2 className="mt-1 text-lg font-bold text-white">{projectName}</h2>
          <p className="mt-1 text-xs text-slate-400">A quick risk check based on task progress and deadlines.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
          <ShieldCheck className={tone} size={24} />
          <div>
            <div className={`text-2xl font-extrabold ${tone}`}>{score}<span className="text-xs font-semibold text-slate-500">/100</span></div>
            <div className={`text-xs font-semibold ${tone}`}>{health}</div>
          </div>
        </div>
      </div>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full transition-all ${score >= 80 ? "bg-emerald-500" : score >= 55 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${score}%` }} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400"><Icon className={color} size={15} />{label}</div>
            <div className="mt-2 text-xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center gap-2"><Target size={16} className="text-blue-400" /><h3 className="text-sm font-semibold text-white">Recommended actions</h3></div>
        {tasks.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <ClipboardCheck className="mt-0.5 text-blue-400" size={18} />
            <div><p className="text-sm font-medium text-white">Start by adding your first task</p><p className="mt-1 text-xs leading-5 text-slate-400">Once tasks are added, this panel will highlight deadlines and project risks.</p></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <CheckCircle2 className="mt-0.5 text-emerald-400" size={18} />
            <div><p className="text-sm font-medium text-emerald-300">No immediate deadline risks</p><p className="mt-1 text-xs leading-5 text-slate-400">Keep task statuses current and review the project again as deadlines approach.</p></div>
          </div>
        ) : (
          <div className="grid gap-2">
            {alerts.map(({ key, title, description, icon: Icon, tone: alertTone }) => (
              <div key={key} className={`flex items-start gap-3 rounded-xl border p-3 ${alertTone}`}>
                <Icon className="mt-0.5 shrink-0" size={17} />
                <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-300">{description}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-[11px] leading-5 text-slate-500">Health score is an indicative heuristic, not a prediction. It starts at 100, subtracts 12 per overdue task, 4 per task due within 3 days, and 2 per open task without a due date, with a small completion bonus.</p>
    </section>
  );
}
