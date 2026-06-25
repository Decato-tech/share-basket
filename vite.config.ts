// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify("kjnrlrjmlhyolgshbjxa"),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://kjnrlrjmlhyolgshbjxa.supabase.co"),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqbnJscmptbGh5b2xnc2hianhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNDgxNDksImV4cCI6MjA5NzYyNDE0OX0.L2G_HAZ1kqW2jdCvEBqWqbd1oXYSCvMdkuRMhFJLmaU",
      ),
    },
  },
});
