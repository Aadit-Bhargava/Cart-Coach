import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Override with API_PROXY=http://localhost:9000 to point the dev server at another backend.
const apiTarget = process.env.API_PROXY ?? "http://localhost:8080";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5174,
    // The Go service serves /api and /static in development.
    proxy: { "/api": apiTarget, "/static": apiTarget },
  },
});
