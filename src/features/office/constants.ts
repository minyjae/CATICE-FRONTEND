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
];
export const ROOM_LABEL: Record<string, string> = Object.fromEntries(ROOMS);

// ประตู: เดินเข้าโซนนี้ (พิกัดเป็น "ช่อง") แล้วย้ายไปห้อง to ที่ตำแหน่ง spawn
export interface Door {
  x: number;
  y1: number;
  y2: number;
  to: RoomName;
  spawn: Cell;
}

// ประตูของแต่ละห้อง — พิกัดต้องตรงกับ box ประตูที่วาดใน canvas/room.ts
export const DOORS: Partial<Record<RoomName, Door[]>> = {
  lobby: [
    {
      x: 0,
      y1: 9,
      y2: 10,
      to: "meeting_room",

      spawn: {
        x: 22,
        y: 9,
      },
    },

    {
      x: 23,
      y1: 9,
      y2: 10,
      to: "office",

      spawn: {
        x: 1,
        y: 9,
      },
    },
  ],

  meeting_room: [
    {
      x: 23,
      y1: 9,
      y2: 10,
      to: "lobby",

      spawn: {
        x: 1,
        y: 9,
      },
    },
  ],

  office: [
    {
      x: 0,
      y1: 9,
      y2: 10,
      to: "lobby",

      spawn: {
        x: 22,
        y: 9,
      },
    },
  ],
};

// คืน door ถ้าช่อง (x,y) ในห้อง room อยู่ในโซนประตู, ไม่ใช่คืน null
export function doorAt(room: RoomName, x: number, y: number): Door | null {
  return (DOORS[room] ?? []).find((d) => x === d.x && y >= d.y1 && y <= d.y2) ?? null;
}

// ตำแหน่งเกิดเมื่อเข้าห้อง = ยืน "หน้าประตู" ของห้องนั้น (ช่องถัดเข้ามาจากประตู)
export const SPAWN: Partial<Record<RoomName, Cell>> = {
  lobby: { x: 11, y: 12 },
};
