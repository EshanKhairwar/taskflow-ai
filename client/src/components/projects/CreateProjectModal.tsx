import type { FormEvent } from "react";
import { FolderKanban, Plus, X } from "lucide-react";

interface CreateProjectModalProps {
  open: boolean;
  projectName: string;
  description: string;
  creating: boolean;
  createError: string;
  onClose: () => void;
  onProjectNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function CreateProjectModal({
  open,
  projectName,
  description,
  creating,
  createError,
  onClose,
  onProjectNameChange,
  onDescriptionChange,
  onSubmit,
}: CreateProjectModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        className="my-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7"
      >
        <div className="mb-6 flex items-start justify-between">
          <div className="flex gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-blue-100 text-blue-600">
              <FolderKanban size={20} />
            </span>
            <div>
              <h2 id="create-project-title" className="text-lg font-bold text-slate-900">
                Create a project
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Give your next piece of work a home.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
            aria-label="Close modal"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <label htmlFor="project-name" className="mb-2 block text-xs font-semibold text-slate-700">
            Project name <span className="text-rose-500">*</span>
          </label>
          <input
            id="project-name"
            autoFocus
            required
            minLength={2}
            maxLength={100}
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
            placeholder="e.g. Website redesign"
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />

          <label htmlFor="project-description" className="mb-2 mt-5 block text-xs font-semibold text-slate-700">
            Description <span className="font-normal text-slate-400">Optional</span>
          </label>
          <textarea
            id="project-description"
            rows={3}
            maxLength={3000}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="What are you planning to accomplish?"
            className="w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm leading-5 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />

          {createError && (
            <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {createError}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-200 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
            >
              {creating ? "Creating..." : <><Plus size={16} /> Create project</>}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
