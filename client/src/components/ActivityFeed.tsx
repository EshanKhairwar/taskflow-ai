import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { apiRequest } from "../api/client";

type ActivityItem = {
  _id?: string;
  id?: string;
  type?: string;
  message?: string;
  createdAt?: string;
  actor?: { name?: string } | string;
  project?: { name?: string } | string;
  task?: { title?: string } | string;
};
type ActivityResponse =
  | ActivityItem[]
  | { activities?: ActivityItem[]; data?: ActivityItem[] };
function unwrap(response: ActivityResponse): ActivityItem[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.activities)) return response.activities;
  if (Array.isArray(response.data)) return response.data;
  return [];
}
function relativeTime(value?: string) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(unwrap(await apiRequest<ActivityResponse>("/activity")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load activity.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Recent activity</h2>
          <p className="mt-1 text-xs text-slate-500">
            A little momentum goes a long way.
          </p>
        </div>
        <button
          type="button"
          aria-label="Refresh activity"
          onClick={() => void load()}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-violet-700"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700"
        >
          {error}
          <button
            type="button"
            onClick={() => void load()}
            className="ml-2 font-bold underline"
          >
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center gap-2 border-y border-slate-100 py-7 text-xs text-slate-400">
          <LoaderCircle size={15} className="animate-spin" /> Loading activity…
        </div>
      ) : items.length ? (
        <div className="divide-y divide-slate-100">
          {items.slice(0, 6).map((item, index) => (
            <div
              key={item._id ?? item.id ?? `${item.createdAt}-${index}`}
              className="flex gap-3 py-3 first:pt-1 last:pb-1"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <Activity size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-xs leading-5 text-slate-700">
                  {item.message || "Project activity recorded."}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                  <Clock3 size={11} />
                  {relativeTime(item.createdAt)}
                  {typeof item.project === "object" && item.project?.name
                    ? ` · ${item.project.name}`
                    : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 border-y border-slate-100 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <Clock3 size={17} />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-700">
              It’s quiet for now
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-400">
              Project activity will appear here as you work.
            </p>
          </div>
        </div>
      )}
      <p className="mt-4 flex gap-2 text-[11px] leading-5 text-slate-500">
        <Sparkles size={15} className="mt-0.5 shrink-0 text-violet-500" />
        Tip: break large tasks into smaller, actionable steps.
      </p>
    </section>
  );
}
