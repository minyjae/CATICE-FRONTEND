// Sprite presets — แต่ละ preset ใช้ไฟล์ PNG แยกต่อเฟรม (Kenney-style)
// getMySprite/saveMySprite เก็บ preference ไว้ใน localStorage ข้ามเซสชัน

export type { SpriteKey } from "../../../shared/protocol";
import type { SpriteKey } from "../../../shared/protocol";
export type AnimName = "idle" | "run";

export interface SpriteAnim {
  fps: number;
  frames: readonly string[];
}

export interface SpritePreset {
  label: string;
  anims: Record<AnimName, SpriteAnim>;
}

export const SPRITE_PRESETS: Record<SpriteKey, SpritePreset> = {
  player: {
    label: "Player",
    anims: {
      idle: { fps: 1, frames: ["/sprites/player_idle.png"] },
      run:  { fps: 8, frames: ["/sprites/player_walk1.png", "/sprites/player_walk2.png"] },
    },
  },
  adventurer: {
    label: "Adventurer",
    anims: {
      idle: { fps: 1, frames: ["/sprites/adventurer_idle.png"] },
      run:  { fps: 8, frames: ["/sprites/adventurer_walk1.png", "/sprites/adventurer_walk2.png"] },
    },
  },
  soldier: {
    label: "Soldier",
    anims: {
      idle: { fps: 1, frames: ["/sprites/soldier_idle.png"] },
      run:  { fps: 8, frames: ["/sprites/soldier_walk1.png", "/sprites/soldier_walk2.png"] },
    },
  },
  // cat ใช้ directional animation system แยก (CAT_FRAMES)
  // anims ที่นี่ใช้แค่ SpritePicker preview เท่านั้น
  cat: {
    label: "Cat",
    anims: {
      idle: { fps: 1, frames: ["/sprites/cat_idle/cat_idle_front.png"] },
      run:  { fps: 8, frames: ["/sprites/cat_walk_down/cat_walk_down_1.png", "/sprites/cat_walk_down/cat_walk_down_2.png"] },
    },
  },
};

export const SPRITE_KEYS: SpriteKey[] = ["player", "adventurer", "soldier", "cat"];

// ค่า shared ทุก preset
export const SPRITE_CONFIG = {
  drawHeight: 46,
  pixelated: false,
  moveTimeoutMs: 180,
} as const;

const STORAGE_KEY = "catice_sprite";

export function randomSpriteKey(): SpriteKey {
  return SPRITE_KEYS[Math.floor(Math.random() * SPRITE_KEYS.length)];
}

export function getMySprite(): SpriteKey {
  const v = localStorage.getItem(STORAGE_KEY);
  return (SPRITE_KEYS.includes(v as SpriteKey) ? v : SPRITE_KEYS[0]) as SpriteKey;
}

export function saveMySprite(key: SpriteKey): void {
  localStorage.setItem(STORAGE_KEY, key);
}

// ----- Cat directional animation system -----

export type CatAnimKey =
  | "idle_front" | "idle_back" | "idle_left" | "idle_right"
  | "walk_down" | "walk_up" | "walk_left" | "walk_right"
  | "sit";

export const CAT_FRAMES: Record<CatAnimKey, { fps: number; frames: readonly string[] }> = {
  idle_front: { fps: 1, frames: ["/sprites/cat_idle/cat_idle_front.png"] },
  idle_back:  { fps: 1, frames: ["/sprites/cat_idle/cat_idle_back.png"] },
  idle_left:  { fps: 1, frames: ["/sprites/cat_idle/cat_idle_left.png"] },
  idle_right: { fps: 1, frames: ["/sprites/cat_idle/cat_idle_right.png"] },
  sit:        { fps: 2, frames: ["/sprites/cat_sit/cat_idle_sit.png"] },
  walk_down:  { fps: 8, frames: [
    "/sprites/cat_walk_down/cat_walk_down_1.png",
    "/sprites/cat_walk_down/cat_walk_down_2.png",
    "/sprites/cat_walk_down/cat_walk_down_3.png",
    "/sprites/cat_walk_down/cat_walk_down_4.png",
  ]},
  walk_up:    { fps: 8, frames: [
    "/sprites/cat_walk_up/cat_walk_up_1.png",
    "/sprites/cat_walk_up/cat_walk_up_2.png",
    "/sprites/cat_walk_up/cat_walk_up_3.png",
    "/sprites/cat_walk_up/cat_walk_up_4.png",
  ]},
  walk_left:  { fps: 8, frames: [
    "/sprites/cat_walk_left/cat_walk_left_1.png",
    "/sprites/cat_walk_left/cat_walk_left_2.png",
  ]},
  walk_right: { fps: 8, frames: [
    "/sprites/cat_walk_right/cat_walk_right_1.png",
    "/sprites/cat_walk_right/cat_walk_right_2.png",
  ]},
};

export const CAT_SIT_TIMEOUT_MS = 10_000;
