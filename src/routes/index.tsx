import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CCMS — Report & track campus maintenance" },
      { name: "description", content: "Raise campus complaints, get technicians assigned and follow every fix from registered to closed." },
      { property: "og:title", content: "CCMS — Campus Complaint & Maintenance System" },
      { property: "og:description", content: "Raise campus complaints and follow every fix from registered to closed." },
    ],
  }),
  component: () => <Navigate to="/auth" replace />,
});
