import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { meQuery, complaintsQuery, isStaff, STATUSES, STATUS_LABEL, ROLE_LABEL } from "@/lib/ccms";
import { PageHeader, StatCard } from "@/components/AppShell";
import { ComplaintList } from "@/components/ComplaintTable";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CCMS" }, { name: "description", content: "Your campus maintenance overview." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useQuery(meQuery);
  const filter = !me ? undefined : isStaff(me.role) ? undefined : me.role === "technician" ? { technician: me.id } : { reporter: me.id };
  const { data: rows = [], isLoading } = useQuery({ ...complaintsQuery("dash", filter), enabled: !!me });

  if (!me || isLoading) return <p className="text-muted-foreground">Loading…</p>;

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const open = rows.filter((r) => r.status !== "resolved" && r.status !== "closed").length;
  const byStatus = STATUSES.map((s) => ({ name: STATUS_LABEL[s], value: count(s) }));
  const catMap = new Map<string, number>();
  rows.forEach((r) => catMap.set(r.category?.name ?? "—", (catMap.get(r.category?.name ?? "—") ?? 0) + 1));
  const byCat = [...catMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const resolvedTimes = rows.filter((r) => r.resolved_at).map((r) => (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 36e5);
  const avg = resolvedTimes.length ? (resolvedTimes.reduce((a, b) => a + b, 0) / resolvedTimes.length).toFixed(1) + "h" : "—";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={ROLE_LABEL[me.role]} title={`Hello, ${me.profile?.full_name?.split(" ")[0] ?? "there"}`}>
        {me.role !== "technician" && (
          <Button asChild><Link to="/complaints/new"><Plus /> New complaint</Link></Button>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard tone="ink" label={isStaff(me.role) ? "All complaints" : me.role === "technician" ? "Jobs assigned" : "Your complaints"} value={rows.length} />
        <StatCard tone="accent" label="Open" value={open} hint="Not yet resolved" />
        <StatCard label="Resolved / Closed" value={count("resolved") + count("closed")} />
        <StatCard label="Avg. resolution" value={avg} hint="Registered → Resolved" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="By status" data={byStatus} />
        <ChartCard title="By category" data={byCat.length ? byCat : [{ name: "No data", value: 0 }]} />
      </div>

      <h2 className="mb-3 mt-10 text-xl font-bold">Recent activity</h2>
      <ComplaintList rows={rows.slice(0, 6)} empty="Nothing here yet. Register your first complaint to get started." />
    </div>
  );
}

function ChartCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="mb-4 text-sm font-semibold">{title}</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
