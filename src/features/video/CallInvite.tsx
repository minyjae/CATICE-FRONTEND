import type { PublicUser } from "../../shared/protocol";

interface CallInviteProps {
  incoming: string[]; // userId ของคนที่ชวนเรา (รอตอบ)
  users: PublicUser[]; // ใช้ map id → ชื่อ
  onAccept: (from: string) => void;
  onReject: (from: string) => void;
}

// modal ขอความยินยอมเข้าสายวิดีโอ — แสดงทีละคำเชิญ (คนล่าสุดอยู่บนสุด)
export default function CallInvite({ incoming, users, onAccept, onReject }: CallInviteProps) {
  if (incoming.length === 0) return null;
  const nameById: Record<string, string> = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return (
    <div className="call-invite-wrap">
      {incoming.map((from) => (
        <div key={from} className="call-invite">
          <span className="call-invite-icon">📹</span>
          <div className="call-invite-text">
            <b>{nameById[from] ?? "ผู้ใช้"}</b> ชวนคุยวิดีโอ
          </div>
          <div className="call-invite-actions">
            <button className="call-reject" onClick={() => onReject(from)}>
              ปฏิเสธ
            </button>
            <button className="call-accept" onClick={() => onAccept(from)}>
              ยอมรับ
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
