import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
  type ProjectMember,
} from "../../api/projectMembers.api";
import { useProjectSocket } from "../../hooks/useProjectSocket";

interface ProjectTeamPanelProps {
  projectId: string;
}

export default function ProjectTeamPanel({ projectId }: ProjectTeamPanelProps) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { status: socketStatus, onlineUserIds } = useProjectSocket(projectId);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getProjectMembers(projectId);
      setMembers(result.members);
      setCanManageMembers(result.canManageMembers);
    } catch (err) {
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

  const connected = socketStatus === "connected";
  const onlineCount = members.filter((member) => onlineUserIds.includes(member.id)).length;

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
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className={`inline-block size-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-400"}`} />
            <span className="text-slate-500 dark:text-slate-400">
              {connected ? `${onlineCount} of ${members.length} members online` : "Presence reconnecting…"}
            </span>
          </div>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
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
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
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
          {members.map((member) => {
            const isOnline = onlineUserIds.includes(member.id);
            return (
              <li key={member.id} className="flex items-center gap-3 py-3">
                <div className="relative shrink-0">
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt=""
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid size-10 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {member.name
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase() ?? "")
                        .join("")}
                    </span>
                  )}
                  <span
                    title={isOnline ? "Online in this project" : "Offline"}
                    className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white dark:border-slate-900 ${isOnline ? "bg-emerald-500" : "bg-slate-400"}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {member.name}
                    {member.isOwner ? " · Owner" : ""}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {member.email}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {member.assignedTaskCount ?? 0} {(member.assignedTaskCount ?? 0) === 1 ? "task" : "tasks"} assigned
                    <span className={isOnline ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}>
                      {" · "}{isOnline ? "Online" : "Offline"}
                    </span>
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
            );
          })}
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
