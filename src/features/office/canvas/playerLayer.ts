// เลเยอร์ผู้เล่นด้วย PixiJS — วาด avatar เป็น sprite animation บน canvas โปร่งใส
// ที่ซ้อนทับ canvas ห้อง (2D) แบบ pixel-perfect. เป็น factory ล้วน ๆ ไม่พึ่ง React
import { Application, Assets, AnimatedSprite, Texture, Text } from "pixi.js";
import type { Player } from "../../../shared/protocol";
import { CELL, CANVAS_W, CANVAS_H } from "../constants";
import {
  SPRITE_PRESETS, SPRITE_KEYS, SPRITE_CONFIG,
  getMySprite, saveMySprite,
  type SpriteKey, type AnimName,
} from "./spriteConfig";

interface Entry {
  sprite: AnimatedSprite;
  label: Text;
  spriteKey: SpriteKey;
  prevX: number;
  prevY: number;
  facing: 1 | -1;
  lastMove: number;
  anim: AnimName;
  targetX: number;
  targetY: number;
}

type AllTextures = Record<SpriteKey, Record<AnimName, Texture[]>>;

const cellCenterX = (x: number) => x * CELL + CELL / 2;
const cellCenterY = (y: number) => y * CELL + CELL / 2;

// sprite ของคนอื่น: hash id → preset (deterministic, ไม่สุ่มใหม่ทุก render)
function spriteKeyForOther(id: string): SpriteKey {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return SPRITE_KEYS[hash % SPRITE_KEYS.length];
}

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

interface PlayerLayerOpts {
  onPlayerClick?: (id: string) => void;
}

export function createPlayerLayer(canvas: HTMLCanvasElement, opts: PlayerLayerOpts = {}) {
  const app = new Application();
  const entries = new Map<string, Entry>();
  let allTextures: AllTextures | null = null;
  let baseScale = 1;
  let ready = false;
  let destroyed = false;
  let myId = "";

  (async () => {
    await app.init({
      canvas,
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundAlpha: 0,
      antialias: false,
    });

    // โหลดทุก preset พร้อมกัน
    const out = {} as AllTextures;
    try {
      for (const key of SPRITE_KEYS) {
        const preset = SPRITE_PRESETS[key];
        const animOut = {} as Record<AnimName, Texture[]>;
        for (const animName of (["idle", "run"] as AnimName[])) {
          animOut[animName] = (await Promise.all(
            preset.anims[animName].frames.map((f: string) => Assets.load(f))
          )) as Texture[];
        }
        out[key] = animOut;
      }
    } catch {
      console.warn("[playerLayer] โหลด sprite ไม่ได้ — ตรวจไฟล์ใน public/sprites/");
      return;
    }

    if (SPRITE_CONFIG.pixelated) {
      for (const presetTex of Object.values(out)) {
        for (const arr of Object.values(presetTex)) {
          for (const t of arr as Texture[]) t.source.scaleMode = "nearest";
        }
      }
    }

    allTextures = out;
    // คำนวณ baseScale จาก idle frame ของ preset แรก (ทุก preset ควรใช้ขนาดเดียวกัน)
    baseScale = SPRITE_CONFIG.drawHeight / out.player.idle[0].height;

    if (destroyed) {
      app.destroy({ removeView: false }, { children: true });
      return;
    }
    ready = true;
  })();

  function getSpriteKey(id: string): SpriteKey {
    return id === myId ? getMySprite() : spriteKeyForOther(id);
  }

  function createEntry(p: Player): Entry {
    const key = getSpriteKey(p.id);
    const sprite = new AnimatedSprite(allTextures![key].idle);
    sprite.anchor.set(0.5, 0.9);
    sprite.eventMode = "static";
    sprite.cursor = "pointer";
    sprite.on("pointertap", () => opts.onPlayerClick?.(p.id));
    sprite.animationSpeed = SPRITE_PRESETS[key].anims.idle.fps / 60;
    sprite.scale.set(baseScale);
    sprite.x = cellCenterX(p.x);
    sprite.y = cellCenterY(p.y);
    sprite.play();

    const label = makeLabel(p.name);
    label.anchor.set(0.5, 1);
    app.stage.addChild(sprite, label);

    return {
      sprite, label, spriteKey: key,
      prevX: p.x, prevY: p.y,
      facing: 1, lastMove: 0, anim: "idle",
      targetX: cellCenterX(p.x), targetY: cellCenterY(p.y),
    };
  }

  function applyAnim(e: Entry, name: AnimName) {
    if (e.anim === name || !allTextures) return;
    e.anim = name;
    e.sprite.textures = allTextures[e.spriteKey][name];
    e.sprite.animationSpeed = SPRITE_PRESETS[e.spriteKey].anims[name].fps / 60;
    e.sprite.play();
  }

  function update(players: Record<string, Player>, currentMyId: string | null) {
    if (!ready) return;
    myId = currentMyId ?? "";
    const now = performance.now();

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
        e.sprite.tint = id === myId ? 0xfff2c4 : 0xffffff;
        entries.set(id, e);
      }

      if (p.x !== e.prevX || p.y !== e.prevY) {
        const jump = Math.abs(p.x - e.prevX) + Math.abs(p.y - e.prevY);
        if (p.x !== e.prevX) e.facing = p.x > e.prevX ? 1 : -1;
        e.lastMove = now;
        e.prevX = p.x;
        e.prevY = p.y;
        e.targetX = cellCenterX(p.x);
        e.targetY = cellCenterY(p.y);
        if (jump > 1) {
          e.sprite.x = e.targetX;
          e.sprite.y = e.targetY;
        }
      }

      applyAnim(e, now - e.lastMove < SPRITE_CONFIG.moveTimeoutMs ? "run" : "idle");
      e.sprite.scale.x = baseScale * e.facing;
      e.sprite.x += (e.targetX - e.sprite.x) * 0.25;
      e.sprite.y += (e.targetY - e.sprite.y) * 0.25;
      e.label.x = e.sprite.x;
      e.label.y = e.sprite.y - e.sprite.height * 0.9 - 2;
    }
  }

  // เปลี่ยน sprite ของตัวเอง — บันทึก localStorage + อัป entry ทันที
  function setMySprite(key: SpriteKey) {
    saveMySprite(key);
    const e = entries.get(myId);
    if (!e || !allTextures) return;
    e.spriteKey = key;
    e.anim = "idle"; // reset เพื่อ force applyAnim ครั้งถัดไป
    e.sprite.textures = allTextures[key].idle;
    e.sprite.animationSpeed = SPRITE_PRESETS[key].anims.idle.fps / 60;
    e.sprite.play();
  }

  function destroy() {
    destroyed = true;
    if (ready) app.destroy({ removeView: false }, { children: true });
  }

  return { update, destroy, setMySprite };
}
