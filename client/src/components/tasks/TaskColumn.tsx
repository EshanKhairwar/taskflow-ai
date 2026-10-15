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

export default function TaskColumn({ status, title, tasks, onTaskDragStart, onTaskDragEnd, onDropTask, movingTaskIds, onEditTask, onDeleteTask }: TaskColumnProps) {
  const [isOver, setIsOver] = useState(false);
  const sortedTasks = [...tasks].sort((a, b) => a.position - b.position);

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
      className={`flex min-h-[420px] min-w-[260px] flex-1 flex-col rounded-2xl border p-3 transition-colors ${isOver ? "border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/30" : "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50"}`}
      onDragOver={handleDragOver}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOver(false); }}
      onDrop={(event) => handleDrop(event, sortedTasks.length)}
      aria-label={`${title} column`}
    >
      <header className="mb-3 flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${status === "todo" ? "bg-slate-400" : status === "in_progress" ? "bg-blue-500" : status === "in_review" ? "bg-violet-500" : "bg-emerald-500"}`} />
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">{sortedTasks.length}</span>
      </header>
      <div className="flex flex-1 flex-col gap-3">
        {sortedTasks.map((task, index) => (
          <div key={task._id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, index)}>
            <TaskCard task={task} onDragStart={onTaskDragStart} onDragEnd={onTaskDragEnd} isMoving={movingTaskIds.includes(task._id)} onEdit={onEditTask} onDelete={onDeleteTask} />
          </div>
        ))}
        {sortedTasks.length === 0 && <div className="flex min-h-28 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 text-center text-sm text-slate-400 dark:border-slate-700">Drop tasks here</div>}
      </div>
    </section>
  );
}
