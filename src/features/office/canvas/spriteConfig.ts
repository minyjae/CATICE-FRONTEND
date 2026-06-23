// คำอธิบาย sprite ตัวละคร — โหลดไฟล์ PNG แยกต่อเฟรม (สไตล์ Kenney)
// แต่ละ animation = ลิสต์ path ของเฟรม เรียงตามลำดับการเล่น
// asset แบบนี้เป็นภาพใหญ่ smooth (ไม่ใช่ pixel art) → คำนวณ scale จาก drawHeight ให้อัตโนมัติ
export const SPRITE = {
  // ความสูงตัวละครบน canvas (px) → scale = drawHeight / ความสูงจริงของภาพ
  drawHeight: 46,
  // ภาพ Kenney เป็น smooth → ไม่ต้อง nearest (true เฉพาะ pixel art)
  pixelated: false,
  // ยังถือว่า "กำลังเดิน" ภายในกี่ ms หลังขยับครั้งล่าสุด → เล่น RUN
  moveTimeoutMs: 180,
  anims: {
    idle: { fps: 1, frames: ["/sprites/player_idle.png"] },
    run: { fps: 8, frames: ["/sprites/player_walk1.png", "/sprites/player_walk2.png"] },
  },
} as const;

export type AnimName = keyof typeof SPRITE.anims;
