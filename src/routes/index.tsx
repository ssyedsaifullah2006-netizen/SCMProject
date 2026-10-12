import { pageHead } from "@/lib/page-head";
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => pageHead("CCMS — Campus maintenance", "Campus Complaint & Maintenance System account access."),
  component: () => <Navigate to="/auth" replace />,
});
