import { createRoot } from "react-dom/client";
import "./styles/global.css";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";

// ไม่ใช้ StrictMode: effect ของ Office เปิด WebSocket — StrictMode (dev) จะ mount ซ้ำ
// ทำให้ต่อ/ปิด ws 2 รอบ ดูสับสน → ปิดไว้เพื่อให้ flow ชัด
// ErrorBoundary: กันจอขาวตอน render พัง (เช่น hot-patch ของ HMR ล้มเหลว) → โชว์ error + ปุ่มรีโหลด
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
