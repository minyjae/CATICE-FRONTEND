import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// dev: เสิร์ฟ React ที่ :5173 + proxy ws/auth ไป backend Go :8080 (same-origin จาก browser)
// build: ออกผลลัพธ์กลับเข้า ../Catice2/web ให้ Go FileServer เสิร์ฟตอน prod
const backendUrl = process.env.VITE_BACKEND_URL ?? "http://localhost:8080";
const wsUrl = backendUrl.replace(/^http/, "ws");

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/ws":       { target: wsUrl, ws: true },
      "/login":    backendUrl,
      "/register": backendUrl,
      "/logout":   backendUrl,
      "/me":       backendUrl,
      "/users":    backendUrl,
    },
  },
  build: {
    outDir: "../Catice2/web",
    emptyOutDir: true,
  },
});
