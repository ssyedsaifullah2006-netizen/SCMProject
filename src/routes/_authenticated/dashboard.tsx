import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { meQuery, complaintsQuery, isStaff } from "@/lib/ccms";
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
  const { data: rows = [], isLoading, error, refetch } = useQuery({ ...complaintsQuery("dash", filter), enabled: !!me });

  if (error) return <div role="alert" className="space-y-3"><p>Unable to load complaints.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>;

  if (!me || isLoading) return <p className="text-muted-foreground">Loading…</p>;

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const open = rows.filter((r) => r.status !== "resolved" && r.status !== "closed").length;
  const resolvedTimes = rows.flatMap((r) => r.resolved_at ? [(new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / 36e5] : []);
  const avg = resolvedTimes.length ? (resolvedTimes.reduce((a, b) => a + b, 0) / resolvedTimes.length).toFixed(1) + "h" : "—";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Dashboard">
        {me.role !== "technician" && (
          <Button asChild><Link to="/complaints/new"><Plus /> New complaint</Link></Button>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard tone="ink" label={isStaff(me.role) ? "All complaints" : me.role === "technician" ? "Jobs assigned" : "Your complaints"} value={rows.length} />
        <StatCard tone="accent" label="Open" value={open} hint="Not yet resolved" />
        <StatCard label="Resolved / Closed" value={count("resolved") + count("closed")} />
        <StatCard label="Avg. resolution" value={avg} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Recent complaints</h2>
      <ComplaintList rows={rows.slice(0, 6)} empty="No complaints yet." />
    </div>
  );
}

