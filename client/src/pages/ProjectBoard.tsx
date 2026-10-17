import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";

import TaskColumn from "../components/tasks/TaskColumn";

import ProjectTeamPanel from "../components/projects/ProjectTeamPanel";

import AiTaskAssistant from "../components/tasks/AiTaskAssistant";
import AiProjectCopilot from "../components/tasks/AiProjectCopilot";
import TaskComments from "../components/tasks/TaskComments";
import SmartSchedulePanel from "../components/tasks/SmartSchedulePanel";
import TaskRecommendationPanel from "../components/tasks/TaskRecommendationPanel";
import ProjectHealthPanel from "../components/dashboard/ProjectHealthPanel";

import {
  getProjectMembers,
  type ProjectMember,
} from "../api/projectMembers.api";

import { useTasks } from "../hooks/useTasks";
import { useProjectSocket } from "../hooks/useProjectSocket";

import type { CreateTaskInput, Task, TaskPriority, TaskStatus } from "../types";

// The update API accepts null to explicitly remove an assignee.

type TaskSubmissionInput = Omit<CreateTaskInput, "assignee"> & {
  assignee?: string | null;
};

export interface ProjectBoardProps {
  projectId: string;

  projectName?: string;
}

const columns: Array<{ status: TaskStatus; title: string }> = [
  { status: "todo", title: "Todo" },

  { status: "in_progress", title: "In Progress" },

  { status: "in_review", title: "In Review" },

  { status: "done", title: "Done" },
];

type TaskFormState = {
  title: string;

  description: string;

  priority: TaskPriority;

  status: TaskStatus;

  dueDate: string;

  assignee: string;
};

const emptyForm: TaskFormState = {
  title: "",

  description: "",

  priority: "medium",

  status: "todo",

  dueDate: "",

  assignee: "",
};

function formFromTask(task: Task): TaskFormState {
  return {
    title: task.title,

    description: task.description ?? "",

    priority: task.priority ?? "medium",

    status: task.status,

    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",

    assignee:
      typeof task.assignee === "string"
        ? task.assignee
        : (task.assignee?._id ?? task.assignee?.id ?? ""),
  };
}

export default function ProjectBoard({
  projectId,

  projectName = "Project board",
}: ProjectBoardProps) {
  const {
    tasks,

    loading,

    error,

    refresh,

    create,

    update,

    remove,

    moveTask,

    movingTaskIds,

    saving,
  } = useTasks(projectId);

  const { status: socketStatus } = useProjectSocket(projectId, refresh);

  const [search, setSearch] = useState("");

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);

  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [form, setForm] = useState<TaskFormState>(emptyForm);

  const [formError, setFormError] = useState("");

  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  const [membersLoading, setMembersLoading] = useState(false);

  const [membersError, setMembersError] = useState("");

  async function refreshProjectMembers() {
    setMembersLoading(true);

    setMembersError("");

    try {
      const response = await getProjectMembers(projectId);

      setProjectMembers(response.members);
    } catch (err) {
      setMembersError(
        err instanceof Error ? err.message : "Could not load project members.",
      );
    } finally {
      setMembersLoading(false);
    }
  }

  useEffect(() => {
    void refreshProjectMembers();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return tasks;

    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(term) ||
        (task.description ?? "").toLowerCase().includes(term),
    );
  }, [tasks, search]);

  function handleDragStart(event: DragEvent<HTMLElement>, task: Task) {
    setDraggedTaskId(task._id);

    event.dataTransfer.effectAllowed = "move";

    event.dataTransfer.setData("text/taskflow-task-id", task._id);
  }

  function handleDropTask(taskId: string, status: TaskStatus, index: number) {
    setDraggedTaskId(null);

    const task = tasks.find((item) => item._id === taskId);

    if (!task || movingTaskIds.includes(taskId)) return;

    const currentColumn = tasks

      .filter((item) => item.status === task.status)

      .sort((a, b) => a.position - b.position);

    const currentIndex = currentColumn.findIndex((item) => item._id === taskId);

    if (
      task.status === status &&
      (currentIndex === index || currentIndex + 1 === index)
    )
      return;

    void moveTask(taskId, status, index);
  }

  function openCreateModal() {
    void refreshProjectMembers();

    setEditingTask(null);

    setForm(emptyForm);

    setFormError("");

    setModalOpen(true);
  }

  function openEditModal(task: Task) {
    void refreshProjectMembers();

    setEditingTask(task);

    setForm(formFromTask(task));

    setFormError("");

    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError("");

    const title = form.title.trim();

    if (title.length < 2) {
      setFormError("Task title must contain at least 2 characters.");

      return;
    }

    const input: TaskSubmissionInput = {
      title,

      description: form.description.trim() || undefined,

      priority: form.priority,

      status: form.status,

      ...(form.dueDate
        ? { dueDate: new Date(`${form.dueDate}T12:00:00`).toISOString() }
        : editingTask
          ? { dueDate: null }
          : {}),
    };

    // Updates must send null to explicitly clear an existing assignee.

    // Creates should omit the field when no assignee is selected.

    if (editingTask) {
      input.assignee = form.assignee.trim() || null;
    } else if (form.assignee.trim()) {
      input.assignee = form.assignee.trim();
    }

    try {
      if (editingTask) {
        // The API client currently types its payload as CreateTaskInput;

        // this cast preserves the runtime null needed to clear an assignment.

        await update(editingTask._id, input as CreateTaskInput);
      } else {
        // On create, the empty assignee is omitted, so this payload is valid.

        await create(input as CreateTaskInput);
      }

      setModalOpen(false);

      setEditingTask(null);

      setForm(emptyForm);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not save this task.",
      );
    }
  }

  async function applyRecommendedDueDate(taskId: string, dueDate: string) {
    await update(taskId, { dueDate } as CreateTaskInput);
  }

  async function applyRecommendedAssignee(taskId: string, assigneeId: string) {
    await update(taskId, { assignee: assigneeId } as CreateTaskInput);
    await refreshProjectMembers();
  }

  async function handleDelete(task: Task) {
    const confirmed = window.confirm(
      `Delete “${task.title}”? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingTaskId(task._id);

    try {
      await remove(task._id);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Could not delete task.",
      );
    } finally {
      setDeletingTaskId(null);
    }
  }

  const totalDone = tasks.filter((task) => task.status === "done").length;

  const completion = tasks.length
    ? Math.round((totalDone / tasks.length) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-[#080b18] dark:text-slate-100 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-[1760px]">
        <div className="mb-6 flex flex-col gap-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.025] dark:border-slate-800 dark:bg-slate-900/70 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
              <span className="inline-block h-2 w-2 rounded-full bg-violet-500" /> TASKFLOW AI <span className="text-slate-300 dark:text-slate-700">/</span> WORKSPACE
            </p>

            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {projectName}
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Create tasks, manage priorities, and drag tasks between columns.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                socketStatus === "connected"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : socketStatus === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              }`}
              title="Real-time task updates"
            >
              <span className={`h-2 w-2 rounded-full ${socketStatus === "connected" ? "bg-emerald-500" : socketStatus === "error" ? "bg-rose-500" : "bg-amber-500"}`} />
              {socketStatus === "connected" ? "Live connected" : socketStatus === "error" ? "Live connection error" : socketStatus === "connecting" ? "Connecting live…" : "Live disconnected"}
            </span>
            <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 transition focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950">
              <span className="text-slate-400" aria-hidden="true">
                ⌕
              </span>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks..."
                className="w-40 bg-transparent text-sm outline-none placeholder:text-slate-400 sm:w-56"
                aria-label="Search tasks"
              />
            </label>

            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition hover:-translate-y-0.5 hover:from-violet-700 hover:to-indigo-700"
            >
              + Create task
            </button>
          </div>
        </div>

        <ProjectHealthPanel tasks={tasks} projectName={projectName} />

        <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.02] dark:border-slate-800 dark:bg-slate-900/70 sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600 dark:text-slate-300">
              Project progress
            </span>

            <span className="font-semibold">
              {totalDone} of {tasks.length} completed · {completion}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-500 transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        {/* Project team members */}

        <div className="mb-5">
          <ProjectTeamPanel projectId={projectId} />
        </div>

        <AiProjectCopilot
          projectId={projectId}
          onCreateTasks={async (draftTasks) => {
            const createdTitles: string[] = [];
            for (const draft of draftTasks) {
              const created = await create({
                title: draft.title,
                description: draft.description || undefined,
                priority: draft.priority,
                status: "todo",
              });
              createdTitles.push(created.title);
            }
            await refresh();
          }}
        />

        {error && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <span>{error}</span>

            <button
              type="button"
              onClick={() => void refresh()}
              className="font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        <SmartSchedulePanel tasks={tasks} />\n\n        <TaskRecommendationPanel tasks={tasks} members={projectMembers} onApplyDueDate={applyRecommendedDueDate} onApplyAssignee={applyRecommendedAssignee} />

        {loading && tasks.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {columns.map((column) => (
              <div
                key={column.status}
                className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {columns.map((column) => (
              <TaskColumn
                key={column.status}
                status={column.status}
                title={column.title}
                tasks={filteredTasks.filter(
                  (task) => task.status === column.status,
                )}
                onTaskDragStart={handleDragStart}
                onTaskDragEnd={() => setDraggedTaskId(null)}
                onDropTask={handleDropTask}
                movingTaskIds={movingTaskIds}
                onEditTask={openEditModal}
                onDeleteTask={(task) => void handleDelete(task)}
              />
            ))}
          </div>
        )}

        {draggedTaskId && (
          <p className="mt-4 text-center text-xs text-slate-400">
            Moving task…
          </p>
        )}

        {deletingTaskId && (
          <p className="mt-3 text-right text-xs text-slate-400">
            Deleting task…
          </p>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving)
              setModalOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
            className="my-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="task-modal-title" className="text-lg font-bold">
                  {editingTask ? "Edit task" : "Create a task"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Add the details to keep work moving.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                aria-label="Close task form"
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingTask && (
                <AiTaskAssistant
                  projectId={projectId}
                  onUseSuggestion={(suggestion) => {
                    setForm((previous) => ({
                      ...previous,
                      title: suggestion.title,
                      description: suggestion.description,
                      priority: suggestion.priority,
                    }));
                    setFormError("");
                  }}
                />
              )}

              <div>
                <label
                  htmlFor="task-title"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Task title *
                </label>

                <input
                  id="task-title"
                  required
                  minLength={2}
                  maxLength={200}
                  autoFocus
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,

                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Build login page"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-indigo-950"
                />
              </div>

              <div>
                <label
                  htmlFor="task-description"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Description
                </label>

                <textarea
                  id="task-description"
                  rows={3}
                  maxLength={5000}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,

                      description: event.target.value,
                    }))
                  }
                  placeholder="What needs to be done?"
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-indigo-950"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="task-status"
                    className="mb-1.5 block text-sm font-semibold"
                  >
                    Status
                  </label>

                  <select
                    id="task-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,

                        status: event.target.value as TaskStatus,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    {columns.map((column) => (
                      <option key={column.status} value={column.status}>
                        {column.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="task-priority"
                    className="mb-1.5 block text-sm font-semibold"
                  >
                    Priority
                  </label>

                  <select
                    id="task-priority"
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,

                        priority: event.target.value as TaskPriority,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="low">Low</option>

                    <option value="medium">Medium</option>

                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="task-due-date"
                    className="mb-1.5 block text-sm font-semibold"
                  >
                    Due date
                  </label>

                  <input
                    id="task-due-date"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,

                        dueDate: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label
                    htmlFor="task-assignee"
                    className="mb-1.5 block text-sm font-semibold"
                  >
                    Assign to{" "}
                    <span className="font-normal text-slate-400">
                      (optional)
                    </span>
                  </label>

                  <select
                    id="task-assignee"
                    value={form.assignee}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,

                        assignee: event.target.value,
                      }))
                    }
                    disabled={membersLoading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="">Unassigned</option>

                    {projectMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.email})
                        {member.isOwner
                          ? " · Owner"
                          : member.role === "admin"
                            ? " · Admin"
                            : ""}
                      </option>
                    ))}
                  </select>

                  {membersLoading ? (
                    <p className="mt-1 text-xs text-slate-400">
                      Loading project members…
                    </p>
                  ) : membersError ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-rose-500">
                      <span>{membersError}</span>

                      <button
                        type="button"
                        onClick={() => void refreshProjectMembers()}
                        className="font-semibold underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : projectMembers.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-400">
                      No project members were found. Add members in the Team
                      panel first.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">
                      Choose a project member to assign this task.
                    </p>
                  )}
                </div>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {saving
                    ? "Saving…"
                    : editingTask
                      ? "Save changes"
                      : "Create task"}
                </button>
              </div>
            </form>

            {editingTask && <TaskComments taskId={editingTask._id} />}
          </section>
        </div>
      )}
    </main>
  );
}
