import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { meQuery, complaintsQuery, STATUSES, STATUS_LABEL, type Status } from "@/lib/ccms";
import { PageHeader } from "@/components/AppShell";
import { ComplaintList } from "@/components/ComplaintTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/complaints/")({
  head: () => ({ meta: [{ title: "My Complaints — CCMS" }, { name: "description", content: "Track the complaints you have raised." }] }),
  component: MyComplaints,
});

function MyComplaints() {
  const { data: me } = useQuery(meQuery);
  const { data: rows = [], isLoading } = useQuery({ ...complaintsQuery("mine", { reporter: me?.id }), enabled: !!me });
  const [tab, setTab] = useState<Status | "all">("all");
  const [q, setQ] = useState("");

  const filtered = rows.filter(
    (r) => (tab === "all" || r.status === tab) && (q === "" || `${r.title} ${r.ticket_no}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Tickets" title="My Complaints">
        <Button asChild><Link to="/complaints/new"><Plus /> New complaint</Link></Button>
      </PageHeader>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1">
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium", tab === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]} ({s === "all" ? rows.length : rows.filter((r) => r.status === s).length})
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or ticket" className="pl-8" />
        </div>
      </div>
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : <ComplaintList rows={filtered} empty="No complaints match." />}
    </div>
  );
}
