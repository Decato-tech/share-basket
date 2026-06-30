import { createFileRoute } from "@tanstack/react-router";
import { SettingsScreen } from "@/components/settings-screen";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [{ title: "Settings — Household Groceries" }],
  }),
  component: SettingsScreen,
});
