import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, complaintsQuery, errMsg, type Status } from "@/lib/ccms";
import { PageHeader, StatCard, NoAccess } from "@/components/AppShell";
import { ComplaintList } from "@/components/ComplaintTable";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/technician")({
  head: () => ({ meta: [{ title: "Technician Dashboard — CCMS" }, { name: "description", content: "Your assigned maintenance jobs." }] }),
  component: TechDash,
});

function TechDash() {
  const { data: me } = useQuery(meQuery);
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({ ...complaintsQuery("tech", { technician: me?.id }), enabled: me?.role === "technician" });
  const { data: tech } = useQuery({
    queryKey: ["tech-self", me?.id],
    enabled: me?.role === "technician",
    queryFn: async () => (await supabase.from("technicians").select("*, category:categories(name)").eq("user_id", me!.id).maybeSingle()).data,
  });

  if (!me) return null;
  if (me.role !== "technician") return <NoAccess />;

  async function toggle(v: boolean) {
    const { error } = await supabase.from("technicians").update({ is_available: v }).eq("user_id", me!.id);
    if (error) { toast.error(errMsg(error)); return; }
    qc.invalidateQueries({ queryKey: ["tech-self"] });
  }
  async function move(id: string, to: Status) {
    const { error } = await supabase.rpc("update_complaint_status", { _complaint: id, _status: to });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Status updated");
    qc.invalidateQueries();
  }

  const active = rows.filter((r) => r.status === "assigned" || r.status === "in_progress");
  const done = rows.filter((r) => r.status === "resolved" || r.status === "closed");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow={tech?.category?.name ?? "General"} title="My Jobs">
        <label className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
          <Switch checked={tech?.is_available ?? true} onCheckedChange={toggle} /> Available for new jobs
        </label>
      </PageHeader>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard tone="accent" label="To start" value={rows.filter((r) => r.status === "assigned").length} />
        <StatCard tone="ink" label="In progress" value={rows.filter((r) => r.status === "in_progress").length} />
        <StatCard label="Completed" value={done.length} />
      </div>
      <h2 className="mb-3 text-xl font-bold">Active jobs</h2>
      <ComplaintList
        rows={active}
        empty="No active jobs. Enjoy the break ☕"
        action={(c) =>
          c.status === "assigned" ? (
            <Button size="sm" onClick={() => move(c.id, "in_progress")}>Start</Button>
          ) : c.status === "in_progress" ? (
            <Button size="sm" onClick={() => move(c.id, "resolved")}>Resolve</Button>
          ) : null
        }
      />
      <h2 className="mb-3 mt-10 text-xl font-bold">Completed</h2>
      <ComplaintList rows={done} empty="Nothing completed yet." />
    </div>
  );
}
