import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bell, ClipboardCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CCMS — Report & track campus maintenance" },
      { name: "description", content: "Raise campus complaints, get technicians assigned and follow every fix from registered to closed." },
      { property: "og:title", content: "CCMS — Campus Complaint & Maintenance System" },
      { property: "og:description", content: "Raise campus complaints and follow every fix from registered to closed." },
    ],
  }),
  component: Landing,
});

const FLOW = ["Registered", "Assigned", "In Progress", "Resolved", "Closed"];

function Landing() {
  return (
    <div className="min-h-screen grid-paper">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-md bg-ink font-display text-sm font-extrabold text-accent">CC</span>
          <span className="font-display text-lg font-bold">CCMS</span>
        </div>
        <Button asChild variant="outline"><Link to="/auth">Sign in</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-12 sm:pt-20">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-primary">Estate & Maintenance Office</p>
        <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.95] sm:text-7xl">
          Broken fan? Leaking tap? <span className="text-primary">Log it once.</span> Watch it get fixed.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          One place for students, faculty, technicians and the estate office to report, assign and close every campus maintenance issue.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/auth">Register a complaint <ArrowRight /></Link></Button>
        </div>

        <ol className="mt-16 grid gap-2 sm:grid-cols-5">
          {FLOW.map((s, i) => (
            <li key={s} className="rounded-lg border bg-card p-4">
              <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              <p className="mt-1 font-display text-lg font-bold">{s}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { icon: ClipboardCheck, t: "Report with a photo", d: "Pick the building, category and urgency. Attach a picture." },
            { icon: Wrench, t: "Right technician, fast", d: "The estate desk routes each job to an available specialist." },
            { icon: Bell, t: "Live updates", d: "Get notified as your ticket moves through every stage." },
          ].map((f) => (
            <div key={f.t} className="rounded-lg bg-ink p-6 text-ink-foreground">
              <f.icon className="size-6 text-accent" />
              <p className="mt-4 font-display text-lg font-bold">{f.t}</p>
              <p className="mt-1 text-sm opacity-75">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
