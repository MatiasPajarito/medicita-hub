import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    test: {
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["supabase/**", "node_modules/**"],
    },
  },
});