import { cn } from "@/lib/utils";
import { STATUS_LABEL, type Status, type Priority } from "@/lib/ccms";

const statusCls: Record<Status, string> = {
  registered: "bg-st-registered/12 text-st-registered border-st-registered/30",
  assigned: "bg-st-assigned/12 text-st-assigned border-st-assigned/30",
  in_progress: "bg-st-progress/15 text-accent-foreground border-st-progress/40",
  resolved: "bg-st-resolved/12 text-st-resolved border-st-resolved/30",
  closed: "bg-st-closed/12 text-st-closed border-st-closed/30",
};
const dotCls: Record<Status, string> = {
  registered: "bg-st-registered",
  assigned: "bg-st-assigned",
  in_progress: "bg-st-progress",
  resolved: "bg-st-resolved",
  closed: "bg-st-closed",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", statusCls[status])}>
      <span className={cn("size-1.5 rounded-full", dotCls[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const prCls: Record<Priority, string> = {
  low: "text-muted-foreground",
  medium: "text-foreground",
  high: "text-accent-foreground bg-accent/30",
  urgent: "text-destructive-foreground bg-destructive",
};
export function PriorityTag({ priority }: { priority: Priority }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider", prCls[priority])}>
      {priority}
    </span>
  );
}

export function StatusTrack({ status }: { status: Status }) {
  const steps: Status[] = ["registered", "assigned", "in_progress", "resolved", "closed"];
  const idx = steps.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-1">
      {steps.map((s, i) => (
        <li key={s} className="space-y-2">
          <div className={cn("h-1.5 rounded-full", i <= idx ? dotCls[status] : "bg-muted")} />
          <p className={cn("text-[11px] font-medium", i <= idx ? "text-foreground" : "text-muted-foreground")}>
            {STATUS_LABEL[s]}
          </p>
        </li>
      ))}
    </ol>
  );
}
