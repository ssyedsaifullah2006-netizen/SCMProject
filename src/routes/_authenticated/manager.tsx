import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { meQuery, complaintsQuery, lookupsQuery, isStaff, STATUSES, STATUS_LABEL } from "@/lib/ccms";
import { PageHeader, StatCard, NoAccess } from "@/components/AppShell";
import { ComplaintList } from "@/components/ComplaintTable";
import { AssignDialog, techniciansQuery } from "@/components/AssignDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/manager")({
  head: () => ({ meta: [{ title: "Estate Manager Dashboard — CCMS" }, { name: "description", content: "Triage, assign and monitor all campus complaints." }] }),
  component: Manager,
});

function Manager() {
  const { data: me } = useQuery(meQuery);
  const staff = isStaff(me?.role);
  const { data: rows = [] } = useQuery({ ...complaintsQuery("all"), enabled: staff });
  const { data: lk } = useQuery(lookupsQuery);
  const { data: techs = [] } = useQuery({ ...techniciansQuery, enabled: staff });
  const [status, setStatus] = useState("all");
  const [cat, setCat] = useState("all");

  if (!me) return null;
  if (!staff) return <NoAccess />;

  const filtered = rows.filter((r) => (status === "all" || r.status === status) && (cat === "all" || r.category_id === cat));
  const unassigned = rows.filter((r) => r.status === "registered");
  const overdue = rows.filter(
    (r) => r.status !== "resolved" && r.status !== "closed" && Date.now() - new Date(r.created_at).getTime() > (r.category?.sla_hours ?? 48) * 36e5,
  );
  const load = techs.map((t) => ({ ...t, active: rows.filter((r) => r.assigned_technician_id === t.user_id && (r.status === "assigned" || r.status === "in_progress")).length }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Estate desk" title="All complaints" />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard tone="accent" label="Awaiting assignment" value={unassigned.length} />
        <StatCard tone="ink" label="In progress" value={rows.filter((r) => r.status === "in_progress").length} />
        <StatCard label="Past target time" value={overdue.length} hint="Open beyond category SLA" />
        <StatCard label="Awaiting closure" value={rows.filter((r) => r.status === "resolved").length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-44 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {lk?.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="ml-auto self-center text-sm text-muted-foreground">{filtered.length} shown</span>
          </div>
          <ComplaintList
            rows={filtered}
            empty="No complaints match these filters."
            action={(c) =>
              c.status === "registered" || c.status === "assigned" ? (
                <AssignDialog complaintId={c.id} categoryId={c.category_id} current={c.assigned_technician_id} label={c.assigned_technician_id ? "Reassign" : "Assign"} />
              ) : null
            }
          />
        </div>
        <aside className="h-fit rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Technician load</h2>
          {load.length === 0 && <p className="text-sm text-muted-foreground">No technicians yet.</p>}
          <ul className="space-y-3">
            {load.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{t.category?.name ?? "General"} · {t.is_available ? "Available" : "Busy"}</p>
                </div>
                <span className="font-display text-xl font-bold">{t.active}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
