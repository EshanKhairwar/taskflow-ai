import { useState } from "react";
import {
  assistWithTask,
  type GeneratedTask,
  type TaskAssistantMode,
} from "../../api/ai.api";
import type { TaskPriority } from "../../types";

interface AiTaskAssistantProps {
  projectId: string;
  onUseSuggestion: (task: {
    title: string;
    description: string;
    priority: TaskPriority;
  }) => void;
}

const modeDetails: Record<TaskAssistantMode, { label: string; prompt: string; description: string }> = {
  draft: {
    label: "Create task draft",
    prompt: "Describe the task you want to create...",
    description: "Turn an idea into a clear task with suggested next steps.",
  },
  improve: {
    label: "Improve existing task",
    prompt: "Paste the current task title and description, then explain the intended outcome...",
    description: "Make an existing task clearer and more actionable.",
  },
  breakdown: {
    label: "Break task into steps",
    prompt: "Describe the complex task you want to break into smaller steps...",
    description: "Create an ordered list of manageable subtasks.",
  },
  priority: {
    label: "Review task priority",
    prompt: "Describe the task, its impact, and any deadline or urgency you know...",
    description: "Suggest a priority using only the context you provide.",
  },
};

export default function AiTaskAssistant({
  projectId,
  onUseSuggestion,
}: AiTaskAssistantProps) {
  const [mode, setMode] = useState<TaskAssistantMode>("draft");
  const [prompt, setPrompt] = useState("");
  const [suggestion, setSuggestion] = useState<GeneratedTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setError("");
    setSuggestion(null);
    if (prompt.trim().length < 5) {
      setError("Please describe the task in at least 5 characters.");
      return;
    }
    setLoading(true);
    try {
      setSuggestion(await assistWithTask(projectId, prompt, mode));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete the AI task assistant request.");
    } finally {
      setLoading(false);
    }
  }

  function useSuggestion() {
    if (!suggestion) return;
    onUseSuggestion({
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority,
    });
  }

  return (
    <section className="mb-5 rounded-xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">✦</span>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">AI Task Assistant</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Draft, improve, break down, or review a task before applying it.
          </p>
        </div>
      </div>

      <label htmlFor="ai-task-mode" className="mb-1.5 block text-sm font-medium">
        What should AI help with?
      </label>
      <select
        id="ai-task-mode"
        value={mode}
        disabled={loading}
        onChange={(event) => {
          setMode(event.target.value as TaskAssistantMode);
          setSuggestion(null);
          setError("");
        }}
        className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      >
        {(Object.keys(modeDetails) as TaskAssistantMode[]).map((key) => (
          <option key={key} value={key}>{modeDetails[key].label}</option>
        ))}
      </select>
      <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">{modeDetails[mode].description}</p>

      <label htmlFor="ai-task-prompt" className="mb-1.5 block text-sm font-medium">
        Task details
      </label>
      <textarea
        id="ai-task-prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={modeDetails[mode].prompt}
        rows={3}
        maxLength={2000}
        disabled={loading}
        className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">{prompt.length}/2000</span>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading || prompt.trim().length < 5}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Working..." : "✦ Run AI assistant"}
        </button>
      </div>

      {loading && <p role="status" className="mt-3 text-sm text-violet-700 dark:text-violet-300">AI is preparing a suggestion for review...</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {suggestion && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold text-slate-900 dark:text-white">Suggestion preview</h4>
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium capitalize text-violet-800 dark:bg-violet-900/50 dark:text-violet-200">
              {suggestion.priority} priority
            </span>
          </div>
          <h5 className="font-medium text-slate-900 dark:text-white">{suggestion.title}</h5>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
            {suggestion.description || "No description generated."}
          </p>
          <h5 className="mb-2 mt-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
            Suggested subtasks ({suggestion.subtasks.length})
          </h5>
          {suggestion.subtasks.length ? (
            <ul className="space-y-2">
              {suggestion.subtasks.map((subtask, index) => (
                <li key={`${index}-${subtask}`} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-violet-300 text-xs text-violet-700 dark:border-violet-700 dark:text-violet-300">{index + 1}</span>
                  <span>{subtask}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">No subtasks were suggested.</p>}
          <p className="mt-3 text-xs text-slate-500">
            Suggestions are drafts only. Review the output before using it; subtasks are not saved separately.
          </p>
          <button
            type="button"
            onClick={useSuggestion}
            className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Use suggestion in task form
          </button>
        </div>
      )}
    </section>
  );
}
