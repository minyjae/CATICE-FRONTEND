import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// dev: เสิร์ฟ React ที่ :5173 + proxy ws/auth ไป backend Go :8080 (same-origin จาก browser)
// build: ออกผลลัพธ์กลับเข้า ../Catice2/web ให้ Go FileServer เสิร์ฟตอน prod
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/ws":       { target: "ws://localhost:8080", ws: true },
      "/login":    "http://localhost:8080",
      "/register": "http://localhost:8080",
      "/logout":   "http://localhost:8080",
      "/me":       "http://localhost:8080",
      "/users":    "http://localhost:8080",
    },
  },
  build: {
    outDir: "../Catice2/web",
    emptyOutDir: true,
  },
});
