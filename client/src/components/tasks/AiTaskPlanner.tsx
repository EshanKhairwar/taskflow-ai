
import { useState } from "react";
import { generateTask, type GeneratedTask } from "../../api/ai.api";
import type { TaskPriority } from "../../types";

interface AiTaskPlannerProps {
  projectId: string;
  onUseSuggestion: (task: {
    title: string;
    description: string;
    priority: TaskPriority;
  }) => void;
}

export default function AiTaskPlanner({
  projectId,
  onUseSuggestion,
}: AiTaskPlannerProps) {
  const [prompt, setPrompt] = useState("");
  const [suggestion, setSuggestion] = useState<GeneratedTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setError("");
    setSuggestion(null);

    if (prompt.trim().length < 5) {
      setError("Please describe your task in at least 5 characters.");
      return;
    }

    setLoading(true);

    try {
      const result = await generateTask(projectId, prompt);
      setSuggestion(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate a task. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleUseSuggestion() {
    if (!suggestion) return;

    onUseSuggestion({
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority,
    });
  }

  return (
    <section className="mb-5 rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">✦</span>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            AI Task Planner
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Describe your task and let AI prepare a draft.
          </p>
        </div>
      </div>

      <label
        htmlFor="ai-task-prompt"
        className="mb-1.5 block text-sm font-medium"
      >
        What do you want to accomplish?
      </label>

      <textarea
        id="ai-task-prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="e.g. Build JWT authentication with login, signup and protected routes..."
        rows={3}
        maxLength={2000}
        disabled={loading}
        className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">
          {prompt.length}/2000
        </span>

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading || prompt.trim().length < 5}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generating..." : "✦ Generate with AI"}
        </button>
      </div>

      {loading && (
        <p role="status" className="mt-3 text-sm text-blue-700 dark:text-blue-300">
          AI is preparing your task and subtasks...
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {suggestion && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold text-slate-900 dark:text-white">
              Generated preview
            </h4>

            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium capitalize text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
              {suggestion.priority} priority
            </span>
          </div>

          <h5 className="font-medium text-slate-900 dark:text-white">
            {suggestion.title}
          </h5>

          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
            {suggestion.description || "No description generated."}
          </p>

          <div className="mt-4">
            <h5 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Suggested subtasks ({suggestion.subtasks.length})
            </h5>

            {suggestion.subtasks.length > 0 ? (
              <ul className="space-y-2">
                {suggestion.subtasks.map((subtask, index) => (
                  <li
                    key={`${index}-${subtask}`}
                    className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                  >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-blue-300 text-xs text-blue-700 dark:border-blue-700 dark:text-blue-300">
                      {index + 1}
                    </span>
                    <span>{subtask}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                No subtasks were suggested.
              </p>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Subtasks are a preview only and will not be saved to the database.
          </p>

          <button
            type="button"
            onClick={handleUseSuggestion}
            className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Use suggestion in task form
          </button>
        </div>
      )}
    </section>
  );
}
