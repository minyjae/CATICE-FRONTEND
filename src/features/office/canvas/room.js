// วาดห้อง cozy top-down (พื้นไม้ + เฟอร์นิเจอร์) + ผู้เล่น — logic วาดล้วน ๆ ไม่พึ่ง React
import { CELL, WALL_ROWS } from "../constants.js";
import { colorFor } from "../../../shared/colors.js";

function box(ctx, x, y, w, h, color, shade) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  if (shade) { ctx.fillStyle = shade; ctx.fillRect(x, y + h - 4, w, 4); }
}

function boxLabel(ctx, x, y, w, h, text) {
  ctx.font = "700 12px Inter, sans-serif";
  ctx.textAlign = "center";       // จัดกลางแนวนอนจากจุด x
  ctx.textBaseline = "middle";    // จัดกลางแนวตั้งจากจุด y
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x + w / 2, y + h / 2);  // จุดกึ่งกลาง box
}

export function drawRoom(ctx, W, H) {
  const WALL = (WALL_ROWS + 1) * CELL; // ความสูงโซนผนังด้านบน

  // พื้นไม้
  for (let y = WALL; y < H; y += 16) {
    ctx.fillStyle = (((y / 16) | 0) % 2) ? "#caa069" : "#c39a61";
    ctx.fillRect(0, y, W, 16);
  }
  ctx.strokeStyle = "rgba(120,84,40,.22)"; ctx.lineWidth = 1;
  for (let y = WALL; y <= H; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // ผนัง + หน้าต่าง
  box(ctx, 0, 0, W, WALL, "#e7d3a3", "#caa86a");
  box(ctx, W / 2 - 52, 12, 104, 38, "#8fc2dd", "#5f93b3");
  ctx.strokeStyle = "#6e9bb5"; ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 - 52, 12, 104, 38);
  ctx.beginPath(); ctx.moveTo(W / 2, 12); ctx.lineTo(W / 2, 50); ctx.stroke();

  // โต๊ะคอม (ซ้ายบน)
  box(ctx, 30, 84, 96, 50, "#8a5a32", "#6e4424");
  box(ctx, 40, 90, 78, 30, "#3f6fc4", "#2b4f93");
  box(ctx, 56, 122, 46, 8, "#caa069");

  // ทีวี + เครื่องเกม
  box(ctx, 160, 90, 120, 58, "#7a4a28", "#5c3619");
  box(ctx, 170, 98, 100, 38, "#18243f", "#0e1830");
  box(ctx, 196, 150, 48, 16, "#444a55", "#2c313a");

  // ตู้ (กลาง)
  box(ctx, 310, 84, 56, 72, "#ded7c2", "#bdb59c");
  ctx.strokeStyle = "#b3ab90"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(310, 118); ctx.lineTo(366, 118); ctx.stroke();

  // บันได (ขวาบน)
  for (let i = 0; i < 5; i++) {
    box(ctx, 560, 84 + i * 17, 150, 17, i % 2 ? "#b98a50" : "#a87b44", "#7c5832");
  }

  // โต๊ะเหลือง (ซ้ายกลาง)
  ctx.fillStyle = "#e6c24e"; ctx.beginPath(); ctx.roundRect(30, 205, 72, 46, 8); ctx.fill();
  ctx.fillStyle = "#c8a232"; ctx.fillRect(30, 243, 72, 6);

  // ต้นไม้ (ซ้ายล่าง)
  box(ctx, 52, 452, 36, 26, "#b65a3c", "#8c4128");
  ctx.fillStyle = "#5aa05a"; ctx.beginPath(); ctx.arc(70, 446, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#6cb86c"; ctx.beginPath(); ctx.arc(62, 440, 12, 0, Math.PI * 2); ctx.fill();

  // พรม (กลางล่าง)
  ctx.fillStyle = "#efb4c6"; ctx.beginPath(); ctx.roundRect(250, 300, 250, 150, 22); ctx.fill();
  ctx.fillStyle = "#f2e3b0"; ctx.beginPath(); ctx.roundRect(268, 318, 214, 114, 16); ctx.fill();

  // // เตียง (ขวาล่าง)
  // box(ctx, 596, 330, 134, 156, "#9fb2d4", "#7e91b4");
  // box(ctx, 604, 338, 118, 34, "#ffffff", "#dfe4ee");
  // box(ctx, 604, 376, 118, 102, "#f0aebf", "#d089a0");

  // ประตูไป meeting room (ขอบซ้าย แถว 9–10 ตรงกับ DOORS.lobby)
  box(ctx, 0, 224 + 64, 8, 48, "#e5c76b", "#000000");
  boxLabel(ctx, 50, 224 + 78, 48, 16, "<== Meeting Room");
}

// ห้องประชุม — โทนน้ำเงินเทา + โต๊ะประชุมกลาง + ไวท์บอร์ด (ดูต่างจาก lobby ชัด ๆ)
export function drawMeetingRoom(ctx, W, H) {
  const WALL = (WALL_ROWS + 1) * CELL;

  // พื้นพรมสีเข้ม
  for (let y = WALL; y < H; y += 16) {
    ctx.fillStyle = (((y / 16) | 0) % 2) ? "#3a4256" : "#353c4e";
    ctx.fillRect(0, y, W, 16);
  }
  ctx.strokeStyle = "rgba(255,255,255,.04)"; ctx.lineWidth = 1;
  for (let y = WALL; y <= H; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // ผนังบน + ไวท์บอร์ด
  box(ctx, 0, 0, W, WALL, "#2a3142", "#1f2433");
  box(ctx, W / 2 - 90, 10, 180, 44, "#f4f6fb", "#cdd3e0");
  ctx.strokeStyle = "#9aa3b8"; ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 - 90, 10, 180, 44);
  ctx.strokeStyle = "#5b6cff"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(W / 2 - 70, 26); ctx.lineTo(W / 2 - 10, 26); ctx.stroke();
  ctx.strokeStyle = "#2dd4bf";
  ctx.beginPath(); ctx.moveTo(W / 2 - 70, 38); ctx.lineTo(W / 2 + 30, 38); ctx.stroke();

  // โต๊ะประชุมใหญ่ตรงกลาง
  const tx = W / 2 - 150, ty = 200, tw = 300, th = 150;
  ctx.fillStyle = "#6b4a2e"; ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 26); ctx.fill();
  ctx.fillStyle = "#7d5836"; ctx.beginPath(); ctx.roundRect(tx + 12, ty + 12, tw - 24, th - 24, 18); ctx.fill();

  // เก้าอี้รอบโต๊ะ
  const chair = (cx, cy) => {
    ctx.fillStyle = "#222838"; ctx.beginPath(); ctx.roundRect(cx - 14, cy - 14, 28, 28, 7); ctx.fill();
    ctx.fillStyle = "#39415a"; ctx.beginPath(); ctx.roundRect(cx - 14, cy - 14, 28, 8, 6); ctx.fill();
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
  ctx.fillStyle = "#3f8f5a"; ctx.beginPath(); ctx.arc(706, 446, 22, 0, Math.PI * 2); ctx.fill();

  // ประตูกลับ lobby (ขอบขวา แถว 9–10 ตรงกับ DOORS.meeting_room)
  box(ctx, W - 8, 224 + 64, 8, 48, "#e5c76b", "#000000");
  boxLabel(ctx, W - 90, 224 + 78, 48, 16, "Lobby ==>");
}

// เลือก scene วาดตามชื่อห้อง (default = lobby)
export const ROOM_SCENE = {
  lobby: drawRoom,
  meeting_room: drawMeetingRoom,
};

// วาดผู้เล่นทุกคน (players = {id:{x,y,name}}, myId = id ตัวเอง)
export function drawPlayers(ctx, players, myId) {
  for (const id in players) {
    const p = players[id];
    const cx = p.x * CELL + CELL / 2;
    const cy = p.y * CELL + CELL / 2;

    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath(); ctx.ellipse(cx, cy + CELL / 2 - 4, CELL / 2 - 5, 4, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = colorFor(id);
    ctx.beginPath(); ctx.arc(cx, cy, CELL / 2 - 4, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = id === myId ? 3 : 2;
    ctx.strokeStyle = id === myId ? "#fff" : "rgba(0,0,0,.45)";
    ctx.stroke();

    ctx.font = "700 12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.strokeText(p.name || "…", cx, cy - CELL / 2);
    ctx.fillStyle = "#2a1d0e";
    ctx.fillText(p.name || "…", cx, cy - CELL / 2);
  }
}
