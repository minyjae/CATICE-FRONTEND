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

interface OfficeProps {
  me: Me;
  onLogout: () => void;
}

// เปลือกหน้าออฟฟิศ: ต่อ realtime ทั้งหมดผ่าน useRoom แล้วประกอบ canvas + panel ต่าง ๆ
export default function Office({ me, onLogout }: OfficeProps) {
  const displayName = me.email.split("@")[0];
  const { canvasRef, pixiCanvasRef, room, roomMsgs, allMsgs, privateMsgs, onlineIds, videos, status, myId, boards, tasks, send, sendChat, setTyping, switchRoom } =
    useRoom({
      room: "lobby",
      displayName,
    });
  const [boardOpen, setBoardOpen] = useState(false);
  const [users, setUsers] = useState<PublicUser[]>([]); // user ที่สมัครทั้งหมด → selector มอบหมาย task + แชตส่วนตัว
  // คลิกสมาชิก → ขอเปิดแท็บแชตส่วนตัวกับคนนั้น (n = nonce ให้เปิดซ้ำคนเดิมได้)
  const [dmRequest, setDmRequest] = useState<{ id: string; n: number } | null>(null);
  const openDm = (id: string) => setDmRequest((r) => ({ id, n: (r?.n ?? 0) + 1 }));

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
        <span className="brand">🐱 Catice</span>
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
            <div className="stage-canvas" style={{ width: CANVAS_W, height: CANVAS_H }}>
              <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />
              <canvas ref={pixiCanvasRef} width={CANVAS_W} height={CANVAS_H} className="player-layer" />
            </div>
            <div className="hint">↑ ↓ ← → เดิน</div>
            <div className="status">{status}</div>
          </div>
        </div>

        <div className="side">
          <MembersPanel users={users} myId={myId} onSelect={openDm} />
          <ChatPanel
            roomMsgs={roomMsgs}
            allMsgs={allMsgs}
            privateMsgs={privateMsgs}
            onlineIds={onlineIds}
            users={users}
            myId={myId}
            dmRequest={dmRequest}
            onSend={sendChat}
            onTypingChange={setTyping}
          />
        </div>
      </div>

      {boardOpen && (
        <KanbanBoard boards={boards} tasks={tasks} users={users} send={send} myId={myId} onClose={() => setBoardOpen(false)} />
      )}
    </div>
  );
}
