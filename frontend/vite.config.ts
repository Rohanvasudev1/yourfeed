/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** The frontend coverage gate (percent): `npm run coverage` fails below it. */
const COVERAGE_MIN = 80;

const API_URL = process.env.YOURFEED_API_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": API_URL } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      include: ["src/**"],
      exclude: ["src/test/**", "src/main.tsx", "src/**/*.d.ts", "src/**/*.test.{ts,tsx}"],
      reporter: ["text-summary", "html"],
      thresholds: { statements: COVERAGE_MIN, branches: COVERAGE_MIN, functions: COVERAGE_MIN, lines: COVERAGE_MIN },
    },
  },
});
