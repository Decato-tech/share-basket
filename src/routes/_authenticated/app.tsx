import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [{ title: "Groceries — Household Groceries" }],
  }),
  component: AppShell,
});