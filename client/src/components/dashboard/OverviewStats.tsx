import { CheckCircle2, Clock3, FolderKanban, ListTodo } from "lucide-react";

interface OverviewStatsProps {
  projectCount: number;
  loading: boolean;
}

export default function OverviewStats({ projectCount, loading }: OverviewStatsProps) {
  const stats = [
    {
      title: "Total projects",
      value: loading ? "—" : String(projectCount),
      sub: "Projects you can access",
      icon: FolderKanban,
      color: "bg-blue-100 text-blue-600",
    },
    {
      title: "Open tasks",
      value: "—",
      sub: "Task API integration pending",
      icon: ListTodo,
      color: "bg-sky-100 text-sky-600",
    },
    {
      title: "Tasks completed",
      value: "—",
      sub: "Task API integration pending",
      icon: CheckCircle2,
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      title: "Due soon",
      value: "—",
      sub: "Upcoming task deadlines",
      icon: Clock3,
      color: "bg-orange-100 text-orange-600",
    },
  ];

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ title, value, sub, icon: Icon, color }) => (
        <article
          key={title}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30"
        >
          <div className="mb-5 flex items-center justify-between">
            <span className={`grid size-10 place-items-center rounded-xl ${color}`}>
              <Icon size={19} />
            </span>
            <span className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] text-slate-400">
              Overview
            </span>
          </div>
          <p className="text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
          <p className="mt-2 text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-slate-400">{sub}</p>
        </article>
      ))}
    </section>
  );
}
