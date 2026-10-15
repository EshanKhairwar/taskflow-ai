import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Plus,
} from "lucide-react";

export interface ProjectTabItem {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ProjectsTabProps {
  projects: ProjectTabItem[];
  filteredProjects: ProjectTabItem[];
  loading: boolean;
  loadError: string;
  search: string;
  onCreateProject: () => void;
  onOpenProject: (project: ProjectTabItem) => void;
  onRefreshProjects: () => void;
}

const projectColors = [
  "bg-violet-100 text-violet-600",
  "bg-sky-100 text-sky-600",
  "bg-orange-100 text-orange-600",
  "bg-emerald-100 text-emerald-600",
];

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(date?: string) {
  if (!date) return "Recently created";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Recently created";
  return `Updated ${parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export default function ProjectsTab({
  projects,
  filteredProjects,
  loading,
  loadError,
  search,
  onCreateProject,
  onOpenProject,
  onRefreshProjects,
}: ProjectsTabProps) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <section className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-500">
            Workspace / Projects
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Projects
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            All your projects in one place. Open a project to manage its tasks
            on the Kanban board.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateProject}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-700"
        >
          <Plus size={18} /> New project
        </button>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Total projects
            </span>
            <span className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-600">
              <FolderKanban size={19} />
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">
            {loading ? "—" : projects.length}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Recently updated
            </span>
            <span className="grid size-10 place-items-center rounded-xl bg-sky-100 text-sky-600">
              <Clock3 size={19} />
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">
            {loading
              ? "—"
              : projects.filter(
                  (project) => project.updatedAt || project.createdAt,
                ).length}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Matching results
            </span>
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={19} />
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">
            {loading ? "—" : filteredProjects.length}
          </p>
        </article>
      </section>

      {loadError && (
        <div className="mb-5 flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-rose-800">
              Couldn’t load projects
            </p>
            <p className="mt-1 break-words text-xs text-rose-700">
              {loadError}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshProjects}
            className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700"
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="mb-5 size-11 rounded-xl bg-slate-100" />
              <div className="mb-3 h-4 w-2/3 rounded bg-slate-100" />
              <div className="mb-8 h-3 w-full rounded bg-slate-100" />
              <div className="h-9 rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project, index) => (
            <article
              key={project._id ?? project.id ?? project.name}
              className="group flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100/50"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <span
                  className={`grid size-11 place-items-center rounded-xl ${projectColors[index % projectColors.length]}`}
                >
                  <FolderKanban size={21} />
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                  {project.status ?? "Active project"}
                </span>
              </div>
              <h2 className="break-words text-lg font-bold text-slate-900">
                {project.name}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">
                {project.description?.trim() ||
                  "Plan work, organize tasks, and track your team’s progress in one place."}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="grid size-7 place-items-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                    {getInitials(project.name) || "P"}
                  </span>
                  {formatDate(project.updatedAt ?? project.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenProject(project)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
                >
                  Open board <ArrowUpRight size={14} />
                </button>
              </div>
            </article>
          ))}
          <button
            type="button"
            onClick={onCreateProject}
            className="flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-6 text-center transition hover:border-violet-400 hover:bg-violet-50"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-600">
              <Plus size={23} />
            </span>
            <span className="mt-4 text-sm font-bold text-slate-800">
              Create another project
            </span>
            <span className="mt-2 text-xs text-slate-500">
              Start organizing a new goal
            </span>
          </button>
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-violet-100 text-violet-600">
            <FolderKanban size={29} />
          </span>
          <h2 className="mt-5 text-lg font-bold text-slate-900">
            {search.trim()
              ? "No projects match your search"
              : "Your workspace is ready for a project"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            {search.trim()
              ? "Try another project name or clear the search field."
              : "Create your first project to start planning tasks and tracking progress."}
          </p>
          {!search.trim() && (
            <button
              type="button"
              onClick={onCreateProject}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Plus size={16} /> Create project
            </button>
          )}
        </section>
      )}
    </div>
  );
}
