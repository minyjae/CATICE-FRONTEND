// สัญญา (contract) ของ realtime ระหว่าง Go backend ↔ frontend — ที่เดียวที่นิยาม shape
// ของข้อความ WebSocket + entity ที่ใช้ร่วมกัน ให้ mirror struct ฝั่ง backend
// (CATICE-BACKEND/internal/{room,protocol,auth/domain})
//
// ⚠️ ไม่ sync อัตโนมัติกับ Go — ถ้า backend เปลี่ยน shape ต้องมาตามแก้ที่นี่

// ----- entity -----

export type RoomName = "lobby" | "meeting_room" | "office" | "canteen";

export type Role = "developer" | "pm" | "po" | "cto" | "uxui" | "hr";

export type TaskStatus = "todo" | "doing" | "done";

// room.Player — ผู้เล่นในห้อง (game state)
export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
}

// room.Object — วัตถุตกแต่งในห้อง
export interface RoomObject {
  id: string;
  name: string;
  x: number;
  y: number;
}

// domain.Board (json) — บอร์ด Kanban (global ไม่ผูกห้อง)
export interface Board {
  id: string;
  name: string;
}

// domain.Task (json) — การ์ดบน Kanban (ผูกกับ board ผ่าน board_id)
export interface Task {
  id: string;
  board_id: string;
  title: string;
  detail: string;
  status: TaskStatus;
  created_by: string;
  assign_to: string[];
}

// domain.User (จาก /me) — user ที่ login อยู่ (PassHash ถูกตัดด้วย json:"-")
export interface Me {
  id: string;
  email: string;
  role: Role;
}

// domain.PublicUser (จาก /users) — ข้อมูล user ที่เปิดให้คนอื่นเห็น
export interface PublicUser {
  id: string;
  name: string;
  role: Role;
}

// ขอบเขตแชต: ห้องนี้ / ทุกคนทุกห้อง / ส่วนตัวรายคน
export type ChatScope = "room" | "all" | "private";

// protocol.ChatBroadcast — แชตขาออกจาก server (มี id/name ของผู้พูด)
// to มีเฉพาะ scope=private (= userId ปลายทาง)
export interface ChatBroadcast {
  mid: string; // message id — ใช้ dedupe (ข้อความ live ที่เคยรับ vs ที่มาซ้ำในประวัติตอน reconnect)
  ts: number; // unix seconds — เวลาส่งจาก server
  scope: ChatScope;
  id: string;
  name: string;
  to?: string;
  text: string;
}

// แชตที่ frontend เก็บไว้แสดง = ChatBroadcast + เวลา (เติมฝั่ง client)
export interface ChatMsg extends ChatBroadcast {
  t: number;
}

// WebRTC signaling — sdp/candidate ตัวใดตัวหนึ่ง
export interface SignalData {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

// ----- ข้อความขาเข้า (server → client) -----

export type ServerMsg =
  | { type: "welcome"; payload: { id: string; room: RoomName; x: number; y: number } }
  | { type: "join"; payload: Player }
  | { type: "move"; payload: Player }
  | { type: "leave"; payload: { id: string } }
  | { type: "presence"; payload: { id: string; online: boolean; in_call: boolean; room?: RoomName } }
  | { type: "chat"; payload: ChatBroadcast }
  | { type: "signal"; payload: { from: string; data: SignalData } }
  | { type: "object"; payload: RoomObject }
  | { type: "call_invite"; payload: { from: string } }
  | { type: "call_accept"; payload: { from: string } }
  | { type: "call_reject"; payload: { from: string } }
  | { type: "call_cancel"; payload: { from: string } }
  | { type: "board_create"; payload: Board }
  | { type: "board_rename"; payload: Board }
  | { type: "board_delete"; payload: { id: string } }
  | { type: "task_create"; payload: Task }
  | { type: "task_move"; payload: Task }
  | { type: "task_update"; payload: Task }
  | { type: "task_delete"; payload: { id: string } };

export type ServerMsgType = ServerMsg["type"];

// ----- ข้อความขาออก (client → server) -----
// map ชนิดข้อความ → payload เพื่อให้ send() ตรวจ payload ตาม type ได้

export interface ClientMsgMap {
  join: { name: string };
  move: { x: number; y: number };
  switch_room: { room: RoomName };
  // รายงานสถานะกล้องตัวเอง (online ↔ in-call) → server broadcast presence ให้คนอื่นเห็น busy
  call_status: { in_call: boolean };
  // ส่งแชต: ละ scope = ห้องนี้; scope=private ต้องมี to (userId ปลายทาง)
  chat: { scope?: ChatScope; to?: string; text: string };
  signal: { to: string; data: SignalData };
  // เชิญ/ตอบรับ/ปฏิเสธ/ยกเลิก สายวิดีโอ — backend ต้อง relay ไปยัง to (เหมือน signal)
  call_invite: { to: string };
  call_accept: { to: string };
  call_reject: { to: string };
  call_cancel: { to: string };
  object: { name: string; x: number; y: number };
  board_create: { name: string };
  board_rename: { id: string; name: string };
  board_delete: { id: string };
  task_create: { board_id: string; title: string; detail: string; assign_to: string[] };
  task_move: { id: string; status: TaskStatus };
  task_update: { id: string; title: string; detail: string; assign_to: string[] };
  task_delete: { id: string };
}

export type ClientMsgType = keyof ClientMsgMap;

// ฟังก์ชันส่งข้อความผ่าน WebSocket — payload ถูกบังคับชนิดตาม type
export type Send = <T extends ClientMsgType>(type: T, payload: ClientMsgMap[T]) => void;
