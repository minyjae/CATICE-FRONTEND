// วาดห้อง cozy top-down (พื้นไม้ + เฟอร์นิเจอร์) + ผู้เล่น — logic วาดล้วน ๆ ไม่พึ่ง React
import { CELL, WALL_ROWS } from "../constants";
import { colorFor } from "../../../shared/colors";
import type { Player, RoomName } from "../../../shared/protocol";

type Ctx = CanvasRenderingContext2D;
type SceneFn = (ctx: Ctx, W: number, H: number) => void;

function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, shade?: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  if (shade) {
    ctx.fillStyle = shade;
    ctx.fillRect(x, y + h - 4, w, 4);
  }
}

function boxLabel(ctx: Ctx, x: number, y: number, w: number, h: number, text: string) {
  ctx.font = "700 12px Inter, sans-serif";
  ctx.textAlign = "center"; // จัดกลางแนวนอนจากจุด x
  ctx.textBaseline = "middle"; // จัดกลางแนวตั้งจากจุด y
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x + w / 2, y + h / 2); // จุดกึ่งกลาง box
}

export function drawRoom(ctx: Ctx, W: number, H: number) {
  const WALL = (WALL_ROWS + 1) * CELL;

  // =========================
  // FLOOR
  // =========================
  for (let y = WALL; y < H; y += 16) {
    ctx.fillStyle = ((y / 16) | 0) % 2 ? "#9b8d73" : "#94866d";

    ctx.fillRect(0, y, W, 16);
  }

  ctx.strokeStyle = "rgba(0,0,0,.05)";
  ctx.lineWidth = 1;

  for (let y = WALL; y <= H; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // =========================
  // TOP WALL
  // =========================
  box(ctx, 0, 0, W, WALL, "#d8d5cf", "#bcb8b1");

  // LOGO
  box(ctx, W / 2 - 120, 8, 240, 40, "#c7c7c7", "#a8a8a8");

  ctx.fillStyle = "#2d2d2d";
  ctx.font = "700 18px Inter";
  ctx.textAlign = "center";
  ctx.fillText("CATICE OFFICE", W / 2, 34);

  // =========================
  // COFFEE BAR
  // =========================
  box(ctx, 220, 70, 260, 56, "#6e4526", "#4d2f18");

  box(ctx, 290, 80, 160, 24, "#1c2435", "#0d1525");

  for (let i = 0; i < 3; i++) {
    box(ctx, 210 + i * 24, 60, 12, 20, "#c39a1c", "#9c7a15");
  }

  // =========================
  // SPRINT BOARD
  // =========================
  box(ctx, 540, 80, 160, 130, "#f4f4f4", "#cccccc");

  ctx.fillStyle = "#222";
  ctx.font = "700 14px Inter";
  ctx.fillText("Sprint Board", 620, 105);

  const cards = ["#d2b04d", "#699867", "#4674a4", "#a36a55", "#8d6598"];

  cards.forEach((c, i) => {
    ctx.fillStyle = c;

    const row = i < 3 ? 0 : 1;
    const col = i < 3 ? i : i - 3;

    ctx.fillRect(555 + col * 45, 120 + row * 42, 30, 30);
  });

  // =========================
  // MEETING ZONE
  // =========================
  ctx.fillStyle = "#254b80";
  ctx.fillRect(70, 230 - 80, 130, 90);

  ctx.fillStyle = "#183660";
  ctx.fillRect(70, 314 - 80, 130, 36);

  box(ctx, 98, 270 - 90, 72, 62, "#6a3f1f", "#4d2b15");

  // =========================
  // LOUNGE
  // =========================
  box(ctx, 280, 240, 180, 120, "#a8adb3", "#7f8790");

  box(ctx, 315, 276, 110, 36, "#6a3f1f", "#4d2b15");

  // =========================
  // PLANTS
  // =========================
  const plant = (x: number, y: number) => {
    box(ctx, x - 14, y + 12, 28, 16, "#6b341d", "#4f2413");

    ctx.fillStyle = "#2d7a3f";
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
  };

  plant(60, 420);
  plant(710, 420);

  // =========================
  // LEFT DOOR
  // =========================
  box(ctx, 0, 288, 16, 80, "#3d2613", "#221208");

  ctx.fillStyle = "#d0b45c";
  ctx.beginPath();
  ctx.arc(10, 328, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px Inter";
  ctx.fillText("‹ Meeting", 80, 320);

  // =========================
  // RIGHT DOOR
  // =========================
  box(ctx, W - 16, 288, 16, 80, "#3d2613", "#221208");

  ctx.fillStyle = "#d0b45c";
  ctx.beginPath();
  ctx.arc(W - 10, 328, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px Inter";
  ctx.fillText("Office ›", W - 80, 320);
}

// ห้องประชุม — โทนน้ำเงินเทา + โต๊ะประชุมกลาง + ไวท์บอร์ด (ดูต่างจาก lobby ชัด ๆ)
export function drawMeetingRoom(ctx: Ctx, W: number, H: number) {
  const WALL = (WALL_ROWS + 1) * CELL;

  // พื้นพรมสีเข้ม
  for (let y = WALL; y < H; y += 16) {
    ctx.fillStyle = ((y / 16) | 0) % 2 ? "#3a4256" : "#353c4e";
    ctx.fillRect(0, y, W, 16);
  }
  ctx.strokeStyle = "rgba(255,255,255,.04)";
  ctx.lineWidth = 1;
  for (let y = WALL; y <= H; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // ผนังบน + ไวท์บอร์ด
  box(ctx, 0, 0, W, WALL, "#2a3142", "#1f2433");
  box(ctx, W / 2 - 90, 10, 180, 44, "#f4f6fb", "#cdd3e0");
  ctx.strokeStyle = "#9aa3b8";
  ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 - 90, 10, 180, 44);
  ctx.strokeStyle = "#5b6cff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 70, 26);
  ctx.lineTo(W / 2 - 10, 26);
  ctx.stroke();
  ctx.strokeStyle = "#2dd4bf";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 70, 38);
  ctx.lineTo(W / 2 + 30, 38);
  ctx.stroke();

  // โต๊ะประชุมใหญ่ตรงกลาง
  const tx = W / 2 - 150,
    ty = 200,
    tw = 300,
    th = 150;
  ctx.fillStyle = "#6b4a2e";
  ctx.beginPath();
  ctx.roundRect(tx, ty, tw, th, 26);
  ctx.fill();
  ctx.fillStyle = "#7d5836";
  ctx.beginPath();
  ctx.roundRect(tx + 12, ty + 12, tw - 24, th - 24, 18);
  ctx.fill();

  // เก้าอี้รอบโต๊ะ
  const chair = (cx: number, cy: number) => {
    ctx.fillStyle = "#222838";
    ctx.beginPath();
    ctx.roundRect(cx - 14, cy - 14, 28, 28, 7);
    ctx.fill();
    ctx.fillStyle = "#39415a";
    ctx.beginPath();
    ctx.roundRect(cx - 14, cy - 14, 28, 8, 6);
    ctx.fill();
  };
  for (let i = 0; i < 4; i++) {
    const cx = tx + 50 + i * 67;
    chair(cx, ty - 26);
    chair(cx, ty + th + 26);
  }
  chair(tx - 28, ty + th / 2);
  chair(tx + tw + 28, ty + th / 2);

  // จอติดผนังซ้าย + ต้นไม้มุมขวาล่าง
  box(ctx, 24, 120, 18, 80, "#11151f", "#0a0d14");
  box(ctx, 690, 452, 32, 24, "#7a4a28", "#5c3619");
  ctx.fillStyle = "#3f8f5a";
  ctx.beginPath();
  ctx.arc(706, 446, 22, 0, Math.PI * 2);
  ctx.fill();

  // ประตูกลับ lobby (ขอบขวา แถว 9–10 ตรงกับ DOORS.meeting_room)
  box(ctx, W - 16, 288, 16, 80, "#3d2613", "#221208");

  ctx.fillStyle = "#d0b45c";
  ctx.beginPath();
  ctx.arc(W - 10, 328, 3, 0, Math.PI * 2);
  ctx.fill();
  boxLabel(ctx, W - 90, 224 + 78, 48, 16, "Lobby ==>");
}

// ออฟฟิศ dev — โทนสว่าง + โต๊ะทำงานเป็นคลัสเตอร์ + เซิร์ฟเวอร์แร็ค
export function drawOffice(ctx: Ctx, W: number, H: number) {
  const WALL = (WALL_ROWS + 1) * CELL;

  // =========================
  // FLOOR
  // =========================
  for (let y = WALL; y < H; y += 16) {
    ctx.fillStyle = ((y / 16) | 0) % 2 ? "#e6e9ef" : "#dde2ea";

    ctx.fillRect(0, y, W, 16);
  }

  ctx.strokeStyle = "rgba(0,0,0,.04)";
  ctx.lineWidth = 1;

  for (let y = WALL; y <= H; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // =========================
  // TOP WALL
  // =========================
  box(ctx, 0, 0, W, WALL, "#f7f8fa", "#d7dce5");

  // Logo Board
  box(ctx, W / 2 - 80, 10, 160, 40, "#ffffff", "#d8dce5");

  boxLabel(ctx, W / 2 - 80, 10, 160, 40, "DEV OFFICE");

  // =========================
  // WORKSTATION
  // =========================

  function workstation(x: number, y: number) {
    // โต๊ะ

    box(ctx, x, y, 120, 50, "#8a5a32", "#6e4424");

    // Monitor

    box(ctx, x + 45, y + 5, 30, 18, "#1c2333", "#111827");

    // Keyboard

    box(ctx, x + 38, y + 28, 44, 5, "#d1d5db");

    // Chair top

    ctx.fillStyle = "#4b5563";
    ctx.beginPath();
    ctx.roundRect(x + 44, y - 18, 32, 12, 4);
    ctx.fill();

    // Chair bottom

    ctx.beginPath();
    ctx.roundRect(x + 44, y + 56, 32, 12, 4);
    ctx.fill();
  }

  // =========================
  // DESK CLUSTER
  // =========================

  function deskCluster(x: number, y: number) {
    workstation(x, y);

    workstation(x, y + 70);

    workstation(x + 140, y);

    workstation(x + 140, y + 70);
  }

  // =========================
  // OFFICE DESKS
  // =========================

  deskCluster(70, 100);

  deskCluster(400, 100);

  deskCluster(70, 280);

  deskCluster(400, 280);

  // =========================
  // SERVER RACK
  // =========================

  box(ctx, 20, 110, 30, 120, "#2d3748", "#1a202c");

  for (let i = 0; i < 5; i++) {
    box(ctx, 24, 118 + i * 22, 22, 12, "#111827");

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(40, 120 + i * 22, 3, 3);
  }

  // =========================
  // PANTRY
  // =========================

  box(ctx, 650, 100, 45, 90, "#dfe4ec", "#b7c0cc");

  box(ctx, 705, 105, 22, 48, "#60a5fa", "#2563eb");

  box(ctx, 630, 205, 100, 40, "#8a5a32", "#6e4424");

  // cups

  box(ctx, 645, 214, 8, 8, "#fff");
  box(ctx, 660, 214, 8, 8, "#fff");
  box(ctx, 675, 214, 8, 8, "#fff");

  // =========================
  // MEETING CORNER
  // =========================

  ctx.fillStyle = "#d8dee9";

  ctx.beginPath();

  ctx.roundRect(560, 360, 160, 110, 14);

  ctx.fill();

  ctx.fillStyle = "#6b4a2e";

  ctx.beginPath();

  ctx.roundRect(590, 395, 100, 35, 10);

  ctx.fill();

  const chair = (x: number, y: number) => {
    ctx.fillStyle = "#4b5563";

    ctx.beginPath();

    ctx.roundRect(x, y, 16, 16, 4);

    ctx.fill();
  };

  chair(620, 370);
  chair(645, 370);

  chair(620, 440);
  chair(645, 440);

  chair(570, 405);
  chair(695, 405);

  // =========================
  // PLANTS
  // =========================

  function plant(x: number, y: number) {
    box(ctx, x - 14, y, 28, 18, "#8b5e3c", "#6e4424");

    ctx.fillStyle = "#4caf50";

    ctx.beginPath();

    ctx.arc(x, y - 10, 18, 0, Math.PI * 2);

    ctx.fill();
  }

  plant(40, 470);

  plant(740, 470);

  // =========================
  // DOORS
  // =========================

  // กลับ Lobby

  box(ctx, 0, 288, 16, 80, "#3d2613", "#221208");

  ctx.fillStyle = "#d0b45c";
  ctx.beginPath();
  ctx.arc(10, 328, 3, 0, Math.PI * 2);
  ctx.fill();

  boxLabel(ctx, 30, 224 + 78, 60, 16, "<== Lobby");
}

// เลือก scene วาดตามชื่อห้อง (default = lobby)
export const ROOM_SCENE: Record<RoomName, SceneFn> = {
  lobby: drawRoom,
  meeting_room: drawMeetingRoom,
  office: drawOffice,
};

// วาดผู้เล่นทุกคน (players = {id:{x,y,name}}, myId = id ตัวเอง)
export function drawPlayers(ctx: Ctx, players: Record<string, Player>, myId: string | null) {
  for (const id in players) {
    const p = players[id];
    const cx = p.x * CELL + CELL / 2;
    const cy = p.y * CELL + CELL / 2;

    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + CELL / 2 - 4, CELL / 2 - 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colorFor(id);
    ctx.beginPath();
    ctx.arc(cx, cy, CELL / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = id === myId ? 3 : 2;
    ctx.strokeStyle = id === myId ? "#fff" : "rgba(0,0,0,.45)";
    ctx.stroke();

    ctx.font = "700 12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.strokeText(p.name || "…", cx, cy - CELL / 2);
    ctx.fillStyle = "#2a1d0e";
    ctx.fillText(p.name || "…", cx, cy - CELL / 2);
  }
}
