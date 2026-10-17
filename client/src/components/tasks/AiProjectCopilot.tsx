import { useState } from "react";
import { generateProjectPlan, type GeneratedProjectPlan } from "../../api/ai.api";
import type { TaskPriority } from "../../types";

type DraftTask = GeneratedProjectPlan["tasks"][number] & { selected: boolean };

interface AiProjectCopilotProps {
  projectId: string;
  onCreateTasks: (tasks: Array<{ title: string; description: string; priority: TaskPriority }>) => Promise<void>;
}

const examples = [
  "Build an e-commerce website in 30 days with authentication, product listings, cart, checkout and testing.",
  "Launch a portfolio website with responsive pages, project gallery, contact form and deployment.",
];

export default function AiProjectCopilot({ projectId, onCreateTasks }: AiProjectCopilotProps) {
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<GeneratedProjectPlan | null>(null);
  const [drafts, setDrafts] = useState<DraftTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function generate() {
    setError("");
    setNotice("");
    setPlan(null);
    setDrafts([]);
    if (prompt.trim().length < 10) {
      setError("Describe the project in at least 10 characters.");
      return;
    }
    setLoading(true);
    try {
      const result = await generateProjectPlan(projectId, prompt);
      setPlan(result);
      setDrafts(result.tasks.map((task) => ({ ...task, selected: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate a project plan.");
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(index: number, patch: Partial<DraftTask>) {
    setDrafts((current) => current.map((task, i) => i === index ? { ...task, ...patch } : task));
  }

  async function addSelected() {
    const selected = drafts.filter((task) => task.selected && task.title.trim());
    if (!selected.length) {
      setError("Select at least one task to add.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await onCreateTasks(selected.map(({ title, description, priority }) => ({
        title: title.trim(), description: description.trim(), priority,
      })));
      setNotice(`${selected.length} task${selected.length === 1 ? "" : "s"} added to your board.`);
      setDrafts((current) => current.filter((task) => !task.selected));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Some tasks could not be saved. Please check the board before retrying.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm dark:border-blue-900/70 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-sky-50 p-5 dark:border-slate-800 dark:from-blue-950/40 dark:via-slate-900 dark:to-sky-950/30 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">✦ AI copilot</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Turn an idea into a project plan</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Generate task drafts, review them, then choose what gets added to this board.</p>
        </div>
        <span className="w-fit rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300">Review before saving</span>
      </div>

      <div className="p-5">
        <label htmlFor="project-copilot-prompt" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">What are you building?</label>
        <textarea id="project-copilot-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={2000} rows={3} disabled={loading || saving}
          placeholder="Example: Build an e-commerce website in 30 days. Include authentication, product catalogue, cart, checkout, payments and testing."
          className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">{prompt.length}/2000 characters</span>
          <button type="button" onClick={() => void generate()} disabled={loading || saving || prompt.trim().length < 10}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Generating plan…" : "✦ Generate project plan"}
          </button>
        </div>
        {!plan && !loading && <div className="mt-3 flex flex-wrap gap-2">{examples.map((example) => <button type="button" key={example} onClick={() => setPrompt(example)} className="rounded-full border border-slate-200 px-3 py-1.5 text-left text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300">{example.length > 75 ? `${example.slice(0, 72)}…` : example}</button>)}</div>}
        {loading && <p role="status" className="mt-4 text-sm text-blue-700 dark:text-blue-300">Planning tasks and subtasks. This may take a few moments…</p>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</p>}

        {plan && <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Generated draft</p><h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{plan.title}</h3>{plan.summary && <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{plan.summary}</p>}</div>
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{drafts.filter((t) => t.selected).length} of {drafts.length} selected</span>
          </div>
          <div className="space-y-3">
            {drafts.map((task, index) => <article key={`${index}-${task.title}`} className={`rounded-xl border p-4 transition ${task.selected ? "border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/10" : "border-slate-200 bg-slate-50 opacity-70 dark:border-slate-800 dark:bg-slate-950/40"}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={task.selected} onChange={(e) => updateDraft(index, { selected: e.target.checked })} aria-label={`Select ${task.title}`} className="mt-2 size-4 accent-blue-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={task.title} onChange={(e) => updateDraft(index, { title: e.target.value })} aria-label="Task title" className="min-w-[180px] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-semibold text-slate-900 outline-none focus:border-blue-300 focus:bg-white dark:text-white dark:focus:bg-slate-900" />
                    <select value={task.priority} onChange={(e) => updateDraft(index, { priority: e.target.value as TaskPriority })} aria-label="Task priority" className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold capitalize text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      <option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option>
                    </select>
                    <button type="button" onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">Remove</button>
                  </div>
                  <textarea value={task.description} onChange={(e) => updateDraft(index, { description: e.target.value })} rows={2} aria-label="Task description" placeholder="Add a description…" className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" />
                  {task.subtasks.length > 0 && <details className="mt-2 text-sm text-slate-600 dark:text-slate-400"><summary className="cursor-pointer font-medium">{task.subtasks.length} suggested subtasks (preview only)</summary><ul className="mt-2 list-inside list-disc space-y-1 pl-2">{task.subtasks.map((subtask, subIndex) => <li key={`${subIndex}-${subtask}`}>{subtask}</li>)}</ul><p className="mt-2 text-xs text-slate-500">Subtasks are not saved as separate records by this step.</p></details>}
                </div>
              </div>
            </article>)}
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setDrafts((current) => current.map((task) => ({ ...task, selected: true })))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">Select all</button>
            <button type="button" onClick={() => setDrafts((current) => current.map((task) => ({ ...task, selected: false })))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">Clear selection</button>
            <button type="button" onClick={() => void addSelected()} disabled={saving || !drafts.some((task) => task.selected)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">{saving ? "Adding tasks…" : `Add ${drafts.filter((task) => task.selected).length} selected tasks to board`}</button>
          </div>
        </div>}
      </div>
    </section>
  );
}
