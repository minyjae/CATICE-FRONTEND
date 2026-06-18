import { createRoot } from "react-dom/client";
import "./styles/global.css";
import App from "./App.jsx";

// ไม่ใช้ StrictMode: effect ของ Office เปิด WebSocket — StrictMode (dev) จะ mount ซ้ำ
// ทำให้ต่อ/ปิด ws 2 รอบ ดูสับสน → ปิดไว้เพื่อให้ flow ชัด
createRoot(document.getElementById("root")).render(<App />);
