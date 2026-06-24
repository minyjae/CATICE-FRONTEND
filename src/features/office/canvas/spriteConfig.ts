// Sprite presets — แต่ละ preset ใช้ไฟล์ PNG แยกต่อเฟรม (Kenney-style)
// getMySprite/saveMySprite เก็บ preference ไว้ใน localStorage ข้ามเซสชัน

export type SpriteKey = "player" | "adventurer" | "soldier";
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
};

export const SPRITE_KEYS: SpriteKey[] = ["player", "adventurer", "soldier"];

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
