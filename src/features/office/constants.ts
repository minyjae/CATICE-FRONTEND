// ค่าคงที่ของห้อง/กริด — แชร์กันระหว่างการเดิน (movement), การวาด (canvas) และ proximity
import type { RoomName } from "../../shared/protocol";

export const CELL = 32; // ขนาด 1 ช่อง (px)
export const GRID_W = 24; // 768 / 32
export const GRID_H = 16; // 512 / 32
export const WALL_ROWS = 1; // แถวบนสุดเป็นผนัง เดินเข้าไม่ได้
export const PROXIMITY = 2; // ระยะ (ช่อง) ที่ถือว่า "ใกล้" → เปิดวิดีโอ

export const CANVAS_W = GRID_W * CELL; // 768
export const CANVAS_H = GRID_H * CELL; // 512

// พิกัดช่องบนกริด
export interface Cell {
  x: number;
  y: number;
}

// ห้องทั้งหมดที่เลือกได้ (key = ค่าที่ส่งใน ?room= ให้ backend) — ใช้ทำ dropdown + ป้ายชื่อ
export const ROOMS: [RoomName, string][] = [
  ["lobby", "Lobby"],
  ["meeting_room", "Meeting Room"],
  ["office", "Office"],
  ["canteen", "Canteen"],
];
export const ROOM_LABEL: Record<string, string> = Object.fromEntries(ROOMS);

// ประตู: เดินเข้า "โซน" สี่เหลี่ยม (ช่วงช่อง x1..x2, y1..y2) แล้วย้ายไปห้อง to ที่ตำแหน่ง spawn
// ใช้ช่วงช่องทั้งสองแกน → รองรับทั้งประตูแนวตั้ง (ขอบซ้าย/ขวา) และแนวนอน (ขอบบน)
export interface Door {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  to: RoomName;
  spawn: Cell;
}

// ประตูของแต่ละห้อง — โซนต้องตรงกับ box ประตูที่วาดใน canvas/room.ts
export const DOORS: Partial<Record<RoomName, Door[]>> = {
  lobby: [
    { x1: 0, x2: 0, y1: 9, y2: 10, to: "meeting_room", spawn: { x: 22, y: 9 } },
    { x1: 23, x2: 23, y1: 9, y2: 10, to: "office", spawn: { x: 1, y: 9 } },
    // ประตูบนซ้าย → Canteen (แถวบนสุดที่เดินถึง y=1, คอลัมน์ 1–2)
    // → ไปโผล่ "ล่างซ้าย" ของ canteen (เหนือประตูกลับ) คอลัมน์ตรงกัน
    { x1: 1, x2: 2, y1: 1, y2: 1, to: "canteen", spawn: { x: 2, y: 14 } },
  ],

  meeting_room: [{ x1: 23, x2: 23, y1: 9, y2: 10, to: "lobby", spawn: { x: 1, y: 9 } }],

  office: [{ x1: 0, x2: 0, y1: 9, y2: 10, to: "lobby", spawn: { x: 22, y: 9 } }],

  // ประตูล่างซ้าย กลับ Lobby (แถวล่างสุด y=15, คอลัมน์ 1–2 ตรงกับประตูที่เข้ามา)
  // → ไปโผล่ใต้ประตูบนซ้ายของ lobby
  canteen: [{ x1: 1, x2: 2, y1: 15, y2: 15, to: "lobby", spawn: { x: 2, y: 2 } }],
};

// คืน door ถ้าช่อง (x,y) อยู่ในโซนประตูของห้อง room, ไม่ใช่คืน null
export function doorAt(room: RoomName, x: number, y: number): Door | null {
  return (DOORS[room] ?? []).find((d) => x >= d.x1 && x <= d.x2 && y >= d.y1 && y <= d.y2) ?? null;
}

// =========================
// COLLISION — เฟอร์นิเจอร์/วัตถุที่เดินทับไม่ได้ (เหมือนผนัง)
// =========================
// นิยามเป็น "กรอบพิกเซล" { x, y, w, h } ก๊อปจาก box() ที่วาดใน canvas/room.ts โดยตรง
// → เลขตรงกับภาพที่เห็น ไม่ต้องแปลง grid เอง (แก้ภาพแล้วมาแก้ตรงนี้ให้ตรงกัน)
export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const OBSTACLES_PX: Partial<Record<RoomName, PxRect[]>> = {
  lobby: [
    { x: 220, y: 70, w: 260, h: 56 }, // coffee bar
    { x: 40, y: 400, w: 40, h: 40 }, // plant ซ้าย
    { x: 690, y: 400, w: 40, h: 40 }, // plant ขวา
  ],

  meeting_room: [
    { x: 234, y: 200, w: 300, h: 150 }, // โต๊ะประชุมกลาง
    { x: 24, y: 120, w: 18, h: 80 }, // จอติดผนังซ้าย
  ],

  office: [
    // 4 คลัสเตอร์โต๊ะ (โต๊ะ 2 คอลัมน์ต่อคลัสเตอร์ เว้นช่องเดิน)
    { x: 70, y: 100, w: 120, h: 120 },
    { x: 210, y: 100, w: 120, h: 120 },
    { x: 400, y: 100, w: 120, h: 120 },
    { x: 540, y: 100, w: 120, h: 120 },
    { x: 70, y: 280, w: 120, h: 120 },
    { x: 210, y: 280, w: 120, h: 120 },
    { x: 400, y: 280, w: 120, h: 120 },
    { x: 540, y: 280, w: 120, h: 120 },
    { x: 20, y: 110, w: 30, h: 120 }, // server rack
    { x: 22, y: 442, w: 36, h: 46 }, // plant ซ้ายล่าง
    { x: 722, y: 442, w: 36, h: 46 }, // plant ขวาล่าง
  ],

  canteen: [
    { x: 120, y: 84, w: 528, h: 52 }, // buffet counter
    // โต๊ะกลม 6 ตัว (กรอบรอบโต๊ะ ไม่รวมเก้าอี้)
    { x: 144, y: 204, w: 52, h: 52 },
    { x: 354, y: 204, w: 52, h: 52 },
    { x: 564, y: 204, w: 52, h: 52 },
    { x: 144, y: 354, w: 52, h: 52 },
    { x: 354, y: 354, w: 52, h: 52 },
    { x: 564, y: 354, w: 52, h: 52 },
    { x: 698, y: 90, w: 46, h: 80 }, // ตู้กดน้ำ
    { x: 136, y: 442, w: 28, h: 44 }, // plant ซ้าย
    { x: 714, y: 442, w: 28, h: 44 }, // plant ขวา
  ],
};

// เดินเข้าช่อง (cx,cy) ได้ไหม — บล็อกถ้า "จุดกึ่งกลางช่อง" ตกในกรอบเฟอร์นิเจอร์ใด ๆ
export function blockedAt(room: RoomName, cx: number, cy: number): boolean {
  const px = cx * CELL + CELL / 2;
  const py = cy * CELL + CELL / 2;
  return (OBSTACLES_PX[room] ?? []).some((o) => px >= o.x && px < o.x + o.w && py >= o.y && py < o.y + o.h);
}

// ตำแหน่งเกิดเมื่อเข้าห้อง = ยืน "หน้าประตู" ของห้องนั้น (ช่องถัดเข้ามาจากประตู)
export const SPAWN: Partial<Record<RoomName, Cell>> = {
  lobby: { x: 11, y: 12 },
};
