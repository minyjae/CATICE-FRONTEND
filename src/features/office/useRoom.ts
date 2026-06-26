import { useEffect, useRef, useState } from "react";
import { ROOM_SCENE } from "./canvas/room";
import { createPlayerLayer } from "./canvas/playerLayer";
import { getMySprite } from "./canvas/spriteConfig";
import type { SpriteKey } from "./canvas/spriteConfig";
import { nextCell } from "./movement";
import { PROXIMITY, FLOOR_ROW, GRID_W, GRID_H, doorAt, blockedAt } from "./constants";
import type { Cell } from "./constants";
import { createVideoController } from "../video/videoController";
import type { VideoTile, VideoController } from "../video/videoController";
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

  // กันแชตซ้ำ: backend ส่งประวัติตอน join (mid เดียวกับ live) → เก็บ mid ที่เคยเห็นไว้ dedupe
  const seenMidsRef = useRef<Set<string>>(new Set());

  // video controller (เก็บใน ref เพื่อให้ handler นอก effect เรียกได้) + โหมดสาย
  const videoCtrlRef = useRef<VideoController | null>(null);
  const modeRef = useRef<"invite" | "auto">("invite");
  const playerLayerRef = useRef<ReturnType<typeof createPlayerLayer> | null>(null);

  const [room, setRoom] = useState<RoomName>(initialRoom);
  // presence จาก server (ข้ามห้อง — source of truth): userId → {online, in_call}
  // เก็บเฉพาะคนที่ online (offline → ลบทิ้ง) → onlineIds = keys
  const [presence, setPresence] = useState<Record<string, { online: boolean; in_call: boolean }>>({});
  // ห้องที่แต่ละ user อยู่ปัจจุบัน: อัปจาก join (ห้องนี้) + presence.room (ข้ามห้อง จาก backend)
  const [playerRooms, setPlayerRooms] = useState<Record<string, RoomName>>({});
  const [videoMode, setVideoModeState] = useState<"invite" | "auto">("invite");
  const [incomingInvites, setIncomingInvites] = useState<string[]>([]); // คนที่ชวนเรา (รอตอบ)
  const [outgoingInvites, setOutgoingInvites] = useState<string[]>([]); // คนที่เราชวน (รอเขาตอบ)
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
    videoCtrlRef.current = video;

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
            // ไม่ล้าง presence ตอนสลับห้อง — presence เป็น global (server เป็น source of truth)
            setIncomingInvites([]); // คำเชิญของห้องเก่าถือเป็นโมฆะ
            setOutgoingInvites([]);
            // ไม่ล้างแชต/board/task ตอนสลับห้อง — แชตห้องเก็บแยกต่อห้อง, board/task เป็น global
            roomRef.current = env.payload.room;
            setRoom(env.payload.room);
          }

          // ตำแหน่งเกิด: ถ้าเพิ่งเดินผ่านประตูมา → หน้าประตู (door.spawn) ชนะ
          // ไม่งั้นใช้ตำแหน่งที่ backend กู้จาก Redis (welcome.x/y) — refresh/สลับจาก dropdown
          const door = nextSpawnRef.current;
          nextSpawnRef.current = null;
          // กันตำแหน่งจาก backend (random spawn) ตกบนผนัง/นอกกริด → clamp ลงแถวแรกที่เดินได้
          const x = Math.max(0, Math.min(GRID_W - 1, door ? door.x : env.payload.x));
          const y = Math.max(FLOOR_ROW, Math.min(GRID_H - 1, door ? door.y : env.payload.y));

          playersRef.current[id] = { id, name: displayName, x, y };

          // ส่งชื่อซ้ำ (เหมือน flow ตอนต่อครั้งแรก) → คนในห้องนี้ถึงจะเห็นเรา
          send("join", { name: displayName, sprite: getMySprite() });

          // ส่ง move เสมอ: แก้กรณี backend เก็บตำแหน่งบนผนัง (y < FLOOR_ROW) ไว้ใน Redis
          // เช่น user ใหม่ที่ยัง spawn ไม่ถูก → clamp แล้วต้องบอก backend ให้อัปเดตตำแหน่งจริง
          send("move", { x, y });
          break;
        }

        case "join":
          // ตัวเราเองจัดการตำแหน่งแบบ local (client prediction) → ข้าม echo จาก server กัน rubber-band
          if (env.payload.id === myIdRef.current) break;
          playersRef.current[env.payload.id] = env.payload;
          // บันทึกว่า player นี้อยู่ห้องเดียวกับเรา
          setPlayerRooms((p) => ({ ...p, [env.payload.id]: roomRef.current }));
          break;
        case "move":
          // เช่นเดียวกับ join: ไม่เอา move echo ของตัวเองมาทับ (ตำแหน่ง local สดกว่าเสมอ)
          if (env.payload.id === myIdRef.current) break;
          playersRef.current[env.payload.id] = env.payload;
          break;

        case "leave":
          delete playersRef.current[env.payload.id];
          video.endCall(env.payload.id);
          break;

        case "presence": {
          // สถานะจาก server (ข้ามห้อง) — เก็บเฉพาะคน online, offline → ลบทิ้ง
          const { id, online, in_call, room: pRoom } = env.payload;
          setPresence((p) => {
            if (!online) {
              const copy = { ...p };
              delete copy[id];
              return copy;
            }
            return { ...p, [id]: { online, in_call } };
          });
          if (!online) {
            setPlayerRooms((p) => { const c = { ...p }; delete c[id]; return c; });
          } else if (pRoom) {
            setPlayerRooms((p) => ({ ...p, [id]: pRoom }));
          }
          break;
        }

        case "chat": {
          // dedupe ด้วย mid (ประวัติตอน join ส่ง mid เดียวกับ live → กันข้อความซ้ำ)
          const mid = env.payload.mid;
          if (mid) {
            if (seenMidsRef.current.has(mid)) break;
            seenMidsRef.current.add(mid);
          }
          // ใช้เวลา server (ts วินาที → ms) ถ้ามี ไม่งั้น now
          const msg: ChatMsg = { ...env.payload, t: env.payload.ts ? env.payload.ts * 1000 : Date.now() };
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

        case "call_invite":
          // มีคนชวนเรา → ขึ้น modal ให้ยอมรับ/ปฏิเสธ (ไม่ต่อสายจนกว่าจะ accept)
          setIncomingInvites((p) => (p.includes(env.payload.from) ? p : [...p, env.payload.from]));
          break;

        case "call_accept":
          // ปลายทางตอบรับ → เริ่ม WebRTC ฝั่งเรา (กฎ myId<peerId คุมคนยื่น offer)
          video.startCall(env.payload.from);
          setOutgoingInvites((p) => p.filter((x) => x !== env.payload.from));
          break;

        case "call_reject":
          setOutgoingInvites((p) => p.filter((x) => x !== env.payload.from));
          break;

        case "call_cancel":
          setIncomingInvites((p) => p.filter((x) => x !== env.payload.from));
          break;

        case "sprite_change": {
          const { id, sprite } = env.payload;
          if (playersRef.current[id]) {
            playersRef.current[id] = { ...playersRef.current[id], sprite };
          }
          break;
        }

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
      // base = backend domain (prod: VITE_API_URL) หรือ same-origin (dev: ผ่าน Vite proxy)
      // http→ws, https→wss อัตโนมัติ → ใช้ wss ได้เมื่อหน้าเว็บเป็น https
      const apiBase = import.meta.env.VITE_API_URL || `${location.protocol}//${location.host}`;
      const wsBase = apiBase.replace(/^http/, "ws");
      const ws = new WebSocket(
        `${wsBase}/ws?room=${encodeURIComponent(roomRef.current)}` +
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
        setPresence({}); // presence จะมาใหม่จาก snapshot ตอน join
        setIncomingInvites([]);
        setOutgoingInvites([]);
        setBoards({});
        setTasks({});
        // แชต: ล้างของเดิม + เคลียร์ mid ที่เคยเห็น → backend ส่งประวัติกลับมาตอน join (repopulate)
        seenMidsRef.current = new Set();
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
        // ประตูแนวตั้ง (x1===x2, ซ้าย/ขวา) → พา y ไป, x ใช้ฝั่งตรงข้าม
        // ประตูแนวนอน (canteen บน/ล่าง)  → พา x ไป, y ใช้ฝั่งตรงข้าม
        const isVertical = door.x1 === door.x2;
        switchRoom(door.to, {
          x: isVertical ? door.spawn.x : cell.x,
          y: isVertical ? cell.y : door.spawn.y,
        });

        return;
      }

      // ชนผนังบน (ที่ไม่ใช่ประตู) → ไม่ขยับ — เช็คหลังประตู เพื่อให้ "เดินชนผนังเข้าประตู" ได้
      if (cell.y < FLOOR_ROW) {
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
    const playerLayer = pixiCanvasRef.current
      ? createPlayerLayer(pixiCanvasRef.current, { onPlayerClick: invite })
      : null;
    playerLayerRef.current = playerLayer;

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

    // เปิดสายอัตโนมัติเฉพาะโหมด "auto"; โหมด "invite" ไม่แตะ proximity (ต้องเชิญ+ยินยอม)
    const prox = setInterval(() => {
      if (modeRef.current === "auto") video.syncProximity(PROXIMITY);
    }, 500);

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
  // PRESENCE (จาก server) + รายงานสถานะ in-call ของเราเอง
  // =========================

  // onlineIds / inCallIds derive จาก presence map (server เป็น source of truth ข้ามห้อง)
  const onlineIds = Object.keys(presence);
  const inCallIds = onlineIds.filter((id) => presence[id].in_call);

  // เรา in-call เมื่อมี tile กล้องตัวเอง → รายงาน server ตอนสถานะเปลี่ยน (เปิด/ปิดวิดีโอ)
  const inCall = videos.some((v) => v.me);
  const prevInCallRef = useRef(false);
  useEffect(() => {
    if (inCall === prevInCallRef.current) return;
    prevInCallRef.current = inCall;
    send("call_status", { in_call: inCall });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCall]);

  // =========================
  // VIDEO CALL (เปิดสายเอง → เชิญ → ปลายทางยินยอม)
  // =========================

  // สลับโหมด auto/invite — อัปเดต ref (ให้ proximity loop อ่านได้) พร้อม state
  const setVideoMode = (m: "invite" | "auto"): void => {
    modeRef.current = m;
    setVideoModeState(m);
  };

  const startVideo = (): void => {
    videoCtrlRef.current?.openCamera();
  };

  const leaveVideo = (): void => {
    videoCtrlRef.current?.leaveCall();
    setOutgoingInvites([]);
  };

  // เชิญผู้เล่นคนอื่นเข้าสาย (เรียกจากคลิก avatar) — เปิดกล้องเราก่อนถ้ายังไม่เปิด
  function invite(id: string): void {
    if (!id || id === myIdRef.current) return;
    videoCtrlRef.current?.openCamera();
    send("call_invite", { to: id });
    setOutgoingInvites((p) => (p.includes(id) ? p : [...p, id]));
  }

  const acceptInvite = (from: string): void => {
    send("call_accept", { to: from });
    videoCtrlRef.current?.openCamera();
    videoCtrlRef.current?.startCall(from);
    setIncomingInvites((p) => p.filter((x) => x !== from));
  };

  const rejectInvite = (from: string): void => {
    send("call_reject", { to: from });
    setIncomingInvites((p) => p.filter((x) => x !== from));
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

  const setMySprite = (key: SpriteKey) => {
    playerLayerRef.current?.setMySprite(key);
    send("sprite_change", { sprite: key });
  };

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
    inCallIds,
    playerRooms,
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
    switchRoom,
    setMySprite,
  };
}
