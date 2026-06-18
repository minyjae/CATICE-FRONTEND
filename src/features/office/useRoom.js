import { useEffect, useRef, useState } from "react";
import { drawPlayers, ROOM_SCENE } from "./canvas/room.js";
import { nextCell } from "./movement.js";
import { PROXIMITY, doorAt, SPAWN } from "./constants.js";
import { createVideoController } from "../video/videoController.js";

// หัวใจของ Office: เปิด WebSocket ครั้งเดียวตอน mount แล้วประสานทุกอย่าง —
// ผู้เล่น/การเดิน, แชต, render loop ของ canvas, และสายวิดีโอ proximity (ผ่าน videoController)
//
// เก็บ realtime state ที่เปลี่ยนถี่ใน useRef (ไม่ให้ re-render ทุกเฟรม);
// ใช้ useState เฉพาะสิ่งที่ต้องแสดงผล (messages, videos, status)
export function useRoom({ room: initialRoom, displayName }) {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const playersRef = useRef({}); // id -> { id, name, x, y }
  const myIdRef = useRef(null);
  const typingRef = useRef(false); // กำลังพิมพ์แชต → ไม่เดิน

  const [room, setRoom] = useState(initialRoom);
  const [messages, setMessages] = useState([]);
  const [videos, setVideos] = useState([]); // { id, stream, me }
  const [status, setStatus] = useState("กำลังเชื่อมต่อ…");
  const [myId, setMyId] = useState(null); // คู่กับ myIdRef แต่ใช้สำหรับ render (เช่นแยกข้อความ "คุณ")
  const [tasks, setTasks] = useState({}); // Kanban: task เก็บเป็น object keyed by id

  useEffect(() => {
    // reset สถานะห้องเก่าทุกครั้งที่ต่อใหม่ (กันคน/แชต/วิดีโอห้องเก่าค้าง)
    // ตั้งใจ setState ตอนต้น effect เมื่อ room เปลี่ยน — ยอมรับ 1 render เพิ่มเพื่อล้างห้องเก่า
    /* eslint-disable react-hooks/set-state-in-effect */
    playersRef.current = {};
    myIdRef.current = null;
    setMessages([]);
    setVideos([]);
    setTasks({}); // กันการ์ดห้องเก่าค้างเมื่อย้ายห้อง
    setStatus("กำลังเชื่อมต่อ ...");
    /* eslint-enable react-hooks/set-state-in-effect */

    const ws = new WebSocket(`ws://${location.host}/ws?room=${encodeURIComponent(room)}`);
    wsRef.current = ws;
    const send = (type, payload) => ws.readyState === 1 && ws.send(JSON.stringify({ type, payload }));

    const video = createVideoController({ playersRef, myIdRef, send, setVideos });

    // ย้ายตัวเองไปยืนหน้าประตูครั้งเดียวต่อการเข้าห้อง (พอรู้ id + มี player ของตัวเองแล้ว)
    let spawned = false;
    const maybeSpawn = () => {
      const id = myIdRef.current;
      const p = playersRef.current[id];
      const s = SPAWN[room];
      if (spawned || !id || !p || !s) return;
      p.x = s.x; p.y = s.y;
      send("move", s); // บอก backend/คนอื่นว่าเราอยู่หน้าประตู
      spawned = true;
    };

    ws.onopen = () => { setStatus("เชื่อมต่อแล้ว"); send("join", { name: displayName }); };
    ws.onclose = () => setStatus("การเชื่อมต่อหลุด ❌");
    ws.onmessage = (e) => {
      const env = JSON.parse(e.data);
      switch (env.type) {
        case "welcome": myIdRef.current = env.payload.id; setMyId(env.payload.id); maybeSpawn(); break;
        case "join":
        case "move": playersRef.current[env.payload.id] = env.payload; maybeSpawn(); break;
        case "leave": delete playersRef.current[env.payload.id]; video.endCall(env.payload.id); break;
        case "chat": setMessages((m) => [...m, { ...env.payload, t: Date.now() }]); break;
        case "signal": video.handleSignal(env.payload); break;
        // ----- Kanban: upsert ตาม id (task_create ใช้ทั้งสร้างใหม่และ snapshot ตอนเข้าห้อง) -----
        case "task_create":
        case "task_move":
        case "task_update": setTasks((t) => ({ ...t, [env.payload.id]: env.payload })); break;
        case "task_delete": setTasks((t) => { const c = { ...t }; delete c[env.payload.id]; return c; }); break;
      }
    };

    // ---------- เดินด้วยลูกศร ----------
    const onKey = (e) => {
      if (typingRef.current) return;
      const meP = playersRef.current[myIdRef.current];
      if (!meP) return;
      const cell = nextCell(meP, e.key);
      if (!cell) return;
      e.preventDefault();

      const door = doorAt(room, cell.x, cell.y);
      if (door) { switchRoom(door.to); return; }

      meP.x = cell.x; meP.y = cell.y;
      send("move", cell);
    };
    window.addEventListener("keydown", onKey);

    // ---------- render loop ----------
    const ctx = canvasRef.current.getContext("2d");
    const drawScene = ROOM_SCENE[room] ?? ROOM_SCENE.lobby; // เลือกฉากตามห้องปัจจุบัน
    let raf;
    const loop = () => {
      drawScene(ctx, canvasRef.current.width, canvasRef.current.height);
      drawPlayers(ctx, playersRef.current, myIdRef.current);
      raf = requestAnimationFrame(loop);
    };
    loop();

    // ---------- proximity → เปิด/ปิดวิดีโอ ----------
    const prox = setInterval(() => video.syncProximity(PROXIMITY), 500);

    // ---------- cleanup ----------
    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      clearInterval(prox);
      video.destroy();
      ws.close();
    };
  }, [room]); // eslint-disable-line -- mount ครั้งเดียวโดยตั้งใจ; lifecycle ของ ws จัดการเองใน cleanup

  // ส่งข้อความผ่าน ws เส้นเดียวกับเกม/แชต/วิดีโอ (envelope { type, payload }) — Kanban ก็ใช้ตัวนี้
  const send = (type, payload) =>
    wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify({ type, payload }));

  // ส่งแชต คืน true ถ้าส่งจริง (ข้อความไม่ว่าง)
  const sendChat = (text) => {
    const v = text.trim();
    if (!v) return false;
    send("chat", { text: v });
    return true;
  };

  const setTyping = (b) => { typingRef.current = b; };

  // ย้ายห้อง: แค่เปลี่ยน state → effect [room] จะ cleanup สายเก่า (ปิด ws = backend เห็นเรา leave)
  // แล้วเปิดสายใหม่ ?room=next เอง ห้ามเปิด/ปิด ws ตรงนี้
  function switchRoom(next) {
    if (next !== room) setRoom(next);
  }

  return { canvasRef, room, messages, videos, status, myId, tasks, send, sendChat, setTyping, switchRoom };
}
