import type { Role } from "../../shared/protocol";

// ตำแหน่งงานในออฟฟิศ — auth เป็นเจ้าของ concept นี้ (โดเมนอื่นเช่น office import ไปใช้)
export const ROLES: [Role, string][] = [
  ["developer", "Developer"],
  ["pm", "PM"],
  ["po", "PO"],
  ["cto", "CTO"],
  ["uxui", "UX/UI"],
];

// map code → label สำหรับแสดงผล เช่น ROLE_LABEL.developer === "Developer"
export const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES);
