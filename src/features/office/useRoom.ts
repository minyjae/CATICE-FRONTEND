import { useEffect, useRef, useState } from "react";
import { ROOM_SCENE } from "./canvas/room";
import { createPlayerLayer } from "./canvas/playerLayer";
import { nextCell } from "./movement";
import { PROXIMITY, doorAt, blockedAt } from "./constants";
import type { Cell } from "./constants";
import { createVideoController } from "../video/videoController";
import type { VideoTile } from "../video/videoController";
import { getToken } from "../auth/token";
import type { Board, ChatMsg, ChatScope, Player, RoomName, Send, ServerMsg, Task } from "../../shared/protocol";

interface UseRoomArgs {
  room: RoomName;
  displayName: string;
}

export function useRoom({ room: initialRoom, displayName }: UseRoomArgs) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const playersRef = useRef<Record<string, Player>>({});
  const myIdRef = useRef<string | null>(null);

  // ห้องปัจจุบัน (ref) — render loop + key handler อ่านค่าล่าสุดได้แม้ effect เปิดครั้งเดียว
  const roomRef = useRef<RoomName>(initialRoom);

  // ตำแหน่งเกิดที่ตั้งไว้ตอนเดินผ่านประตู (door.spawn) → ชนะตำแหน่ง Redis ของห้องใหม่
  // ใช้ครั้งเดียวตอน welcome ของห้องใหม่มาถึง แล้วล้างทิ้ง (null = ให้ใช้ตำแหน่งจาก backend)
  const nextSpawnRef = useRef<Cell | null>(null);

  const typingRef = useRef(false);

  // presence: ผู้ใช้ที่ออนไลน์ "เท่าที่เรารับรู้" = ผู้เล่นในห้องเดียวกัน (backend ไม่ส่ง presence ข้ามห้อง)
  // เก็บใน ref + mirror เป็น state เฉพาะตอนสมาชิกเปลี่ยนจริง (กัน re-render ทุกก้าวเดิน)
  const onlineRef = useRef<Set<string>>(new Set());

  const [room, setRoom] = useState<RoomName>(initialRoom);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  // แชต 3 ขอบเขต (ephemeral — ไม่มีประวัติข้ามการ reconnect): ห้องนี้ / ทั้งหมด / ส่วนตัว
  // ห้องนี้แยกเก็บตามห้อง → ออกห้องแล้วกลับมายังเห็นแชตเดิม (ไม่ล้างตอนสลับห้อง)
  const [roomMsgsByRoom, setRoomMsgsByRoom] = useState<Record<string, ChatMsg[]>>({});
  const [allMsgs, setAllMsgs] = useState<ChatMsg[]>([]);
  const [privateMsgs, setPrivateMsgs] = useState<Record<string, ChatMsg[]>>({});
  const [videos, setVideos] = useState<VideoTile[]>([]);
  const [status, setStatus] = useState("กำลังเชื่อมต่อ...");
  const [myId, setMyId] = useState<string | null>(null);
  const [boards, setBoards] = useState<Record<string, Board>>({});
  const [tasks, setTasks] = useState<Record<string, Task>>({});

  // เปิด WebSocket "ครั้งเดียว" ตอน mount — การย้ายห้องทำบน socket เดิมผ่าน switch_room
  // (ไม่ reconnect แล้ว) ดังนั้น effect ไม่ผูกกับ room
  useEffect(() => {
    let reconnectTimer = 0;
    let attempts = 0;
    let closedByUs = false;

    const send: Send = (type, payload) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type, payload }));
      }
    };

    const video = createVideoController({
      playersRef,
      myIdRef,
      send,
      setVideos,
    });

    // presence helpers — mirror state เฉพาะตอนเซ็ตสมาชิกเปลี่ยนจริง
    const markOnline = (id: string) => {
      if (!onlineRef.current.has(id)) {
        onlineRef.current.add(id);
        setOnlineIds([...onlineRef.current]);
      }
    };
    const markOffline = (id: string) => {
      if (onlineRef.current.delete(id)) setOnlineIds([...onlineRef.current]);
    };
    const resetOnline = (ids: string[]) => {
      onlineRef.current = new Set(ids);
      setOnlineIds(ids);
    };

    // =========================
    // WS EVENTS
    // =========================

    const onMessage = (e: MessageEvent) => {
      const env = JSON.parse(e.data) as ServerMsg;

      switch (env.type) {
        case "welcome": {
          const id = env.payload.id;
          myIdRef.current = id;
          setMyId(id);

          // เปลี่ยนห้อง (เป็นผลจาก switch_room) → ล้าง state ของห้องเก่าให้หมดก่อน
          // เพราะ backend จะไม่ส่ง leave ของคนห้องเก่าให้เรา (เราออกจากห้องนั้นแล้ว)
          if (env.payload.room !== roomRef.current) {
            playersRef.current = {};
            video.endAllCalls();
            resetOnline([]); // ออกจากห้องเก่า → presence เริ่มนับใหม่จากคนในห้องใหม่
            // ไม่ล้างแชต/board/task ตอนสลับห้อง — แชตห้องเก็บแยกต่อห้อง, board/task เป็น global
            roomRef.current = env.payload.room;
            setRoom(env.payload.room);
          }

          // ตำแหน่งเกิด: ถ้าเพิ่งเดินผ่านประตูมา → หน้าประตู (door.spawn) ชนะ
          // ไม่งั้นใช้ตำแหน่งที่ backend กู้จาก Redis (welcome.x/y) — refresh/สลับจาก dropdown
          const door = nextSpawnRef.current;
          nextSpawnRef.current = null;
          const x = door ? door.x : env.payload.x;
          const y = door ? door.y : env.payload.y;

          playersRef.current[id] = { id, name: displayName, x, y };
          markOnline(id);

          // ส่งชื่อซ้ำ (เหมือน flow ตอนต่อครั้งแรก) → คนในห้องนี้ถึงจะเห็นเรา
          send("join", { name: displayName });

          // เข้าทางประตู → แจ้ง backend ว่าเรายืนหน้าประตู (ทับตำแหน่ง Redis + ให้คนอื่นเห็นตรงกัน)
          if (door) send("move", { x, y });
          break;
        }

        case "join":
        case "move":
          playersRef.current[env.payload.id] = env.payload;
          markOnline(env.payload.id);
          break;

        case "leave":
          delete playersRef.current[env.payload.id];
          markOffline(env.payload.id);
          video.endCall(env.payload.id);
          break;

        case "chat": {
          const msg: ChatMsg = { ...env.payload, t: Date.now() };
          if (msg.scope === "all") {
            setAllMsgs((m) => [...m, msg]);
          } else if (msg.scope === "private") {
            // คู่สนทนา = "อีกฝั่ง" ของ (id, to); echo ของตัวเองก็เข้า thread ปลายทาง (to)
            const other = msg.id === myIdRef.current ? msg.to : msg.id;
            if (other) setPrivateMsgs((p) => ({ ...p, [other]: [...(p[other] ?? []), msg] }));
          } else {
            // ละ scope = ห้องนี้ → เก็บเข้า bucket ของห้องปัจจุบัน (รับเฉพาะแชตห้องที่เราอยู่อยู่แล้ว)
            const r = roomRef.current;
            setRoomMsgsByRoom((m) => ({ ...m, [r]: [...(m[r] ?? []), msg] }));
          }
          break;
        }

        case "signal":
          video.handleSignal(env.payload);
          break;

        case "board_create":
        case "board_rename":
          // upsert ตาม id (รองรับทั้ง snapshot ตอน join และ event จริง รับซ้ำไม่เกิดซ้ำ)
          setBoards((b) => ({
            ...b,
            [env.payload.id]: env.payload,
          }));
          break;

        case "board_delete": {
          const boardId = env.payload.id;
          setBoards((b) => {
            const copy = { ...b };
            delete copy[boardId];
            return copy;
          });
          // cascade: ลบ task ทุกตัวที่อยู่ในบอร์ดนี้ (backend ลบให้ฝั่ง state แล้ว แต่ UI ต้องตามล้าง)
          setTasks((t) => Object.fromEntries(Object.entries(t).filter(([, task]) => task.board_id !== boardId)));
          break;
        }

        case "task_create":
        case "task_move":
        case "task_update":
          setTasks((t) => ({
            ...t,
            [env.payload.id]: env.payload,
          }));
          break;

        case "task_delete":
          setTasks((t) => {
            const copy = { ...t };
            delete copy[env.payload.id];
            return copy;
          });
          break;
      }
    };

    // เปิด/ต่อ socket ใหม่ — auto-reconnect แบบ backoff เมื่อหลุดโดยไม่ได้ตั้งใจ
    // (dev reload, เน็ตกระตุก). ย้ายห้องไม่ปิด socket จึงไม่กระทบ logic switch_room
    function connect() {
      const token = getToken();
      const ws = new WebSocket(
        `ws://${location.host}/ws?room=${encodeURIComponent(roomRef.current)}` +
          (token ? `&token=${encodeURIComponent(token)}` : ""),
      );
      wsRef.current = ws;

      ws.onopen = () => {
        attempts = 0;
        setStatus("เชื่อมต่อแล้ว");
      };

      ws.onclose = () => {
        if (closedByUs) return; // ปิดเองตอน cleanup → ไม่ต้องต่อใหม่
        // ล้าง state ทั้งหมด รอ snapshot ใหม่ตอนต่อติด (upsert ตาม id จึงปลอดภัย, กัน ghost ค้าง)
        playersRef.current = {};
        video.endAllCalls();
        resetOnline([]);
        setBoards({});
        setTasks({});
        // แชต ephemeral — หลุดแล้วเริ่มใหม่ (ไม่มี snapshot แชตตอน join)
        setRoomMsgsByRoom({});
        setAllMsgs([]);
        setPrivateMsgs({});
        const delay = Math.min(1000 * 2 ** attempts, 10000); // 1s→2s→4s…สูงสุด 10s
        attempts += 1;
        setStatus(`การเชื่อมต่อหลุด — ต่อใหม่ใน ${Math.round(delay / 1000)} วิ…`);
        reconnectTimer = window.setTimeout(connect, delay);
      };

      ws.onmessage = onMessage;
    }

    connect();

    // =========================
    // KEYBOARD MOVE
    // =========================

    const onKey = (e: KeyboardEvent) => {
      if (typingRef.current) return;

      const id = myIdRef.current;
      const me = id ? playersRef.current[id] : undefined;

      if (!me) return;

      const cell = nextCell(me, e.key);

      if (!cell) return;

      e.preventDefault();

      const door = doorAt(roomRef.current, cell.x, cell.y);

      if (door) {
        switchRoom(door.to, door.spawn);

        return;
      }

      // ชนเฟอร์นิเจอร์/วัตถุ → ไม่ขยับ (เหมือนผนัง)
      if (blockedAt(roomRef.current, cell.x, cell.y)) {
        return;
      }

      me.x = cell.x;
      me.y = cell.y;

      send("move", cell);
    };

    window.addEventListener("keydown", onKey);

    // =========================
    // RENDER LOOP
    // =========================

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    // เลเยอร์ผู้เล่น (Pixi) ซ้อนบน canvas ห้อง — วาด avatar เป็น sprite animation
    const playerLayer = pixiCanvasRef.current ? createPlayerLayer(pixiCanvasRef.current) : null;

    let raf = 0;

    const loop = () => {
      if (ctx && canvas) {
        const drawScene = ROOM_SCENE[roomRef.current] ?? ROOM_SCENE.lobby;
        drawScene(ctx, canvas.width, canvas.height);
      }

      playerLayer?.update(playersRef.current, myIdRef.current);

      raf = requestAnimationFrame(loop);
    };

    loop();

    // =========================
    // PROXIMITY VIDEO
    // =========================

    const prox = setInterval(() => video.syncProximity(PROXIMITY), 500);

    // =========================
    // CLEANUP
    // =========================

    return () => {
      closedByUs = true;
      clearTimeout(reconnectTimer);

      window.removeEventListener("keydown", onKey);

      cancelAnimationFrame(raf);

      clearInterval(prox);

      playerLayer?.destroy();

      video.destroy();

      wsRef.current?.close();
    };
    // mount ครั้งเดียว: socket/handlers ทั้งหมดถูกตั้งครั้งเดียว, room เปลี่ยนผ่าน roomRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // SEND
  // =========================

  const send: Send = (type, payload) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(
        JSON.stringify({
          type,
          payload,
        }),
      );
    }
  };

  // =========================
  // CHAT
  // =========================

  // ส่งแชตตาม scope ของแท็บที่เปิด — private ต้องมี to (userId ปลายทาง)
  // ไม่ทำ optimistic: รอ broadcast/echo จาก server แล้วค่อยแสดง (กันข้อความเด้งซ้ำ)
  const sendChat = (scope: ChatScope, text: string, to?: string): boolean => {
    const v = text.trim();
    if (!v) return false;
    if (scope === "private") {
      if (!to) return false;
      send("chat", { scope: "private", to, text: v });
    } else if (scope === "all") {
      send("chat", { scope: "all", text: v });
    } else {
      send("chat", { scope: "room", text: v });
    }
    return true;
  };

  const setTyping = (b: boolean): void => {
    typingRef.current = b;
  };

  // =========================
  // ROOM SWITCH
  // =========================

  // ย้ายห้องบน socket เดิม: ส่ง switch_room แล้วรอ welcome ของห้องใหม่
  // (welcome เป็นตัวสั่งเปลี่ยน room state + วาง avatar — ไม่ setRoom ที่นี่ กัน state ไม่ตรง backend)
  // spawn (ถ้ามาจากประตู) เก็บไว้ใน nextSpawnRef → welcome จะเอาไปวาง avatar หน้าประตู
  function switchRoom(next: RoomName, spawn: Cell | null = null) {
    if (next === roomRef.current) return;
    if (spawn) nextSpawnRef.current = spawn;
    send("switch_room", { room: next });
  }

  return {
    canvasRef,
    pixiCanvasRef,
    room,
    videos,
    status,
    myId,
    boards,
    tasks,
    roomMsgs: roomMsgsByRoom[room] ?? [], // แชตของห้องที่กำลังอยู่
    allMsgs,
    privateMsgs,
    onlineIds,
    send,
    sendChat,
    setTyping,
    switchRoom,
  };
}
