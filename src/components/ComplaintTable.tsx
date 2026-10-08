import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import type { ReactNode } from "react";
import { type ComplaintRow, locationLabel } from "@/lib/ccms";
import { StatusBadge, PriorityTag } from "./StatusBadge";

export function ComplaintList({ rows, empty, action }: { rows: ComplaintRow[]; empty: string; action?: (c: ComplaintRow) => ReactNode }) {
  if (!rows.length)
    return <div className="rounded-lg border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">{empty}</div>;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <ul className="divide-y">
        {rows.map((c) => (
          <li key={c.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center">
            <Link to="/complaints/$id" params={{ id: c.id }} className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{c.ticket_no}</span>
                <PriorityTag priority={c.priority} />
                <span className="text-xs text-muted-foreground">· {c.category?.name}</span>
              </div>
              <p className="mt-1 truncate font-medium">{c.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {locationLabel(c.location)}
                {c.room ? ` · ${c.room}` : ""} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                {c.technician?.full_name ? ` · 🔧 ${c.technician.full_name}` : ""}
              </p>
            </Link>
            <div className="flex items-center gap-3">
              <StatusBadge status={c.status} />
              {action?.(c)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
