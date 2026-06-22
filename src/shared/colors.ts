// แปลง id → สีคงที่ (id เดียวกันได้สีเดิมเสมอ) ใช้ร่วมกันทั้งการวาดผู้เล่นและชื่อในแชต
export function colorFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 65%, 55%)`;
}
