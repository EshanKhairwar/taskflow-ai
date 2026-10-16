import { useState, type DragEvent } from "react";
import type { Task, TaskStatus } from "../../types";
import TaskCard from "./TaskCard";

interface TaskColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  onTaskDragStart: (event: DragEvent<HTMLElement>, task: Task) => void;
  onTaskDragEnd: () => void;
  onDropTask: (taskId: string, status: TaskStatus, index: number) => void;
  movingTaskIds: string[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

const statusStyles: Record<
  TaskStatus,
  { dot: string; accent: string; badge: string }
> = {
  todo: {
    dot: "bg-slate-400",
    accent: "border-t-slate-400",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  in_progress: {
    dot: "bg-sky-500",
    accent: "border-t-sky-500",
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
  },
  in_review: {
    dot: "bg-violet-500",
    accent: "border-t-violet-500",
    badge:
      "bg-violet-50 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300",
  },
  done: {
    dot: "bg-emerald-500",
    accent: "border-t-emerald-500",
    badge:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
  },
};

export default function TaskColumn({
  status,
  title,
  tasks,
  onTaskDragStart,
  onTaskDragEnd,
  onDropTask,
  movingTaskIds,
  onEditTask,
  onDeleteTask,
}: TaskColumnProps) {
  const [isOver, setIsOver] = useState(false);
  const sortedTasks = [...tasks].sort((a, b) => a.position - b.position);
  const style = statusStyles[status];

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsOver(true);
  }

  function handleDrop(event: DragEvent<HTMLElement>, index: number) {
    event.preventDefault();
    event.stopPropagation();
    setIsOver(false);
    const taskId = event.dataTransfer.getData("text/taskflow-task-id");
    if (taskId) onDropTask(taskId, status, index);
  }

  return (
    <section
      className={`flex min-h-[460px] min-w-[270px] flex-1 flex-col overflow-hidden rounded-2xl border border-t-[3px] ${style.accent} p-3.5 transition-all duration-200 ${isOver ? "border-indigo-400 bg-indigo-50/80 shadow-lg shadow-indigo-500/10 dark:bg-indigo-950/30" : "border-slate-200/90 bg-slate-100/70 dark:border-slate-800 dark:bg-slate-900/60"}`}
      onDragOver={handleDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setIsOver(false);
      }}
      onDrop={(event) => handleDrop(event, sortedTasks.length)}
      aria-label={`${title} column`}
    >
      <header className="mb-4 flex items-center justify-between gap-3 px-0.5 pt-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white/70 dark:ring-slate-800 ${style.dot}`}
          />
          <h2 className="truncate text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {title}
          </h2>
        </div>
        <span
          className={`inline-flex min-w-7 items-center justify-center rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${style.badge}`}
        >
          {sortedTasks.length}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-3">
        {sortedTasks.map((task, index) => (
          <div
            key={task._id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, index)}
          >
            <TaskCard
              task={task}
              onDragStart={onTaskDragStart}
              onDragEnd={onTaskDragEnd}
              isMoving={movingTaskIds.includes(task._id)}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
            />
          </div>
        ))}
        {sortedTasks.length === 0 && (
          <div
            className={`flex min-h-36 flex-1 flex-col items-center justify-center rounded-xl border border-dashed px-4 text-center transition ${isOver ? "border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/30" : "border-slate-300/80 bg-white/50 dark:border-slate-700 dark:bg-slate-950/30"}`}
          >
            <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg text-slate-400 shadow-sm dark:bg-slate-800">
              ＋
            </span>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              No tasks yet
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Drop a task here to move it
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
