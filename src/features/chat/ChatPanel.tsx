import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { colorFor } from "../../shared/colors";
import type { ChatMsg, ChatScope, PublicUser } from "../../shared/protocol";

const TABS: [ChatScope, string][] = [
  ["private", "ส่วนตัว"],
  ["room", "ห้องนี้"],
  ["all", "ทั้งหมด"],
];

const fmtTime = (t: number) => new Date(t).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

interface ChatPanelProps {
  roomMsgs: ChatMsg[];
  allMsgs: ChatMsg[];
  privateMsgs: Record<string, ChatMsg[]>; // key = userId ของคู่สนทนา (อีกฝั่ง)
  onlineIds: string[]; // ผู้ใช้ที่ออนไลน์ (เท่าที่รับรู้ = คนในห้องเดียวกัน)
  users: PublicUser[];
  myId: string | null;
  dmRequest: { id: string; n: number } | null; // คลิกสมาชิก → ขอเปิด DM (n = nonce)
  onSend: (scope: ChatScope, text: string, to?: string) => boolean;
  onTypingChange: (typing: boolean) => void;
}

// แชต 3 ขอบเขต: ส่วนตัว (สไตล์ Google Chat: การ์ดคู่สนทนา → ห้องแชทเต็ม) / ห้องนี้ / ทั้งหมด
export default function ChatPanel({
  roomMsgs,
  allMsgs,
  privateMsgs,
  onlineIds,
  users,
  myId,
  dmRequest,
  onSend,
  onTypingChange,
}: ChatPanelProps) {
  const [tab, setTab] = useState<ChatScope>("room");
  const [text, setText] = useState("");
  const [openThread, setOpenThread] = useState<string | null>(null); // คู่สนทนาที่เปิดอยู่ (null = หน้ารายการ)
  const [unread, setUnread] = useState<Record<string, boolean>>({}); // thread ส่วนตัวที่มีข้อความใหม่ยังไม่อ่าน
  const [roomUnread, setRoomUnread] = useState(false); // แท็บ "ห้องนี้" มีข้อความใหม่
  const [allUnread, setAllUnread] = useState(false); // แท็บ "ทั้งหมด" มีข้อความใหม่

  const nameById: Record<string, string> = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const online = (id: string) => onlineIds.includes(id);
  const others = users.filter((u) => u.id !== myId);
  const lastOf = (uid: string): ChatMsg | null => {
    const t = privateMsgs[uid];
    return t && t.length ? t[t.length - 1] : null;
  };

  const seenCounts = useRef<Record<string, number>>({}); // จำนวนข้อความที่ "เห็นแล้ว" ต่อ thread (ส่วนตัว)
  const seenRoom = useRef(0); // จำนวนข้อความ "ห้องนี้" ที่เห็นแล้ว
  const seenAll = useRef(0); // จำนวนข้อความ "ทั้งหมด" ที่เห็นแล้ว

  // unread ของแท็บ ห้องนี้ / ทั้งหมด — มีข้อความใหม่ตอนไม่ได้เปิดแท็บนั้น + ไม่ใช่ของเราเอง
  useEffect(() => {
    const fresh = (list: ChatMsg[], seen: number) => {
      const last = list[list.length - 1];
      return list.length > seen && !!last && last.id !== myId;
    };
    if (tab === "room") setRoomUnread(false);
    else if (fresh(roomMsgs, seenRoom.current)) setRoomUnread(true);
    seenRoom.current = roomMsgs.length;

    if (tab === "all") setAllUnread(false);
    else if (fresh(allMsgs, seenAll.current)) setAllUnread(true);
    seenAll.current = allMsgs.length;
  }, [roomMsgs, allMsgs, tab, myId]);

  // มีข้อความใหม่เข้า thread ที่ไม่ได้เปิดอยู่ + ไม่ใช่ข้อความเราเอง → ทำเครื่องหมายยังไม่อ่าน
  useEffect(() => {
    const newly: string[] = [];
    for (const [uid, msgs] of Object.entries(privateMsgs)) {
      const prev = seenCounts.current[uid] ?? 0;
      seenCounts.current[uid] = msgs.length;
      if (msgs.length > prev) {
        const last = msgs[msgs.length - 1];
        if (last.id !== myId && openThread !== uid) newly.push(uid);
      }
    }
    if (newly.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnread((u) => {
        const next = { ...u };
        for (const id of newly) next[id] = true;
        return next;
      });
    }
  }, [privateMsgs, myId, openThread]);

  // เปิดห้องแชทกับ uid + เคลียร์ unread ของ thread นั้น
  const openDm = (uid: string) => {
    setOpenThread(uid);
    setUnread((u) => (u[uid] ? { ...u, [uid]: false } : u));
  };

  // คลิกสมาชิกจากรายชื่อ (prop ภายนอก) → เด้งมาแท็บส่วนตัว + เปิดห้องแชทกับคนนั้น
  useEffect(() => {
    if (!dmRequest) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab("private");
    setOpenThread(dmRequest.id);
    setUnread((u) => (u[dmRequest.id] ? { ...u, [dmRequest.id]: false } : u));
  }, [dmRequest]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const to = tab === "private" ? openThread ?? undefined : undefined;
    if (tab === "private" && !to) return;
    if (onSend(tab, text, to)) setText("");
  }

  const hasUnread = Object.values(unread).some(Boolean);
  const tabUnread: Record<ChatScope, boolean> = { private: hasUnread, room: roomUnread, all: allUnread };

  // =========================
  // แท็บส่วนตัว — หน้ารายการการ์ดคู่สนทนา
  // =========================
  function renderDmList() {
    // เรียง: thread ที่มีข้อความล่าสุดก่อน, ตามด้วยคนที่ยังไม่เคยคุย (ออนไลน์ก่อน → ชื่อ)
    const sorted = [...others].sort((a, b) => {
      const la = lastOf(a.id);
      const lb = lastOf(b.id);
      if (la && lb) return lb.t - la.t;
      if (la) return -1;
      if (lb) return 1;
      if (online(a.id) !== online(b.id)) return online(a.id) ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div className="dm-list">
        {sorted.length === 0 && <div className="muted-sm">ยังไม่มีสมาชิกคนอื่น</div>}
        {sorted.map((u) => {
          const last = lastOf(u.id);
          const isUnread = !!unread[u.id];
          return (
            <button key={u.id} className={"dm-card" + (isUnread ? " unread" : "")} onClick={() => openDm(u.id)}>
              <span className="dm-avatar" style={{ background: colorFor(u.id) }}>
                {(u.name[0] || "?").toUpperCase()}
                <span className={"dm-presence" + (online(u.id) ? " online" : "")} />
              </span>
              <span className="dm-card-main">
                <span className="dm-card-top">
                  <span className="dm-card-name">{u.name}</span>
                  {last && <span className="dm-card-time">{fmtTime(last.t)}</span>}
                </span>
                <span className="dm-card-last">
                  {last ? (last.id === myId ? "คุณ: " : "") + last.text : "เริ่มแชต"}
                </span>
              </span>
              {isUnread && <span className="dm-unread-dot" />}
            </button>
          );
        })}
      </div>
    );
  }

  // =========================
  // แสดงรายการข้อความ (room / all / conversation)
  // =========================
  function renderMessages(list: ChatMsg[]) {
    return (
      <div className="messages">
        {list.map((m, i) => {
          const mine = m.id === myId;
          return (
            <div className={"msg-item" + (mine ? " mine" : "")} key={i}>
              <div className="msg-head">
                <span className="msg-name" style={{ color: mine ? "var(--teal)" : colorFor(m.id) }}>
                  {mine ? "คุณ" : m.name || nameById[m.id] || "ไม่มีชื่อ"}
                </span>
                <span className="msg-time">{fmtTime(m.t)}</span>
              </div>
              <div className="msg-text">{m.text}</div>
            </div>
          );
        })}
      </div>
    );
  }

  // เนื้อหา + ช่องพิมพ์ตามแท็บ/สถานะ
  const inDmList = tab === "private" && !openThread;
  const showInput = !inDmList;
  const partnerName = openThread ? nameById[openThread] ?? "ผู้ใช้" : "";

  return (
    <div className="panel chat">
      <div className="chat-tabs">
        {TABS.map(([v, l]) => (
          <button key={v} className={"chat-tab" + (tab === v ? " active" : "")} onClick={() => setTab(v)}>
            {l}
            {v !== tab && tabUnread[v] && <span className="tab-dot" />}
          </button>
        ))}
      </div>

      {tab === "private" && openThread && (
        <div className="dm-conv-head">
          <button className="dm-back" onClick={() => setOpenThread(null)} aria-label="กลับ">
            ‹
          </button>
          <span className="dm-avatar sm" style={{ background: colorFor(openThread) }}>
            {(partnerName[0] || "?").toUpperCase()}
            <span className={"dm-presence" + (online(openThread) ? " online" : "")} />
          </span>
          <span className="dm-conv-info">
            <span className="dm-conv-name">{partnerName}</span>
            <span className={"dm-conv-status" + (online(openThread) ? " online" : "")}>
              {online(openThread) ? "ออนไลน์" : "ออฟไลน์"}
            </span>
          </span>
        </div>
      )}

      {inDmList
        ? renderDmList()
        : renderMessages(tab === "all" ? allMsgs : tab === "private" ? privateMsgs[openThread!] ?? [] : roomMsgs)}

      {showInput && (
        <form className="chat-form" onSubmit={submit}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => onTypingChange(true)}
            onBlur={() => onTypingChange(false)}
            placeholder={tab === "private" ? `ส่งหา ${partnerName}…` : "พิมพ์ข้อความ…"}
          />
          <button className="send-btn" type="submit" aria-label="ส่ง">
            <svg viewBox="0 0 24 24">
              <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}
