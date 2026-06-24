import { useState, useEffect } from "react";
import { useRoom } from "./useRoom";
import { CANVAS_W, CANVAS_H, ROOMS } from "./constants";
import { ROLE_LABEL } from "../auth/roles";
import { logout as logoutRequest, fetchUsers } from "../auth/api";
import ChatPanel from "../chat/ChatPanel";
import VideoPanel from "../video/VideoPanel";
import CallInvite from "../video/CallInvite";
import KanbanBoard from "../kanban/KanbanBoard";
import MembersPanel from "../members/MembersPanel";
import SpritePicker from "./SpritePicker";
import type { Me, PublicUser } from "../../shared/protocol";

interface OfficeProps {
  me: Me;
  onLogout: () => void;
}

// เปลือกหน้าออฟฟิศ: ต่อ realtime ทั้งหมดผ่าน useRoom แล้วประกอบ canvas + panel ต่าง ๆ
export default function Office({ me, onLogout }: OfficeProps) {
  const displayName = me.email.split("@")[0];
  const {
    canvasRef,
    pixiCanvasRef,
    room,
    roomMsgs,
    allMsgs,
    privateMsgs,
    onlineIds,
    inCallIds,
    playerRooms,
    videos,
    status,
    myId,
    boards,
    tasks,
    videoMode,
    setVideoMode,
    incomingInvites,
    outgoingInvites,
    startVideo,
    leaveVideo,
    acceptInvite,
    rejectInvite,
    send,
    sendChat,
    setTyping,
    setMySprite,
  } = useRoom({
    room: "lobby",
    displayName,
  });
  const inCall = videos.some((v) => v.me); // "อยู่ในสาย" = มี tile กล้องตัวเอง
  const [boardOpen, setBoardOpen] = useState(false);
  const [spritePickerOpen, setSpritePickerOpen] = useState(false);
  const [users, setUsers] = useState<PublicUser[]>([]); // user ที่สมัครทั้งหมด → selector มอบหมาย task + แชตส่วนตัว
  // คลิกสมาชิก → ขอเปิดแท็บแชตส่วนตัวกับคนนั้น (n = nonce ให้เปิดซ้ำคนเดิมได้)
  const [dmRequest, setDmRequest] = useState<{ id: string; n: number } | null>(null);
  const openDm = (id: string) => setDmRequest((r) => ({ id, n: (r?.n ?? 0) + 1 }));
  const nameById: Record<string, string> = Object.fromEntries(users.map((u) => [u.id, u.name]));

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
        <span className="brand">🐱</span>
        <span className="brand-title"> Catice</span>
        <span className="room-badge">{ROOMS.find(([v]) => v === room)?.[1] ?? room}</span>
        <span className="spacer" />

        {/* โหมดสาย: Invite (เชิญ+ยินยอม) / Auto (proximity เดิม) */}
        <div className="mode-toggle" title="โหมดเปิดวิดีโอ">
          <button className={videoMode === "invite" ? "active" : ""} onClick={() => setVideoMode("invite")}>
            เชิญ
          </button>
          <button className={videoMode === "auto" ? "active" : ""} onClick={() => setVideoMode("auto")}>
            อัตโนมัติ
          </button>
        </div>

        {inCall ? (
          <button className="ghost call-leave" onClick={leaveVideo}>
            📵 ออกจากวิดีโอ
          </button>
        ) : (
          <button className="ghost" onClick={startVideo}>
            📹 เริ่มวิดีโอ
          </button>
        )}

        {outgoingInvites.length > 0 && (
          <span className="inviting-chip">
            กำลังเชิญ {outgoingInvites.map((id) => nameById[id] ?? "…").join(", ")}…
          </span>
        )}

        <button className="ghost" onClick={() => setBoardOpen(true)}>
          📋 Board
        </button>
        <span className="user-chip">
          <span className="dot" />
          {displayName} · {ROLE_LABEL[me.role] || me.role}
        </span>
        <button className="ghost" onClick={() => setSpritePickerOpen(true)}>
          🎭 ตัวละคร
        </button>
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
            <div className="hint">↑ ↓ ← → เดิน · คลิกเพื่อน → ชวนวิดีโอ</div>
            <div className="status">{status}</div>
          </div>
        </div>

        <div className="side">
          <MembersPanel users={users} myId={myId} onlineIds={onlineIds} inCallIds={inCallIds} playerRooms={playerRooms} onSelect={openDm} />
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

      <CallInvite incoming={incomingInvites} users={users} onAccept={acceptInvite} onReject={rejectInvite} />

      {spritePickerOpen && (
        <SpritePicker onSelect={setMySprite} onClose={() => setSpritePickerOpen(false)} />
      )}
    </div>
  );
}
