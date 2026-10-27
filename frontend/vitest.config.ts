import { defineConfig } from "vitest/config";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [viteReact()],
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    // tests must not depend on a developer's .env.local
    env: { VITE_API_MOCKING: "true", VITE_API_MOCKING_KEEP_SESSION: "false" },
  },
});
