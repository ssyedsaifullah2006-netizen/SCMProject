import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { COMPLAINT_SELECT, meQuery, isStaff, errMsg, locationLabel, STATUS_LABEL, type Status, type AppRole } from "@/lib/ccms";
import { StatusBadge, StatusTrack, PriorityTag } from "@/components/StatusBadge";
import { AssignDialog } from "@/components/AssignDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/complaints/$id")({
  head: () => ({ meta: [{ title: "Complaint Details — CCMS" }, { name: "description", content: "Status, history and actions for a complaint." }] }),
  component: Details,
});

function nextActions(status: Status, role: AppRole, isTech: boolean, isReporter: boolean): { to: Status; label: string; variant?: "default" | "outline" }[] {
  const staff = isStaff(role);
  const out: { to: Status; label: string; variant?: "default" | "outline" }[] = [];
  if (status === "assigned" && (staff || isTech)) out.push({ to: "in_progress", label: "Start work" });
  if (status === "in_progress" && (staff || isTech)) out.push({ to: "resolved", label: "Mark resolved" });
  if (status === "resolved" && (staff || isReporter)) {
    out.push({ to: "closed", label: "Confirm & close" });
    out.push({ to: "in_progress", label: "Reopen", variant: "outline" });
  }
  if (status === "registered" && staff) out.push({ to: "closed", label: "Close (invalid)", variant: "outline" });
  return out;
}

function Details() {
  const { id } = Route.useParams();
  const { data: me } = useQuery(meQuery);
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: c, isLoading } = useQuery({
    queryKey: ["complaint", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("complaints").select(COMPLAINT_SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: updates = [] } = useQuery({
    queryKey: ["complaint", id, "updates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaint_updates")
        .select("*, author:profiles(full_name)")
        .eq("complaint_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
  const { data: photo } = useQuery({
    queryKey: ["photo", c?.photo_url],
    enabled: !!c?.photo_url,
    queryFn: async () => {
      const { data } = await supabase.storage.from("complaint-photos").createSignedUrl(c!.photo_url!, 3600);
      return data?.signedUrl ?? null;
    },
  });

  if (isLoading || !me) return <p className="text-muted-foreground">Loading…</p>;
  if (!c)
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <h2 className="text-xl font-bold">Complaint not found</h2>
        <p className="text-sm text-muted-foreground">It may not exist or you don't have access.</p>
      </div>
    );

  const isTech = c.assigned_technician_id === me.id;
  const isReporter = c.reporter_id === me.id;
  const actions = nextActions(c.status, me.role, isTech, isReporter);

  async function move(to: Status) {
    setBusy(to);
    const { error } = await supabase.rpc("update_complaint_status", { _complaint: id, _status: to, ...(note.trim() ? { _note: note.trim() } : {}) });
    setBusy(null);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(`Moved to ${STATUS_LABEL[to]}`);
    setNote("");
    qc.invalidateQueries();
  }
  async function comment() {
    if (note.trim().length < 2) { toast.error("Write a note first"); return; }
    setBusy("note");
    const { error } = await supabase.rpc("add_complaint_note", { _complaint: id, _note: note.trim() });
    setBusy(null);
    if (error) { toast.error(errMsg(error)); return; }
    setNote("");
    qc.invalidateQueries({ queryKey: ["complaint", id] });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-primary">{c.ticket_no}</span>
            <PriorityTag priority={c.priority} />
          </div>
          <h1 className="mt-1 text-3xl font-bold">{c.title}</h1>
        </div>
        <StatusBadge status={c.status} />
      </div>

      <div className="mb-6 rounded-lg border bg-card p-5"><StatusTrack status={c.status} /></div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Description</h2>
            <p className="whitespace-pre-wrap">{c.description}</p>
            {photo && <a href={photo} target="_blank" rel="noreferrer"><img src={photo} alt="Complaint" className="mt-4 max-h-80 rounded-md border object-cover" /></a>}
          </section>

          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h2>
            <ol className="relative space-y-5 border-l pl-5">
              {updates.map((u) => (
                <li key={u.id} className="relative">
                  <span className="absolute -left-[25px] top-1 size-2.5 rounded-full border-2 border-card bg-primary" />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{u.author?.full_name ?? "System"}</span>
                    {u.new_status && u.old_status !== u.new_status ? <StatusBadge status={u.new_status} /> : <MessageSquare className="size-3.5 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">{format(new Date(u.created_at), "d MMM, HH:mm")}</span>
                  </div>
                  {u.note && <p className="mt-1 text-sm text-muted-foreground">{u.note}</p>}
                </li>
              ))}
            </ol>
            {c.status !== "closed" && (
              <div className="mt-6 space-y-3 border-t pt-5">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (also attached to a status change)" maxLength={1000} rows={3} />
                <div className="flex flex-wrap gap-2">
                  {actions.map((a) => (
                    <Button key={a.to + a.label} variant={a.variant ?? "default"} onClick={() => move(a.to)} disabled={!!busy}>
                      {busy === a.to && <Loader2 className="animate-spin" />}{a.label}
                    </Button>
                  ))}
                  <Button variant="ghost" onClick={comment} disabled={!!busy}>{busy === "note" && <Loader2 className="animate-spin" />}Add note</Button>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="space-y-3 rounded-lg border bg-card p-5 text-sm">
            <Info k="Category" v={c.category?.name} />
            <Info k="Location" v={locationLabel(c.location)} />
            {c.room && <Info k="Room / spot" v={c.room} />}
            <Info k="Reported by" v={`${c.reporter?.full_name ?? "—"}${c.reporter?.department ? ` (${c.reporter.department})` : ""}`} />
            <Info k="Filed" v={format(new Date(c.created_at), "d MMM yyyy, HH:mm")} />
            <Info k="Target" v={`${c.category?.sla_hours ?? "—"}h response`} />
            <Info k="Technician" v={c.technician?.full_name ?? "Not assigned"} />
            {c.resolved_at && <Info k="Resolved" v={format(new Date(c.resolved_at), "d MMM yyyy, HH:mm")} />}
          </div>
          {isStaff(me.role) && c.status !== "resolved" && c.status !== "closed" && (
            <AssignDialog complaintId={c.id} categoryId={c.category_id} current={c.assigned_technician_id} label={c.assigned_technician_id ? "Reassign technician" : "Assign technician"} />
          )}
        </aside>
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{k}</p>
      <p className="font-medium">{v ?? "—"}</p>
    </div>
  );
}
