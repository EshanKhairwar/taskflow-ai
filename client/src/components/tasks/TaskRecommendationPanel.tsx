import { useMemo, useState } from "react";
import { CalendarClock, UserRoundCheck, Check, Sparkles } from "lucide-react";
import type { Task, TaskPriority } from "../../types";
import type { ProjectMember } from "../../api/projectMembers.api";

type Props = {
  tasks: Task[];
  members: ProjectMember[];
  onApplyDueDate: (taskId: string, dueDate: string) => Promise<void>;
  onApplyAssignee: (taskId: string, assigneeId: string) => Promise<void>;
};

function dateAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function recommendedDays(priority: TaskPriority): number {
  if (priority === "high") return 2;
  if (priority === "medium") return 5;
  return 8;
}

export default function TaskRecommendationPanel({ tasks, members, onApplyDueDate, onApplyAssignee }: Props) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(true);
  const openTasks = tasks.filter(t => t.status !== "done");
  const suggestions = useMemo(() => openTasks.map(task => {
    const existingDue = task.dueDate ? new Date(task.dueDate) : null;
    const proposed = existingDue && existingDue.getTime() > Date.now()
      ? task.dueDate!.slice(0, 10)
      : dateAfter(recommendedDays(task.priority));
    const ranked = [...members].sort((a,b) => (a.assignedTaskCount ?? openTasks.filter(t => typeof t.assignee === "object" && t.assignee && (t.assignee._id === a.id || t.assignee.id === a.id)).length) - (b.assignedTaskCount ?? openTasks.filter(t => typeof t.assignee === "object" && t.assignee && (t.assignee._id === b.id || t.assignee.id === b.id)).length));
    const currentAssignee = typeof task.assignee === "string" ? task.assignee : task.assignee?._id ?? task.assignee?.id;
    const best = ranked.find(m => m.id !== currentAssignee);
    return { task, proposed, best };
  }), [openTasks, members]);

  async function apply(key: string, action: () => Promise<void>) {
    setBusy(key); setMessage("");
    try { await action(); setMessage("Recommendation applied."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not apply recommendation."); }
    finally { setBusy(""); }
  }

  return <section className="mb-6 overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm dark:border-sky-900/70 dark:bg-slate-900/70">
    <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded} className="flex w-full items-center justify-between bg-gradient-to-r from-sky-50 to-blue-50 px-5 py-4 text-left dark:from-sky-950/40 dark:to-blue-950/30">
      <span className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-sky-600 text-white"><Sparkles size={20}/></span><span><span className="block font-bold text-slate-900 dark:text-white">Task Recommendations</span><span className="block text-xs text-slate-600 dark:text-slate-400">Suggested deadlines and workload-aware teammates</span></span></span>
      <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">{expanded ? "Hide" : "Show"}</span>
    </button>
    {expanded && <div className="p-5">
      {message && <p role="status" className="mb-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">{message}</p>}
      {suggestions.length === 0 ? <p className="text-sm text-slate-500">No open tasks to recommend for yet.</p> : <div className="grid gap-3 lg:grid-cols-2">
        {suggestions.slice(0, 8).map(({task, proposed, best}) => <article key={task._id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="font-semibold text-slate-900 dark:text-white">{task.title}</p>
          <p className="mt-1 text-xs text-slate-500">Priority: {task.priority} · Status: {task.status.replace("_", " ")}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><CalendarClock size={16}/> Suggested date: {proposed}</span>
            <button disabled={!!busy} onClick={() => void apply(`${task._id}-date`, () => onApplyDueDate(task._id, new Date(`${proposed}T12:00:00`).toISOString()))} className="rounded-lg border border-sky-200 px-3 py-2 text-xs font-semibold text-sky-700 disabled:opacity-50 dark:border-sky-800 dark:text-sky-300"><Check size={13} className="mr-1 inline"/>Apply date</button>
          </div>
          {best && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><UserRoundCheck size={16}/> Suggest: {best.name}</span>
            <button disabled={!!busy} onClick={() => void apply(`${task._id}-member`, () => onApplyAssignee(task._id, best.id))} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Assign teammate</button>
          </div>}
        </article>)}</div>}
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Rule-based suggestions only. Dates are estimates; teammate ranking uses available assigned-task counts when supplied. Review before applying.</p>
    </div>}
  </section>;
}
