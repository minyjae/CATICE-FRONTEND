// เลเยอร์ผู้เล่นด้วย PixiJS — วาด avatar เป็น sprite animation บน canvas โปร่งใส
// ที่ซ้อนทับ canvas ห้อง (2D) แบบ pixel-perfect. เป็น factory ล้วน ๆ ไม่พึ่ง React
import { Application, Assets, AnimatedSprite, Texture, Text } from "pixi.js";
import type { Player } from "../../../shared/protocol";
import { CELL, CANVAS_W, CANVAS_H } from "../constants";
import {
  SPRITE_PRESETS, SPRITE_KEYS, SPRITE_CONFIG,
  getMySprite, saveMySprite,
  CAT_FRAMES, CAT_SIT_TIMEOUT_MS,
  type SpriteKey, type AnimName, type CatAnimKey,
} from "./spriteConfig";

type Direction = "down" | "up" | "left" | "right";

interface Entry {
  sprite: AnimatedSprite;
  label: Text;
  spriteKey: SpriteKey;
  prevX: number;
  prevY: number;
  facing: 1 | -1;
  direction: Direction;
  lastMove: number;
  anim: AnimName | CatAnimKey;
  targetX: number;
  targetY: number;
}

type AllTextures = Record<Exclude<SpriteKey, "cat">, Record<AnimName, Texture[]>>;
type CatTextures = Record<CatAnimKey, Texture[]>;

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

// Cat directional idle mapping
const IDLE_DIR_MAP: Record<Direction, CatAnimKey> = {
  down: "idle_front", up: "idle_back", left: "idle_left", right: "idle_right",
};

function getCatAnimKey(e: Entry, now: number): CatAnimKey {
  const elapsed = now - e.lastMove;
  if (elapsed > CAT_SIT_TIMEOUT_MS) return "sit";
  if (elapsed < SPRITE_CONFIG.moveTimeoutMs) return `walk_${e.direction}` as CatAnimKey;
  return IDLE_DIR_MAP[e.direction];
}

interface PlayerLayerOpts {
  onPlayerClick?: (id: string) => void;
}

export function createPlayerLayer(canvas: HTMLCanvasElement, opts: PlayerLayerOpts = {}) {
  const app = new Application();
  const entries = new Map<string, Entry>();
  let allTextures: AllTextures | null = null;
  let catTextures: CatTextures | null = null;
  let baseScale = 1;
  let catScale = 1;
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

    // โหลด preset ปกติ (player/adventurer/soldier)
    const out = {} as AllTextures;
    try {
      for (const key of SPRITE_KEYS) {
        if (key === "cat") continue;
        const k = key as Exclude<SpriteKey, "cat">;
        const preset = SPRITE_PRESETS[k];
        const animOut = {} as Record<AnimName, Texture[]>;
        for (const animName of (["idle", "run"] as AnimName[])) {
          animOut[animName] = (await Promise.all(
            preset.anims[animName].frames.map((f: string) => Assets.load(f))
          )) as Texture[];
        }
        out[k] = animOut;
      }
    } catch {
      console.warn("[playerLayer] โหลด sprite ไม่ได้ — ตรวจไฟล์ใน public/sprites/");
      return;
    }

    // โหลด cat texture แยก (directional system)
    const catOut = {} as CatTextures;
    try {
      for (const [animKey, spec] of Object.entries(CAT_FRAMES) as [CatAnimKey, typeof CAT_FRAMES[CatAnimKey]][]) {
        catOut[animKey] = (await Promise.all(
          spec.frames.map((f) => Assets.load(f))
        )) as Texture[];
      }
    } catch {
      console.warn("[playerLayer] โหลด cat sprite ไม่ได้ — ตรวจไฟล์ใน public/sprites/cat_*/");
    }

    if (SPRITE_CONFIG.pixelated) {
      for (const presetTex of Object.values(out)) {
        for (const arr of Object.values(presetTex)) {
          for (const t of arr as Texture[]) t.source.scaleMode = "nearest";
        }
      }
      for (const arr of Object.values(catOut)) {
        for (const t of arr as Texture[]) t.source.scaleMode = "nearest";
      }
    }

    allTextures = out;
    catTextures = catOut;
    baseScale = SPRITE_CONFIG.drawHeight / out.player.idle[0].height;
    if (catOut.idle_front?.[0]) {
      catScale = SPRITE_CONFIG.drawHeight / catOut.idle_front[0].height;
    }

    if (destroyed) {
      app.destroy({ removeView: false }, { children: true });
      return;
    }
    ready = true;
  })();

  function getSpriteKey(p: Player): SpriteKey {
    if (p.id === myId) return getMySprite();
    return p.sprite ?? spriteKeyForOther(p.id);
  }

  function createEntry(p: Player): Entry {
    const key = getSpriteKey(p);
    const isCat = key === "cat";

    const initTextures = isCat
      ? (catTextures?.idle_front ?? allTextures!.player.idle)
      : allTextures![key as Exclude<SpriteKey, "cat">].idle;

    const sprite = new AnimatedSprite(initTextures);
    sprite.anchor.set(0.5, 0.9);
    sprite.eventMode = "static";
    sprite.cursor = "pointer";
    sprite.on("pointertap", () => opts.onPlayerClick?.(p.id));

    const fps = isCat ? CAT_FRAMES.idle_front.fps : SPRITE_PRESETS[key].anims.idle.fps;
    sprite.animationSpeed = fps / 60;
    sprite.scale.set(isCat ? catScale : baseScale);
    sprite.x = cellCenterX(p.x);
    sprite.y = cellCenterY(p.y);
    sprite.play();

    const label = makeLabel(p.name);
    label.anchor.set(0.5, 1);
    app.stage.addChild(sprite, label);

    return {
      sprite, label, spriteKey: key,
      prevX: p.x, prevY: p.y,
      facing: 1, direction: "down",
      lastMove: 0, anim: isCat ? "idle_front" : "idle",
      targetX: cellCenterX(p.x), targetY: cellCenterY(p.y),
    };
  }

  function applyAnim(e: Entry, name: AnimName) {
    if (e.anim === name || !allTextures) return;
    e.anim = name;
    const k = e.spriteKey as Exclude<SpriteKey, "cat">;
    e.sprite.textures = allTextures[k][name];
    e.sprite.animationSpeed = SPRITE_PRESETS[k].anims[name].fps / 60;
    e.sprite.play();
  }

  function applyCatAnim(e: Entry, key: CatAnimKey) {
    if (e.anim === key || !catTextures) return;
    e.anim = key;
    e.sprite.textures = catTextures[key];
    e.sprite.animationSpeed = CAT_FRAMES[key].fps / 60;
    e.sprite.play();
  }

  function resetEntryToSprite(e: Entry, key: SpriteKey) {
    e.spriteKey = key;
    if (key === "cat") {
      e.anim = "idle_front";
      e.direction = "down";
      if (catTextures) {
        e.sprite.textures = catTextures.idle_front;
        e.sprite.animationSpeed = CAT_FRAMES.idle_front.fps / 60;
        e.sprite.scale.set(catScale);
        e.sprite.play();
      }
    } else if (allTextures) {
      const k = key as Exclude<SpriteKey, "cat">;
      e.anim = "idle";
      e.sprite.textures = allTextures[k].idle;
      e.sprite.animationSpeed = SPRITE_PRESETS[k].anims.idle.fps / 60;
      e.sprite.scale.set(baseScale);
      e.sprite.play();
    }
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

      // peer เปลี่ยน sprite → re-texture entry ทันที
      const newKey = getSpriteKey(p);
      if (newKey !== e.spriteKey) {
        resetEntryToSprite(e, newKey);
      }

      if (p.x !== e.prevX || p.y !== e.prevY) {
        const jump = Math.abs(p.x - e.prevX) + Math.abs(p.y - e.prevY);
        if (p.x !== e.prevX) {
          e.facing = p.x > e.prevX ? 1 : -1;
          e.direction = p.x > e.prevX ? "right" : "left";
        } else if (p.y !== e.prevY) {
          e.direction = p.y > e.prevY ? "down" : "up";
        }
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

      if (e.spriteKey === "cat") {
        applyCatAnim(e, getCatAnimKey(e, now));
        e.sprite.scale.set(catScale); // ไม่ flip — cat มี directional sprites ในตัว
      } else {
        applyAnim(e, now - e.lastMove < SPRITE_CONFIG.moveTimeoutMs ? "run" : "idle");
        e.sprite.scale.x = baseScale * e.facing;
      }

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
    if (e) resetEntryToSprite(e, key);
  }

  function destroy() {
    destroyed = true;
    if (ready) app.destroy({ removeView: false }, { children: true });
  }

  return { update, destroy, setMySprite };
}
