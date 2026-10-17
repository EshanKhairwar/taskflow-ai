import type { Task } from "../../types";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleCheck,
  Clock3,
  ShieldCheck,
} from "lucide-react";

type HealthPanelProps = {
  tasks: Task[];
  projectName: string;
};

export default function ProjectHealthPanel({
  tasks,
  projectName,
}: HealthPanelProps) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

  const done = tasks.filter((task) => task.status === "done").length;
  const open = tasks.filter((task) => task.status !== "done");
  const overdue = open.filter((task) => {
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    return !Number.isNaN(dueDate.getTime()) && dueDate < today;
  }).length;
  const dueSoon = open.filter((task) => {
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    return (
      !Number.isNaN(dueDate.getTime()) &&
      dueDate >= today &&
      dueDate <= threeDaysFromNow
    );
  }).length;
  const missingDates = open.filter((task) => !task.dueDate).length;
  const completion = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(100 - overdue * 12 - dueSoon * 4 - missingDates * 2 + completion * 0.15),
    ),
  );

  const tone =
    score >= 80
      ? "text-emerald-400"
      : score >= 55
        ? "text-amber-400"
        : "text-rose-400";
  const health = score >= 80 ? "Healthy" : score >= 55 ? "Needs attention" : "At risk";

  const metrics = [
    { label: "Completed", value: `${done}/${tasks.length}`, icon: CheckCircle2 },
    { label: "Overdue", value: overdue, icon: AlertTriangle },
    { label: "Due in 3 days", value: dueSoon, icon: CalendarClock },
    { label: "No due date", value: missingDates, icon: Activity },
  ];

  const alerts = [
    ...(overdue > 0
      ? [
          {
            key: "overdue",
            title: `${overdue} overdue task${overdue === 1 ? "" : "s"}`,
            detail: "Review overdue work and update its status or deadline.",
            icon: AlertTriangle,
            style: "border-rose-500/25 bg-rose-500/10 text-rose-300",
          },
        ]
      : []),
    ...(dueSoon > 0
      ? [
          {
            key: "due-soon",
            title: `${dueSoon} task${dueSoon === 1 ? "" : "s"} due soon`,
            detail: "Confirm an owner and decide what needs to be completed first.",
            icon: Clock3,
            style: "border-amber-500/25 bg-amber-500/10 text-amber-300",
          },
        ]
      : []),
    ...(missingDates > 0
      ? [
          {
            key: "missing-dates",
            title: `${missingDates} task${missingDates === 1 ? " has" : "s have"} no due date`,
            detail: "Add realistic deadlines so upcoming work is easier to plan.",
            icon: CalendarClock,
            style: "border-blue-500/25 bg-blue-500/10 text-blue-300",
          },
        ]
      : []),
  ];

  return (
    <section className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm shadow-black/10 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-400">
            Project health
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">{projectName}</h2>
          <p className="mt-1 text-xs text-slate-400">
            A transparent estimate based on task progress and deadlines.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
          <ShieldCheck className={tone} size={24} />
          <div>
            <div className={`text-2xl font-extrabold ${tone}`}>
              {score}<span className="text-xs font-semibold text-slate-400">/100</span>
            </div>
            <div className={`text-xs font-semibold ${tone}`}>{health}</div>
          </div>
        </div>
      </div>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${
            score >= 80 ? "bg-emerald-500" : score >= 55 ? "bg-amber-500" : "bg-rose-500"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 transition-colors hover:border-blue-500/40 hover:bg-slate-800/80"
          >
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Icon size={15} />
              {label}
            </div>
            <div className="mt-2 text-xl font-bold text-slate-100">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <Activity size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-100">Recommended actions</h3>
        </div>
        {alerts.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2">
            {alerts.map(({ key, title, detail, icon: Icon, style }) => (
              <div key={key} className={`flex items-start gap-3 rounded-xl border p-3 ${style}`}>
                <Icon size={17} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
            <CircleCheck size={18} className="mt-0.5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">You’re in good shape</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">
                No overdue tasks or missing deadlines were found. Keep task statuses up to date.
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        Score formula: starts at 100, subtracts 12 per overdue task, 4 per task due within 3 days,
        and 2 per missing due date; completion provides a small bonus. This is an indicative
        heuristic, not a prediction.
      </p>
    </section>
  );
}
