import type { DragEvent } from "react";
import type { Task } from "../../types";

interface TaskCardProps {
  task: Task;
  onDragStart: (event: DragEvent<HTMLElement>, task: Task) => void;
  onDragEnd: () => void;
  isMoving?: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

const priorityStyles: Record<Task["priority"], string> = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20",
  medium:
    "bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/20",
  high: "bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-400/20",
};

const priorityLabel: Record<Task["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function getAssignee(task: Task) {
  if (!task.assignee || typeof task.assignee === "string") return null;
  return {
    name: task.assignee.name || task.assignee.email || "Team member",
    email: task.assignee.email || "",
    avatar: task.assignee.avatar || "",
  };
}

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U"
  );
}

export default function TaskCard({
  task,
  onDragStart,
  onDragEnd,
  isMoving = false,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const assignee = getAssignee(task);
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const validDueDate =
    dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null;
  const dueDateText = validDueDate
    ? validDueDate.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue =
    validDueDate !== null &&
    validDueDate.getTime() < today.getTime() &&
    task.status !== "done";

  return (
    <article
      draggable={!isMoving}
      onDragStart={(event) => onDragStart(event, task)}
      onDragEnd={onDragEnd}
      aria-label={`Task: ${task.title}`}
      className={`group relative rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-900/[0.025] transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-900/[0.06] dark:border-slate-700/80 dark:bg-slate-900 dark:hover:border-indigo-700 ${isMoving ? "cursor-wait opacity-50" : "cursor-grab active:cursor-grabbing"}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${priorityStyles[task.priority]}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${task.priority === "high" ? "bg-rose-500" : task.priority === "medium" ? "bg-amber-500" : "bg-emerald-500"}`}
          />
          {priorityLabel[task.priority]} priority
        </span>
        <span
          className="select-none rounded-md px-1.5 py-1 text-sm leading-none text-slate-300 transition group-hover:text-slate-500 dark:text-slate-600"
          aria-hidden="true"
          title="Drag task"
        >
          ⠿
        </span>
      </div>

      <h3 className="break-words text-sm font-bold leading-5 text-slate-900 dark:text-slate-100">
        {task.title}
      </h3>
      {task.description && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500 dark:text-slate-400">
          {task.description}
        </p>
      )}

      {(dueDateText || overdue) && (
        <div className="mt-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium ${overdue ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" : "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            <span aria-hidden="true">◷</span>
            {dueDateText}
            {overdue && <span className="font-bold">· Overdue</span>}
          </span>
        </div>
      )}

      <div className="mt-4 flex min-w-0 items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        {assignee ? (
          <div
            className="flex min-w-0 items-center gap-2"
            title={assignee.email || assignee.name}
          >
            {assignee.avatar ? (
              <img
                src={assignee.avatar}
                alt=""
                loading="lazy"
                className="h-7 w-7 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300"
              >
                {getInitials(assignee.name)}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                Assigned to
              </p>
              <p className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                {assignee.name}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-slate-300 dark:border-slate-600">
              ＋
            </span>
            <span>Unassigned</span>
          </div>
        )}
        <span className="shrink-0 text-[10px] font-medium text-slate-400">
          {task.status === "done" ? "✓ Done" : "Task"}
        </span>
      </div>

      <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          draggable={false}
          onClick={() => onEdit(task)}
          disabled={isMoving}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-800 dark:hover:bg-violet-950/50"
        >
          Edit task
        </button>
        <button
          type="button"
          draggable={false}
          onClick={() => onDelete(task)}
          disabled={isMoving}
          className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-rose-950/50"
        >
          Delete
        </button>
      </div>
    </article>
  );
}
