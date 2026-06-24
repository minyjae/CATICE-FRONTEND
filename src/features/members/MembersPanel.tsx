import { colorFor } from "../../shared/colors";
import { ROLE_LABEL } from "../auth/roles";
import { ROOMS } from "../office/constants";
import type { PublicUser, RoomName } from "../../shared/protocol";

const ROOM_LABEL = Object.fromEntries(ROOMS) as Record<string, string>;

interface MembersPanelProps {
  users: PublicUser[];
  myId: string | null;
  onlineIds: string[]; // ใครออนไลน์ (จาก presence ของ server — ข้ามห้อง)
  inCallIds: string[]; // ใครกำลังอยู่ในสายวิดีโอ (busy)
  playerRooms: Record<string, RoomName>; // ห้องที่แต่ละ user อยู่ปัจจุบัน
  onSelect?: (id: string) => void; // คลิกสมาชิก (ที่ไม่ใช่ตัวเอง) → เปิดแชตส่วนตัว
}

// รายชื่อสมาชิกทั้งหมดที่สมัครเข้าระบบ — ดึงมาจาก handler /users (ส่งเข้ามาเป็น prop users)
// แสดง avatar (สีคงที่ตาม id) + ชื่อ + ตำแหน่ง + สถานะ online/in-call, ไฮไลต์ "ฉัน"; คลิกคนอื่น → แชตส่วนตัว
export default function MembersPanel({ users, myId, onlineIds, inCallIds, playerRooms, onSelect }: MembersPanelProps) {
  const onlineSet = new Set(onlineIds);
  const inCallSet = new Set(inCallIds);
  return (
    <div className="panel members">
      <div className="members-head">
        👥 สมาชิก<span className="members-count">{users.length}</span>
      </div>
      <div className="members-list">
        {users.length === 0 && <div className="members-empty">ยังไม่มีสมาชิก</div>}
        {users.map((u) => {
          const me = u.id === myId;
          const canDm = !me && !!onSelect;
          const isOnline = me || onlineSet.has(u.id); // ตัวเองถือว่า online เสมอ
          const isInCall = inCallSet.has(u.id);
          return (
            <div
              key={u.id}
              className={"member" + (canDm ? " clickable" : "") + (isOnline ? "" : " offline")}
              onClick={canDm ? () => onSelect!(u.id) : undefined}
              title={canDm ? "แชตส่วนตัว" : undefined}
            >
              <span className="member-avatar" style={{ background: colorFor(u.id) }}>
                {(u.name[0] || "?").toUpperCase()}
                <span className={"member-presence" + (isOnline ? " online" : "")} />
              </span>
              <span className="member-name">
                {u.name}
                {me ? " (ฉัน)" : ""}
              </span>
              {isInCall && <span className="member-incall" title="กำลังอยู่ในสาย">📞</span>}
              <span className="member-role">{ROLE_LABEL[u.role] || u.role}</span>
              {isOnline && playerRooms[u.id] && (
                <span className="member-room">อยู่ใน {ROOM_LABEL[playerRooms[u.id]] ?? playerRooms[u.id]}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
