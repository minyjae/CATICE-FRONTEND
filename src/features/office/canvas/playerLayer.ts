// เลเยอร์ผู้เล่นด้วย PixiJS — วาด avatar เป็น sprite animation บน canvas โปร่งใส
// ที่ซ้อนทับ canvas ห้อง (2D) แบบ pixel-perfect. เป็น factory ล้วน ๆ ไม่พึ่ง React
// (รูปแบบเดียวกับ createVideoController) ให้ lifecycle ของ Pixi คุมง่าย
import { Application, Assets, AnimatedSprite, Texture, Text } from "pixi.js";
import type { Player } from "../../../shared/protocol";
import { CELL, CANVAS_W, CANVAS_H } from "../constants";
import { SPRITE, type AnimName } from "./spriteConfig";

interface Entry {
  sprite: AnimatedSprite;
  label: Text;
  prevX: number;
  prevY: number;
  facing: 1 | -1; // 1 = ขวา (ภาพต้นฉบับ), -1 = ซ้าย (พลิกแนวนอน)
  lastMove: number; // performance.now() ครั้งล่าสุดที่ขยับ
  anim: AnimName;
  targetX: number; // พิกัด px เป้าหมาย (กึ่งกลาง cell) → lerp เข้าหา
  targetY: number;
}

const ANIM_NAMES = Object.keys(SPRITE.anims) as AnimName[];

const cellCenterX = (x: number) => x * CELL + CELL / 2;
const cellCenterY = (y: number) => y * CELL + CELL / 2;

function makeLabel(name: string): Text {
  return new Text({
    text: name || "…",
    style: {
      fontFamily: "Inter, sans-serif",
      fontSize: 12,
      fontWeight: "700",
      fill: "#2a1d0e",
      stroke: { color: "rgba(255,255,255,.85)", width: 3 },
      align: "center",
    },
  });
}

export function createPlayerLayer(canvas: HTMLCanvasElement) {
  const app = new Application();
  const entries = new Map<string, Entry>();
  let textures: Record<AnimName, Texture[]> | null = null;
  let baseScale = 1; // scale ให้ตัวละครสูง = SPRITE.drawHeight
  let ready = false;
  let destroyed = false;

  (async () => {
    await app.init({
      canvas,
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundAlpha: 0,
      antialias: false,
    });

    // โหลดไฟล์ PNG แยกของแต่ละเฟรม (ทุก anim รวมกันทีเดียว)
    const out = {} as Record<AnimName, Texture[]>;
    try {
      for (const name of ANIM_NAMES) {
        out[name] = (await Promise.all(SPRITE.anims[name].frames.map((f) => Assets.load(f)))) as Texture[];
      }
    } catch {
      // ยังไม่มีไฟล์ sprite → ไม่ render avatar (กัน unhandled rejection)
      console.warn("[playerLayer] โหลดไฟล์ sprite ไม่ได้ — วาง player_idle.png / player_walk1.png / player_walk2.png ที่ public/sprites/");
      return;
    }

    if (SPRITE.pixelated) {
      for (const arr of Object.values(out)) for (const t of arr) t.source.scaleMode = "nearest";
    }
    textures = out;
    baseScale = SPRITE.drawHeight / out.idle[0].height; // คุมขนาดจากเฟรม idle

    // ถ้าโดน destroy ระหว่างรอ init/load → เก็บกวาดทันที
    if (destroyed) {
      app.destroy({ removeView: false }, { children: true });
      return;
    }
    ready = true;
  })();

  function createEntry(p: Player): Entry {
    const sprite = new AnimatedSprite(textures!.idle);
    sprite.anchor.set(0.5, 0.9); // เท้าอยู่ใกล้กึ่งกลาง cell
    sprite.animationSpeed = SPRITE.anims.idle.fps / 60;
    sprite.scale.set(baseScale);
    sprite.x = cellCenterX(p.x);
    sprite.y = cellCenterY(p.y);
    sprite.play();

    const label = makeLabel(p.name);
    label.anchor.set(0.5, 1);

    app.stage.addChild(sprite, label);

    return {
      sprite,
      label,
      prevX: p.x,
      prevY: p.y,
      facing: 1,
      lastMove: 0,
      anim: "idle",
      targetX: cellCenterX(p.x),
      targetY: cellCenterY(p.y),
    };
  }

  function setAnim(e: Entry, name: AnimName) {
    if (e.anim === name || !textures) return;
    e.anim = name;
    e.sprite.textures = textures[name];
    e.sprite.animationSpeed = SPRITE.anims[name].fps / 60;
    e.sprite.play();
  }

  // เรียกทุกเฟรมจาก render loop ของ useRoom
  function update(players: Record<string, Player>, myId: string | null) {
    if (!ready) return;
    const now = performance.now();

    // ลบ sprite ของคนที่ไม่อยู่แล้ว (leave / สลับห้อง)
    for (const id of entries.keys()) {
      if (!players[id]) {
        const e = entries.get(id)!;
        e.sprite.destroy();
        e.label.destroy();
        entries.delete(id);
      }
    }

    for (const id in players) {
      const p = players[id];
      let e = entries.get(id);
      if (!e) {
        e = createEntry(p);
        // ไฮไลต์ avatar ตัวเอง (เทียบ border ขาวของวงกลมเดิม)
        e.sprite.tint = id === myId ? 0xfff2c4 : 0xffffff;
        entries.set(id, e);
      }

      // ตรวจการขยับจาก delta ตำแหน่ง (ใช้ได้กับทั้งตัวเอง + คนอื่น ไม่ต้องแก้ protocol)
      if (p.x !== e.prevX || p.y !== e.prevY) {
        const jump = Math.abs(p.x - e.prevX) + Math.abs(p.y - e.prevY);
        if (p.x !== e.prevX) e.facing = p.x > e.prevX ? 1 : -1; // ขยับแนวตั้งคงทิศเดิม
        e.lastMove = now;
        e.prevX = p.x;
        e.prevY = p.y;
        e.targetX = cellCenterX(p.x);
        e.targetY = cellCenterY(p.y);
        // เดินปกติทีละ 1 ช่อง → ถ้ากระโดดไกล (เปลี่ยนห้อง/spawn) ให้ snap ทันที ไม่ลาก
        if (jump > 1) {
          e.sprite.x = e.targetX;
          e.sprite.y = e.targetY;
        }
      }

      setAnim(e, now - e.lastMove < SPRITE.moveTimeoutMs ? "run" : "idle");
      e.sprite.scale.x = baseScale * e.facing; // พลิกซ้าย/ขวา

      // เดินนุ่ม ๆ: lerp เข้าหา cell เป้าหมาย แทนที่จะวาร์ป
      e.sprite.x += (e.targetX - e.sprite.x) * 0.25;
      e.sprite.y += (e.targetY - e.sprite.y) * 0.25;

      e.label.x = e.sprite.x;
      e.label.y = e.sprite.y - e.sprite.height * 0.9 - 2; // เหนือหัว (height = สูงจริง × scale)
    }
  }

  function destroy() {
    destroyed = true;
    if (ready) app.destroy({ removeView: false }, { children: true });
  }

  return { update, destroy };
}
