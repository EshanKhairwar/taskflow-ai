import { useEffect, useMemo, useState } from "react";
import { Users, UserPlus, FolderKanban, ShieldCheck } from "lucide-react";
import ProjectTeamPanel from "../components/projects/ProjectTeamPanel";

interface TeamProject {
  _id?: string;
  id?: string;
  name: string;
}

interface TeamTabProps {
  projects: TeamProject[];
  loading?: boolean;
  onOpenProjects?: () => void;
}

function getProjectId(project: TeamProject) {
  return project._id ?? project.id ?? "";
}

export default function TeamTab({ projects, loading = false, onOpenProjects }: TeamTabProps) {
  const validProjects = useMemo(() => projects.filter((project) => getProjectId(project)), [projects]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  useEffect(() => {
    if (!validProjects.length) {
      setSelectedProjectId("");
      return;
    }
    if (!validProjects.some((project) => getProjectId(project) === selectedProjectId)) {
      setSelectedProjectId(getProjectId(validProjects[0]));
    }
  }, [validProjects, selectedProjectId]);

  const selectedProject = validProjects.find((project) => getProjectId(project) === selectedProjectId);

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-500">Collaboration / Workspace</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Team</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage project collaborators, invite registered users by email, and control project access.</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 sm:self-auto">
          <Users size={18} /> Team management
        </div>
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">Your projects</span><span className="grid size-10 place-items-center rounded-xl bg-blue-100 text-blue-600"><FolderKanban size={19} /></span></div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">{loading ? "—" : validProjects.length}</p>
          <p className="mt-1 text-xs text-slate-400">Projects available to manage</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">Member access</span><span className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-600"><ShieldCheck size={19} /></span></div>
          <p className="mt-3 text-lg font-bold text-slate-900">Role-based</p>
          <p className="mt-1 text-xs text-slate-400">Project admins can manage membership</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">Add collaborators</span><span className="grid size-10 place-items-center rounded-xl bg-sky-100 text-sky-600"><UserPlus size={19} /></span></div>
          <p className="mt-3 text-lg font-bold text-slate-900">By email</p>
          <p className="mt-1 text-xs text-slate-400">The person must already have an account</p>
        </article>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading your projects…</div>
      ) : validProjects.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Users size={26} /></span>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Create a project first</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Team members are managed per project. Create a project, then add collaborators from this page.</p>
          {onOpenProjects && <button type="button" onClick={onOpenProjects} className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Go to Projects</button>}
        </section>
      ) : (
        <>
          <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5">
            <div className="mb-3 sm:mb-0"><h2 className="font-bold text-slate-900">Choose a project</h2><p className="mt-1 text-sm text-slate-500">Members and access settings are shown for the selected project.</p></div>
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:max-w-sm" aria-label="Select project">
              {validProjects.map((project) => <option key={getProjectId(project)} value={getProjectId(project)}>{project.name}</option>)}
            </select>
          </section>
          {selectedProject && <ProjectTeamPanel key={selectedProjectId} projectId={selectedProjectId} />}
        </>
      )}
    </main>
  );
}
