// ค่าคงที่ของห้อง/กริด — แชร์กันระหว่างการเดิน (movement), การวาด (canvas) และ proximity
export const CELL = 32;            // ขนาด 1 ช่อง (px)
export const GRID_W = 24;          // 768 / 32
export const GRID_H = 16;          // 512 / 32
export const WALL_ROWS = 1;        // แถวบนสุดเป็นผนัง เดินเข้าไม่ได้
export const PROXIMITY = 3;        // ระยะ (ช่อง) ที่ถือว่า "ใกล้" → เปิดวิดีโอ

export const CANVAS_W = GRID_W * CELL; // 768
export const CANVAS_H = GRID_H * CELL; // 512

// ห้องทั้งหมดที่เลือกได้ (key = ค่าที่ส่งใน ?room= ให้ backend) — ใช้ทำ dropdown + ป้ายชื่อ
export const ROOMS = [
  ["lobby", "Lobby"],
  ["meeting_room", "Meeting Room"],
  ["office", "Office"],
  ["lounge", "Lounge"],
];
export const ROOM_LABEL = Object.fromEntries(ROOMS);

// ประตูของแต่ละห้อง: เดินเข้าโซนนี้ (พิกัดเป็น "ช่อง") แล้วย้ายไปห้อง to
// พิกัดต้องตรงกับ box ประตูที่วาดใน canvas/room.js
export const DOORS = {
  lobby: [{ x: 0, y1: 9, y2: 10, to: "meeting_room" }],   // ขอบซ้าย → ห้องประชุม
  meeting_room: [{ x: 23, y1: 9, y2: 10, to: "lobby" }],  // ขอบขวา → กลับ lobby
};

// คืน door ถ้าช่อง (x,y) ในห้อง room อยู่ในโซนประตู, ไม่ใช่คืน null
export function doorAt(room, x, y) {
  return (DOORS[room] ?? []).find((d) => x === d.x && y >= d.y1 && y <= d.y2) ?? null;
}

// ตำแหน่งเกิดเมื่อเข้าห้อง = ยืน "หน้าประตู" ของห้องนั้น (ช่องถัดเข้ามาจากประตู)
export const SPAWN = {
  lobby: { x: 1, y: 9 },         // หน้าประตูซ้าย
  meeting_room: { x: 22, y: 9 }, // หน้าประตูขวา
};
