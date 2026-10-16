import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, MessageCircle, RefreshCw, Send } from "lucide-react";
import {
  createTaskComment,
  getTaskComments,
  type TaskComment,
} from "../../api/comments.api";

function authorName(author: TaskComment["author"]): string {
  if (typeof author === "string") return "Project member";
  return author?.name || author?.email || "Project member";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function TaskComments({ taskId }: { taskId: string }) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getTaskComments(taskId);
      setComments(response.comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load comments.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || posting) return;

    setPosting(true);
    setError("");
    try {
      const response = await createTaskComment(taskId, body);
      setComments((current) => [...current, response.comment]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to post comment.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={17} className="text-violet-500" />
          <h3 className="text-sm font-bold">Comments</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
            {comments.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void loadComments()}
          disabled={loading}
          aria-label="Refresh comments"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-violet-600 disabled:opacity-50 dark:hover:bg-slate-800"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
          <button type="button" onClick={() => void loadComments()} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
        {loading ? (
          <p className="flex items-center gap-2 py-4 text-xs text-slate-400">
            <LoaderCircle size={14} className="animate-spin" /> Loading comments…
          </p>
        ) : comments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-500 dark:border-slate-700">
            No comments yet. Start the conversation.
          </p>
        ) : (
          comments.map((comment) => (
            <article key={comment._id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/70">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {authorName(comment.author)}
                </p>
                <time dateTime={comment.createdAt} className="text-[10px] text-slate-400">
                  {formatDate(comment.createdAt)}
                </time>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-5 text-slate-600 dark:text-slate-300">
                {comment.body}
              </p>
            </article>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <label htmlFor={`comment-${taskId}`} className="sr-only">Write a comment</label>
        <textarea
          id={`comment-${taskId}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="Write a comment…"
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-950"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] text-slate-400">{draft.trim().length}/2000</p>
          <button
            type="submit"
            disabled={posting || !draft.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {posting ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
            {posting ? "Posting…" : "Post comment"}
          </button>
        </div>
      </form>
    </section>
  );
}
