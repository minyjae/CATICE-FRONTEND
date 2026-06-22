import { colorFor } from "../../shared/colors";
import { ROLE_LABEL } from "../auth/roles";
import type { PublicUser } from "../../shared/protocol";

interface MembersPanelProps {
  users: PublicUser[];
  myId: string | null;
}

// รายชื่อสมาชิกทั้งหมดที่สมัครเข้าระบบ — ดึงมาจาก handler /users (ส่งเข้ามาเป็น prop users)
// presentational ล้วน ๆ: แสดง avatar (สีคงที่ตาม id) + ชื่อ + ตำแหน่ง, ไฮไลต์ "ฉัน"
export default function MembersPanel({ users, myId }: MembersPanelProps) {
  return (
    <div className="panel members">
      <div className="members-head">
        👥 สมาชิก<span className="members-count">{users.length}</span>
      </div>
      <div className="members-list">
        {users.length === 0 && <div className="members-empty">ยังไม่มีสมาชิก</div>}
        {users.map((u) => (
          <div key={u.id} className="member">
            <span className="member-avatar" style={{ background: colorFor(u.id) }}>
              {(u.name[0] || "?").toUpperCase()}
            </span>
            <span className="member-name">
              {u.name}
              {u.id === myId ? " (ฉัน)" : ""}
            </span>
            <span className="member-role">{ROLE_LABEL[u.role] || u.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
