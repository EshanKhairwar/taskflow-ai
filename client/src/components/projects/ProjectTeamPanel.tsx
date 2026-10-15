import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
  type ProjectMember,
} from "../../api/projectMembers.api";

interface ProjectTeamPanelProps {
  projectId: string;
}

export default function ProjectTeamPanel({ projectId }: ProjectTeamPanelProps) {
  console.log("✅ ProjectTeamPanel rendered");
  console.log("🆔 Project ID:", projectId);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

 const refresh = useCallback(async () => {
  console.log("🚀 Fetching project members for:", projectId);

  setLoading(true);
  setError("");

  try {
    const result = await getProjectMembers(projectId);
    console.log("✅ Members API response:", result);

    setMembers(result.members);
    setCanManageMembers(result.canManageMembers);
  } catch (err) {
    console.error("❌ Members API error:", err);
    setError(
      err instanceof Error ? err.message : "Could not load project members."
    );
  } finally {
    setLoading(false);
  }
}, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setSubmitting(true);
    try {
      const result = await addProjectMember(projectId, normalizedEmail);
      setMembers((current) =>
        [...current, result.member].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setEmail("");
      setNotice(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add member.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(member: ProjectMember) {
    if (member.isOwner) return;
    if (
      !window.confirm(
        `Remove ${member.name} from this project? Their task assignments in this project will also be cleared.`,
      )
    )
      return;
    setError("");
    setNotice("");
    setRemovingId(member.id);
    try {
      await removeProjectMember(projectId, member.id);
      setMembers((current) => current.filter((item) => item.id !== member.id));
      setNotice(`${member.name} was removed from the project.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove member.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Project team
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add registered users by email and manage project access.
          </p>
        </div>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          {members.length} {members.length === 1 ? "member" : "members"}
        </span>
      </div>

      {canManageMembers && (
        <form
          onSubmit={handleAdd}
          className="mt-5 flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Registered user's email"
            aria-label="Member email"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {submitting ? "Adding…" : "Add member"}
          </button>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading team…</p>
      ) : error && members.length === 0 ? null : members.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          No team members found.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-3">
              {member.avatar ? (
                <img
                  src={member.avatar}
                  alt=""
                  className="size-10 rounded-full object-cover"
                />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  {member.name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() ?? "")
                    .join("")}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {member.name}
                  {member.isOwner ? " · Owner" : ""}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {member.email}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {member.role}
              </span>
              {canManageMembers && !member.isOwner && (
                <button
                  type="button"
                  onClick={() => void handleRemove(member)}
                  disabled={removingId === member.id}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/40"
                >
                  {removingId === member.id ? "Removing…" : "Remove"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!canManageMembers && !loading && (
        <p className="mt-3 text-xs text-slate-500">
          Only project admins can add or remove members.
        </p>
      )}
    </section>
  );
}
