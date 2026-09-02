import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API = process.env.AG_API_ORIGIN ?? "http://127.0.0.1:5311";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", sourcemap: false },
  server: {
    proxy: {
      "/api": { target: API, changeOrigin: true },
      "/events": { target: API.replace(/^http/, "ws"), ws: true },
    },
  },
});
