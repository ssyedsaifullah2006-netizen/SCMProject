import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/ccms";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { errMsg } from "@/lib/ccms";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — CCMS" }, { name: "description", content: "Updates on your complaints and jobs." }] }),
  component: Notifications,
});

function Notifications() {
  const { data: me } = useQuery(meQuery);
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications", "list", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  async function markAll() {
    if (!me) return;
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false).eq("user_id", me.id);
    if (error) { toast.error(errMsg(error)); return; }
    refresh();
  }
  async function markOne(id: string) {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    refresh();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    refresh();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Inbox" title="Notifications">
        <Button variant="outline" onClick={markAll} disabled={!items.some((i) => !i.is_read)}><CheckCheck /> Mark all read</Button>
      </PageHeader>
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
          <Bell className="mx-auto mb-2 size-6" /> You're all caught up.
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {items.map((n) => (
            <li key={n.id} className={cn("flex gap-3 p-4", !n.is_read && "bg-accent/40")}>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.is_read ? "bg-transparent" : "bg-primary")} />
              <div className="min-w-0 flex-1">
                {n.complaint_id ? (
                  <Link to="/complaints/$id" params={{ id: n.complaint_id }} onClick={() => markOne(n.id)} className="font-medium hover:underline">{n.title}</Link>
                ) : <p className="font-medium">{n.title}</p>}
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
              </div>
              <div className="flex items-start gap-1">
                {!n.is_read && <Button size="icon" variant="ghost" title="Mark as read" aria-label="Mark as read" onClick={() => markOne(n.id)}><CheckCheck /></Button>}
                <Button size="icon" variant="ghost" title="Delete notification" onClick={() => remove(n.id)} aria-label="Delete notification"><Trash2 className="size-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
