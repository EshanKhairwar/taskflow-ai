import { useMemo, useState } from "react";
import { CalendarClock, AlertTriangle, Users, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { Task } from "../../types";

type Props = { tasks: Task[] };

function dayDiff(date: string): number {
  const due = new Date(date);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

export default function SmartSchedulePanel({ tasks }: Props) {
  const [expanded, setExpanded] = useState(true);
  const recommendations = useMemo(() => {
    const active = tasks.filter((task) => task.status !== "done");
    const overdue = active.filter((task) => task.dueDate && dayDiff(task.dueDate) < 0);
    const dueSoon = active.filter((task) => task.dueDate && dayDiff(task.dueDate) >= 0 && dayDiff(task.dueDate) <= 3);
    const highPriority = active.filter((task) => task.priority === "high");
    const noDueDate = active.filter((task) => !task.dueDate);
    const assignedCounts = new Map<string, { name: string; count: number }>();
    for (const task of active) {
      if (!task.assignee) continue;
      const id = typeof task.assignee === "string" ? task.assignee : task.assignee._id ?? task.assignee.id ?? "";
      const name = typeof task.assignee === "string" ? "Assigned teammate" : task.assignee.name ?? task.assignee.email ?? "Assigned teammate";
      const current = assignedCounts.get(id) ?? { name, count: 0 };
      current.count += 1;
      assignedCounts.set(id, current);
    }
    const busiest = [...assignedCounts.values()].sort((a, b) => b.count - a.count)[0];
    return { active: active.length, overdue, dueSoon, highPriority, noDueDate, busiest };
  }, [tasks]);

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm dark:border-blue-900/70 dark:bg-slate-900/70">
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 bg-gradient-to-r from-blue-50 to-sky-50 px-5 py-4 text-left dark:from-blue-950/40 dark:to-sky-950/30">
        <span className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white"><Sparkles size={20}/></span>
          <span><span className="block font-bold text-slate-900 dark:text-white">Smart Schedule</span><span className="block text-xs text-slate-600 dark:text-slate-400">Deadline risk and workload recommendations</span></span>
        </span>
        <span className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-300">{expanded ? "Hide insights" : "Show insights"} {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</span>
      </button>
      {expanded && <div className="p-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Open tasks" value={recommendations.active} icon={<CalendarClock size={17}/>} />
          <Metric label="Overdue" value={recommendations.overdue.length} warning={recommendations.overdue.length > 0} icon={<AlertTriangle size={17}/>} />
          <Metric label="Due in 3 days" value={recommendations.dueSoon.length} warning={recommendations.dueSoon.length > 0} icon={<CalendarClock size={17}/>} />
          <Metric label="High priority open" value={recommendations.highPriority.length} warning={recommendations.highPriority.length > 0} icon={<Sparkles size={17}/>} />
        </div>
        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Recommended next actions</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          {recommendations.overdue.length > 0 && <Recommendation title="Review overdue tasks" body={`${recommendations.overdue.length} open task(s) are past their due date. Reassign, update the deadline, or reduce scope.`} tone="danger" />}
          {recommendations.dueSoon.length > 0 && <Recommendation title="Protect near-term deadlines" body={`${recommendations.dueSoon.length} task(s) are due within three days. Confirm owners and unblock dependencies.`} tone="warning" />}
          {recommendations.noDueDate.length > 0 && <Recommendation title="Add missing due dates" body={`${recommendations.noDueDate.length} open task(s) have no due date. Add realistic deadlines to make planning clearer.`} tone="neutral" />}
          {recommendations.busiest && recommendations.busiest.count >= 4 && <Recommendation title="Check workload balance" body={`${recommendations.busiest.name} has ${recommendations.busiest.count} open tasks assigned. Review capacity before assigning more work.`} tone="warning" />}
          {!recommendations.overdue.length && !recommendations.dueSoon.length && !recommendations.noDueDate.length && !(recommendations.busiest && recommendations.busiest.count >= 4) && <Recommendation title="Schedule looks healthy" body="No immediate deadline risks were detected from the current task data. Keep priorities and due dates up to date." tone="success" />}
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Recommendations are rule-based and use tasks currently loaded for this project. They do not change tasks automatically.</p>
      </div>}
    </section>
  );
}

function Metric({ label, value, icon, warning = false }: { label: string; value: number; icon: React.ReactNode; warning?: boolean }) {
  return <div className={`rounded-xl border p-3 ${warning ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50"}`}>
    <div className={`mb-2 flex items-center gap-2 ${warning ? "text-amber-700 dark:text-amber-300" : "text-blue-600 dark:text-blue-300"}`}>{icon}<span className="text-xs font-medium">{label}</span></div>
    <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{value}</div>
  </div>;
}

function Recommendation({ title, body, tone }: { title: string; body: string; tone: "danger" | "warning" | "neutral" | "success" }) {
  const toneClass = {
    danger: "border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20",
    warning: "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20",
    neutral: "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40",
    success: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20",
  }[tone];
  return <div className={`rounded-xl border p-3 ${toneClass}`}><div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Users size={15}/>{title}</div><p className="text-sm leading-5 text-slate-600 dark:text-slate-300">{body}</p></div>;
}
