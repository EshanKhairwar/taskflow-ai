
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

const priorityLabel: Record<Task["priority"], string> = {
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
};

const priorityStyles: Record<Task["priority"], string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

function getAssignee(task: Task) {
  if (!task.assignee || typeof task.assignee === "string") {
    return null;
  }

  return {
    name: task.assignee.name || task.assignee.email || "Team member",
    email: task.assignee.email || "",
    avatar: task.assignee.avatar || "",
  };
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";
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
        year: "numeric",
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
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 ${
        isMoving
          ? "cursor-wait opacity-50"
          : "cursor-grab active:cursor-grabbing"
      }`}
    >
      {/* Priority and drag indicator */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            priorityStyles[task.priority]
          }`}
        >
          {priorityLabel[task.priority]}
        </span>

        <span
          className="select-none text-lg leading-none text-slate-400"
          aria-hidden="true"
          title="Drag task"
        >
          ⠿
        </span>
      </div>

      {/* Task details */}
      <h3 className="break-words font-semibold text-slate-900 dark:text-slate-100">
        {task.title}
      </h3>

      {task.description && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-400">
          {task.description}
        </p>
      )}

      {/* Due date */}
      {dueDateText && (
        <div className="mt-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
              overdue
                ? "bg-rose-50 font-semibold text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                : "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <span aria-hidden="true">◷</span>
            {dueDateText}
            {overdue && " · Overdue"}
          </span>
        </div>
      )}

      {/* Assignee */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
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
                className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
              >
                {getInitials(assignee.name)}
              </span>
            )}

            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Assigned to
              </p>
              <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                {assignee.name}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-slate-300 dark:border-slate-600">
              <span aria-hidden="true">+</span>
            </span>
            <span>Unassigned</span>
          </div>
        )}

        <span className="shrink-0 text-[10px] text-slate-400">
          {task.status === "done" ? "Completed" : "Task"}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          draggable={false}
          onClick={() => onEdit(task)}
          disabled={isMoving}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Edit
        </button>

        <button
          type="button"
          draggable={false}
          onClick={() => onDelete(task)}
          disabled={isMoving}
          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
        >
          Delete
        </button>
      </div>
    </article>
  );
}
