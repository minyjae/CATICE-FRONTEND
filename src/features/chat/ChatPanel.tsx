import { useState } from "react";
import type { FormEvent } from "react";
import { colorFor } from "../../shared/colors";
import type { ChatMsg } from "../../shared/protocol";

const TABS = [
  ["private", "ส่วนตัว"],
  ["room", "ห้องนี้"],
  ["all", "ทั้งหมด"],
] as const;

interface ChatPanelProps {
  messages: ChatMsg[];
  myId: string | null;
  onSend: (text: string) => boolean;
  onTypingChange: (typing: boolean) => void;
}

// แชตของห้อง
//   messages       — [{ id, name, text, t }]
//   myId           — id ตัวเอง (ใช้แยกข้อความ "คุณ")
//   onSend(text)   — ส่งข้อความ คืน true ถ้าส่งจริง (เพื่อเคลียร์ช่องพิมพ์)
//   onTypingChange — บอก parent ว่ากำลังพิมพ์อยู่ไหม (กันลูกศรไปเดินตอนพิมพ์)
export default function ChatPanel({ messages, myId, onSend, onTypingChange }: ChatPanelProps) {
  const [tab, setTab] = useState("room");
  const [text, setText] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (onSend(text)) setText("");
  }

  return (
    <div className="panel chat">
      <div className="chat-tabs">
        {TABS.map(([v, l]) => (
          <button key={v} className={"chat-tab" + (tab === v ? " active" : "")} onClick={() => setTab(v)}>
            {l}
          </button>
        ))}
      </div>
      <div className="messages">
        {messages.map((m, i) => {
          const mine = m.id === myId;
          return (
            <div className="msg-item" key={i}>
              <div className="msg-head">
                <span className="msg-name" style={{ color: mine ? "var(--teal)" : colorFor(m.id) }}>
                  {mine ? "คุณ" : m.name || "ไม่มีชื่อ"}
                </span>
                <span className="msg-time">
                  {new Date(m.t).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="msg-text">{m.text}</div>
            </div>
          );
        })}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => onTypingChange(true)}
          onBlur={() => onTypingChange(false)}
          placeholder="พิมพ์ข้อความ…"
        />
        <button className="send-btn" type="submit" aria-label="ส่ง">
          <svg viewBox="0 0 24 24">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
