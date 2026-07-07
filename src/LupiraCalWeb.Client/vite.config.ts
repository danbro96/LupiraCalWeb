/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Same-origin BFF: the .NET backend (dev: http://localhost:5181) owns /api and the /auth routes. The
// browser only talks to the Vite origin (:5174), which proxies these through — so the session cookie
// stays first-party and there is no CORS.
const backend = process.env.BACKEND_ORIGIN ?? "http://localhost:5181";
const proxied = ["/api", "/auth", "/signin-oidc", "/signout-callback-oidc", "/livez", "/readyz"];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: Object.fromEntries(
      proxied.map((path) => [path, { target: backend, changeOrigin: true, secure: false }]),
    ),
  },
  build: {
    // Single-container deploy: emit straight into the BFF's wwwroot.
    outDir: "../LupiraCalWeb/wwwroot",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
