import { useState } from "react";
import { SPRITE_KEYS, SPRITE_PRESETS, getMySprite } from "./canvas/spriteConfig";
import type { SpriteKey } from "./canvas/spriteConfig";

interface SpritePickerProps {
  onSelect: (key: SpriteKey) => void;
  onClose: () => void;
}

export default function SpritePicker({ onSelect, onClose }: SpritePickerProps) {
  const [selected, setSelected] = useState<SpriteKey>(getMySprite());

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box sprite-picker-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">🎭 เลือกตัวละคร</div>
        <div className="sprite-picker-grid">
          {SPRITE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={"sprite-option" + (selected === key ? " active" : "")}
              onClick={() => setSelected(key)}
            >
              <img
                src={SPRITE_PRESETS[key].anims.idle.frames[0]}
                alt={SPRITE_PRESETS[key].label}
                className="sprite-preview"
              />
              <span>{SPRITE_PRESETS[key].label}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>ยกเลิก</button>
          <button
            type="button"
            className="submit"
            style={{ marginTop: 0 }}
            onClick={() => { onSelect(selected); onClose(); }}
          >
            เลือก
          </button>
        </div>
      </div>
    </div>
  );
}
