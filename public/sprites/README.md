# public/sprites/

วางไฟล์ภาพตัวละครที่นี่ — ใช้ไฟล์ PNG แยกต่อท่า (สไตล์ Kenney) พื้นหลังโปร่งใส

โค้ดที่ใช้: [playerLayer.ts](../../src/features/office/canvas/playerLayer.ts)
+ config: [spriteConfig.ts](../../src/features/office/canvas/spriteConfig.ts)

## ไฟล์ที่ต้องมี (ตอนนี้)

| ใช้เป็น | ไฟล์ |
| --- | --- |
| idle (ยืน) | `player_idle.png` |
| run (เดิน) | `player_walk1.png`, `player_walk2.png` |

ชื่อต้องตรงเป๊ะ (แก้ได้ใน `SPRITE.anims` ของ [spriteConfig.ts](../../src/features/office/canvas/spriteConfig.ts))

## ปรับแต่ง

- ขนาดตัวละคร: `SPRITE.drawHeight` (px) — คำนวณ scale ให้อัตโนมัติจากความสูงภาพจริง
- ภาพแบบ Kenney เป็น smooth → `SPRITE.pixelated = false`; ถ้าเป็น pixel art ตั้ง `true` ให้คม
- หันขวาเป็นค่าตั้งต้น โค้ดพลิกซ้ายให้เอง (เดินขึ้น/ลงคงทิศแนวนอนเดิม)

## อยากเพิ่มท่า/ลื่นขึ้น

asset ชุดนี้มีหลายท่า (walk มีแค่ 2 เฟรม) — เพิ่มเฟรม idle ให้มีชีวิตได้ เช่น
`idle: { fps: 2, frames: ["/sprites/player_idle.png", "/sprites/player_stand.png"] }`
หรือเพิ่ม anim ใหม่ (jump/duck/...) ใน `SPRITE.anims` แล้วผูก trigger ภายหลัง
