import { useState, useEffect } from "react";
import { useRoom } from "./useRoom";
import { CANVAS_W, CANVAS_H, ROOMS } from "./constants";
import { ROLE_LABEL } from "../auth/roles";
import { logout as logoutRequest, fetchUsers } from "../auth/api";
import ChatPanel from "../chat/ChatPanel";
import VideoPanel from "../video/VideoPanel";
import KanbanBoard from "../kanban/KanbanBoard";
import MembersPanel from "../members/MembersPanel";
import type { Me, PublicUser, RoomName } from "../../shared/protocol";

const HELP_TEXT = "วิธีเล่น Catice2\n\n• ↑ ↓ ← →  เดิน\n• พิมพ์แชตด้านขวา\n• เดินเข้าใกล้กันเพื่อเปิดวิดีโอ";

interface OfficeProps {
  me: Me;
  onLogout: () => void;
}

// เปลือกหน้าออฟฟิศ: ต่อ realtime ทั้งหมดผ่าน useRoom แล้วประกอบ canvas + panel ต่าง ๆ
export default function Office({ me, onLogout }: OfficeProps) {
  const displayName = me.email.split("@")[0];
  const { canvasRef, room, messages, videos, status, myId, tasks, send, sendChat, setTyping, switchRoom } = useRoom({
    room: "lobby",
    displayName,
  });
  const [boardOpen, setBoardOpen] = useState(false);
  const [users, setUsers] = useState<PublicUser[]>([]); // user ที่สมัครทั้งหมด → selector มอบหมาย task

  // โหลดรายชื่อ user ครั้งเดียวตอน mount (ใช้ทำ selector บนบอร์ด)
  useEffect(() => {
    fetchUsers().then(setUsers);
  }, []);

  async function logout() {
    await logoutRequest();
    onLogout();
  }

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">🐱 Catice2</span>
        <span className="room-badge">{room}</span>
        <select className="room-select" value={room} onChange={(e) => switchRoom(e.target.value as RoomName)}>
          {ROOMS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <button className="ghost" onClick={() => setBoardOpen(true)}>
          📋 Board
        </button>
        <span className="user-chip">
          <span className="dot" />
          {displayName} · {ROLE_LABEL[me.role] || me.role}
        </span>
        <button className="ghost" onClick={logout}>
          ออกจากระบบ
        </button>
      </div>

      <div className="content">
        <div className="main">
          <div className="stage">
            <VideoPanel videos={videos} />
            <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />
            <div className="hint">↑ ↓ ← → เดิน</div>
            <div className="status">{status}</div>
          </div>
        </div>

        <div className="side">
          <MembersPanel users={users} myId={myId} />
          <ChatPanel messages={messages} myId={myId} onSend={sendChat} onTypingChange={setTyping} />
        </div>
      </div>

      <button className="help-fab" onClick={() => alert(HELP_TEXT)} title="วิธีเล่น">
        ?
      </button>

      {boardOpen && (
        <KanbanBoard tasks={tasks} users={users} send={send} myId={myId} onClose={() => setBoardOpen(false)} />
      )}
    </div>
  );
}
