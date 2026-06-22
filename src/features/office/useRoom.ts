import { useEffect, useRef, useState } from "react";
import { drawPlayers, ROOM_SCENE } from "./canvas/room";
import { nextCell } from "./movement";
import { PROXIMITY, doorAt } from "./constants";
import type { Cell } from "./constants";
import { createVideoController } from "../video/videoController";
import type { VideoTile } from "../video/videoController";
import { getToken } from "../auth/token";
import type { ChatMsg, Player, RoomName, Send, ServerMsg, Task } from "../../shared/protocol";

interface UseRoomArgs {
  room: RoomName;
  displayName: string;
}

export function useRoom({ room: initialRoom, displayName }: UseRoomArgs) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const playersRef = useRef<Record<string, Player>>({});
  const myIdRef = useRef<string | null>(null);

  // ห้องปัจจุบัน (ref) — render loop + key handler อ่านค่าล่าสุดได้แม้ effect เปิดครั้งเดียว
  const roomRef = useRef<RoomName>(initialRoom);

  // ตำแหน่งเกิดที่ตั้งไว้ตอนเดินผ่านประตู (door.spawn) → ชนะตำแหน่ง Redis ของห้องใหม่
  // ใช้ครั้งเดียวตอน welcome ของห้องใหม่มาถึง แล้วล้างทิ้ง (null = ให้ใช้ตำแหน่งจาก backend)
  const nextSpawnRef = useRef<Cell | null>(null);

  const typingRef = useRef(false);

  const [room, setRoom] = useState<RoomName>(initialRoom);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [videos, setVideos] = useState<VideoTile[]>([]);
  const [status, setStatus] = useState("กำลังเชื่อมต่อ...");
  const [myId, setMyId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Record<string, Task>>({});

  // เปิด WebSocket "ครั้งเดียว" ตอน mount — การย้ายห้องทำบน socket เดิมผ่าน switch_room
  // (ไม่ reconnect แล้ว) ดังนั้น effect ไม่ผูกกับ room
  useEffect(() => {
    const token = getToken();

    const ws = new WebSocket(
      `ws://${location.host}/ws?room=${encodeURIComponent(initialRoom)}` +
        (token ? `&token=${encodeURIComponent(token)}` : ""),
    );

    wsRef.current = ws;

    const send: Send = (type, payload) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type, payload }));
      }
    };

    const video = createVideoController({
      playersRef,
      myIdRef,
      send,
      setVideos,
    });

    // =========================
    // WS EVENTS
    // =========================

    ws.onopen = () => {
      setStatus("เชื่อมต่อแล้ว");
    };

    ws.onclose = () => {
      setStatus("การเชื่อมต่อหลุด ❌");
    };

    ws.onmessage = (e) => {
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
            setMessages([]);
            setTasks({});
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

          // ส่งชื่อซ้ำ (เหมือน flow ตอนต่อครั้งแรก) → คนในห้องนี้ถึงจะเห็นเรา
          send("join", { name: displayName });

          // เข้าทางประตู → แจ้ง backend ว่าเรายืนหน้าประตู (ทับตำแหน่ง Redis + ให้คนอื่นเห็นตรงกัน)
          if (door) send("move", { x, y });
          break;
        }

        case "join":
        case "move":
          playersRef.current[env.payload.id] = env.payload;
          break;

        case "leave":
          delete playersRef.current[env.payload.id];
          video.endCall(env.payload.id);
          break;

        case "chat":
          setMessages((m) => [
            ...m,
            {
              ...env.payload,
              t: Date.now(),
            },
          ]);
          break;

        case "signal":
          video.handleSignal(env.payload);
          break;

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

    let raf = 0;

    const loop = () => {
      if (ctx && canvas) {
        const drawScene = ROOM_SCENE[roomRef.current] ?? ROOM_SCENE.lobby;
        drawScene(ctx, canvas.width, canvas.height);
        drawPlayers(ctx, playersRef.current, myIdRef.current);
      }

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
      window.removeEventListener("keydown", onKey);

      cancelAnimationFrame(raf);

      clearInterval(prox);

      video.destroy();

      ws.close();
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

  const sendChat = (text: string): boolean => {
    const v = text.trim();

    if (!v) {
      return false;
    }

    send("chat", {
      text: v,
    });

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
    room,
    messages,
    videos,
    status,
    myId,
    tasks,
    send,
    sendChat,
    setTyping,
    switchRoom,
  };
}
