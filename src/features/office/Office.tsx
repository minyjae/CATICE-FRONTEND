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
  const [sideOpen, setSideOpen] = useState(true);
  const [users, setUsers] = useState<PublicUser[]>([]); // user ที่สมัครทั้งหมด → selector มอบหมาย task + แชตส่วนตัว
  // คลิกสมาชิก → ขอเปิดแท็บแชตส่วนตัวกับคนนั้น (n = nonce ให้เปิดซ้ำคนเดิมได้)
  const [dmRequest, setDmRequest] = useState<{ id: string; n: number } | null>(
    null,
  );
  const openDm = (id: string) =>
    setDmRequest((r) => ({ id, n: (r?.n ?? 0) + 1 }));
  const nameById: Record<string, string> = Object.fromEntries(
    users.map((u) => [u.id, u.name]),
  );

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
        <span className="room-badge">
          {ROOMS.find(([v]) => v === room)?.[1] ?? room}
        </span>
        <span className="status-chip">{status}</span>
        <span className="spacer" />
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
            {/* ปุ่มเปิด/ปิด sidebar */}
            <button
              className="setting-label"
              onClick={() => setSideOpen((v) => !v)}
              title={sideOpen ? "ปิดตั้งค่า" : "เปิดตั้งค่า"}
            >
              ⚙ ตั้งค่า
            </button>

            {/* Toolbar sidebar — ซ้ายของ stage, slide เปิด/ปิด */}
            <div
              className={
                "ctrl-sidebar" + (sideOpen ? " ctrl-sidebar-open" : "")
              }
            >
              <div className="ctrl-sidebar-inner">
                <div className="ctrl-section">
                  <div className="ctrl-label">ตั้งค่า</div>

                  {inCall ? (
                    <button
                      className="ctrl-btn ctrl-btn-danger"
                      onClick={leaveVideo}
                    >
                      📵 ออกวิดีโอ
                    </button>
                  ) : (
                    <button className="ctrl-btn" onClick={startVideo}>
                      📹 เริ่มวิดีโอ
                    </button>
                  )}
                  {outgoingInvites.length > 0 && (
                    <div className="ctrl-inviting">
                      กำลังเชิญ{" "}
                      {outgoingInvites
                        .map((id) => nameById[id] ?? "…")
                        .join(", ")}
                    </div>
                  )}
                </div>
                <div className="ctrl-divider" />
                <div className="ctrl-section">
                  <div className="ctrl-label">โหมดวิดีโอ</div>
                  <button
                    className={
                      videoMode === "invite" ? "ctrl-btn active" : "ctrl-btn"
                    }
                    onClick={() => setVideoMode("invite")}
                  >
                    เชิญ
                  </button>
                  <button
                    className={
                      videoMode === "auto" ? "ctrl-btn active" : "ctrl-btn"
                    }
                    onClick={() => setVideoMode("auto")}
                  >
                    อัตโนมัติ
                  </button>
                </div>
                <div className="ctrl-divider" />
                <div className="ctrl-section">
                  <div className="ctrl-label">Kanban Board</div>
                  <button
                    className="ctrl-btn"
                    onClick={() => setBoardOpen(true)}
                  >
                    📋 Board
                  </button>
                  <div className="ctrl-divider" />

                  <div className="ctrl-label">เปลี่ยนตัวละคร</div>
                  <button
                    className="ctrl-btn"
                    onClick={() => setSpritePickerOpen(true)}
                  >
                    🎭 ตัวละคร
                  </button>
                </div>
              </div>
            </div>

            <VideoPanel videos={videos} />
            <div
              className="stage-canvas"
              style={{ width: CANVAS_W, height: CANVAS_H }}
            >
              <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />
              <canvas
                ref={pixiCanvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="player-layer"
              />
            </div>
            <div className="hint">↑ ↓ ← → เดิน · คลิกเพื่อน → ชวนวิดีโอ</div>
          </div>
        </div>

        <div className="side">
          <MembersPanel
            users={users}
            myId={myId}
            onlineIds={onlineIds}
            inCallIds={inCallIds}
            playerRooms={playerRooms}
            onSelect={openDm}
          />
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
        <KanbanBoard
          boards={boards}
          tasks={tasks}
          users={users}
          send={send}
          myId={myId}
          onClose={() => setBoardOpen(false)}
        />
      )}

      <CallInvite
        incoming={incomingInvites}
        users={users}
        onAccept={acceptInvite}
        onReject={rejectInvite}
      />

      {spritePickerOpen && (
        <SpritePicker
          onSelect={setMySprite}
          onClose={() => setSpritePickerOpen(false)}
        />
      )}
    </div>
  );
}
