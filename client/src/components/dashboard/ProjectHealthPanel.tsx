import type { Task } from "../../types";
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, ShieldCheck } from "lucide-react";

export default function ProjectHealthPanel({ tasks, projectName }: { tasks: Task[]; projectName: string }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const done = tasks.filter(t => t.status === "done").length;
  const open = tasks.filter(t => t.status !== "done");
  const overdue = open.filter(t => t.dueDate && new Date(t.dueDate) < today).length;
  const dueSoon = open.filter(t => t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) <= new Date(today.getTime() + 3 * 86400000)).length;
  const missingDates = open.filter(t => !t.dueDate).length;
  const completion = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const score = Math.max(0, Math.min(100, Math.round(100 - (overdue * 12) - (dueSoon * 4) - (missingDates * 2) + (completion * 0.15))));
  const tone = score >= 80 ? "text-emerald-600 dark:text-emerald-400" : score >= 55 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  const health = score >= 80 ? "Healthy" : score >= 55 ? "Needs attention" : "At risk";
  const metrics = [
    { label: "Completed", value: `${done}/${tasks.length}`, icon: CheckCircle2 },
    { label: "Overdue", value: overdue, icon: AlertTriangle },
    { label: "Due in 3 days", value: dueSoon, icon: CalendarClock },
    { label: "No due date", value: missingDates, icon: Activity },
  ];
  return <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">Project health</p><h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{projectName}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A transparent estimate based on task progress and deadlines.</p></div><div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800"><ShieldCheck className={tone} size={24}/><div><div className={`text-2xl font-extrabold ${tone}`}>{score}<span className="text-xs font-semibold">/100</span></div><div className={`text-xs font-semibold ${tone}`}>{health}</div></div></div></div>
    <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full transition-all ${score >= 80 ? "bg-emerald-500" : score >= 55 ? "bg-amber-500" : "bg-rose-500"}`} style={{width:`${score}%`}}/></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(({label,value,icon:Icon})=><div key={label} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"><div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><Icon size={15}/>{label}</div><div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{value}</div></div>)}</div>
    <p className="mt-3 text-[11px] text-slate-400">Score formula: starts at 100, subtracts 12 per overdue task, 4 per task due within 3 days, and 2 per missing due date; completion provides a small bonus. This is an indicative heuristic, not a prediction.</p>
  </section>;
}
