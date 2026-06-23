import { GRID_W, GRID_H } from "./constants";
import type { Cell } from "./constants";

// ทิศของแต่ละปุ่มลูกศร → [dx, dy]
const STEP: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

// คำนวณช่องถัดไปจากปุ่มที่กด — clamp แค่ "ขอบจอ" (ไม่บล็อกผนังที่นี่)
// การบล็อกผนัง/เฟอร์นิเจอร์ + ยกเว้นประตู ทำที่ onKey (useRoom) เพราะประตูบางบานอยู่ "ในผนัง"
// คืน { x, y } ถ้าขยับได้จริง, คืน null ถ้าไม่ใช่ปุ่มลูกศรหรือชนขอบจอ (ไม่ขยับ)
export function nextCell(player: Cell, key: string): Cell | null {
  const step = STEP[key];
  if (!step) return null;
  const x = Math.max(0, Math.min(GRID_W - 1, player.x + step[0]));
  const y = Math.max(0, Math.min(GRID_H - 1, player.y + step[1]));
  if (x === player.x && y === player.y) return null;
  return { x, y };
}
