// สัญญา (contract) ของ realtime ระหว่าง Go backend ↔ frontend — ที่เดียวที่นิยาม shape
// ของข้อความ WebSocket + entity ที่ใช้ร่วมกัน ให้ mirror struct ฝั่ง backend
// (CATICE-BACKEND/internal/{room,protocol,auth/domain})
//
// ⚠️ ไม่ sync อัตโนมัติกับ Go — ถ้า backend เปลี่ยน shape ต้องมาตามแก้ที่นี่

// ----- entity -----

export type RoomName = "lobby" | "meeting_room" | "office" | "canteen";

export type Role = "developer" | "pm" | "po" | "cto" | "uxui";

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

// domain.Task (json) — การ์ดบน Kanban
export interface Task {
  id: string;
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

// protocol.ChatBroadcast — แชตขาออกจาก server (มี id/name ของผู้พูด)
export interface ChatBroadcast {
  id: string;
  name: string;
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
  | { type: "chat"; payload: ChatBroadcast }
  | { type: "signal"; payload: { from: string; data: SignalData } }
  | { type: "object"; payload: RoomObject }
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
  chat: { text: string };
  signal: { to: string; data: SignalData };
  object: { name: string; x: number; y: number };
  task_create: { title: string; detail: string; assign_to: string[] };
  task_move: { id: string; status: TaskStatus };
  task_update: { id: string; title: string; detail: string; assign_to: string[] };
  task_delete: { id: string };
}

export type ClientMsgType = keyof ClientMsgMap;

// ฟังก์ชันส่งข้อความผ่าน WebSocket — payload ถูกบังคับชนิดตาม type
export type Send = <T extends ClientMsgType>(type: T, payload: ClientMsgMap[T]) => void;
