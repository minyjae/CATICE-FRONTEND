import type { Dispatch, RefObject, SetStateAction } from "react";
import { createPeerConnection } from "./webrtc";
import type { Player, Send, SignalData } from "../../shared/protocol";

// แถววิดีโอ 1 ช่อง (ตัวเอง me=true / peer me=false) — frontend-only (มี MediaStream)
export interface VideoTile {
  id: string;
  stream: MediaStream;
  me: boolean;
}

interface VideoControllerDeps {
  playersRef: RefObject<Record<string, Player>>;
  myIdRef: RefObject<string | null>;
  send: Send;
  setVideos: Dispatch<SetStateAction<VideoTile[]>>;
}

// ตัวจัดการสายวิดีโอแบบ proximity (WebRTC) — เป็น controller ธรรมดา ไม่ใช่ React hook
// เพื่อให้ effect ของ useRoom คุม lifecycle (เปิด/ปิด/cleanup) ได้ตามลำดับที่แน่นอน
export function createVideoController({ playersRef, myIdRef, send, setVideos }: VideoControllerDeps) {
  const peers: Record<string, RTCPeerConnection | "pending"> = {}; // id -> pc | "pending"
  let localStream: MediaStream | null = null;

  const sendSignal = (to: string, data: SignalData) => send("signal", { to, data });
  const showVideo = (id: string, stream: MediaStream, me: boolean) =>
    setVideos((v) => (v.some((x) => x.id === id) ? v : [...v, { id, stream, me }]));
  const removeVideo = (id: string) => setVideos((v) => v.filter((x) => x.id !== id));

  async function ensureLocalStream(): Promise<MediaStream> {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    showVideo("me", localStream, true);
    return localStream;
  }

  function createPeer(peerId: string, stream: MediaStream): RTCPeerConnection {
    const pc = createPeerConnection();
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onicecandidate = (ev) => {
      if (ev.candidate) sendSignal(peerId, { candidate: ev.candidate });
    };
    pc.ontrack = (ev) => showVideo(peerId, ev.streams[0], false);
    return pc;
  }

  async function startCall(peerId: string): Promise<void> {
    if (peers[peerId]) return;
    peers[peerId] = "pending";
    try {
      const stream = await ensureLocalStream();
      const pc = createPeer(peerId, stream);
      peers[peerId] = pc;
      // ฝั่ง id น้อยกว่าเป็นคน createOffer เพื่อกัน glare (ทั้งคู่ยื่น offer พร้อมกัน)
      if (myIdRef.current && myIdRef.current < peerId) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (pc.localDescription) sendSignal(peerId, { sdp: pc.localDescription });
      }
    } catch (err) {
      console.warn("เปิดสายไม่ได้:", err);
      delete peers[peerId];
    }
  }

  async function handleSignal({ from, data }: { from: string; data: SignalData }): Promise<void> {
    try {
      const stream = await ensureLocalStream();
      let pc = peers[from];
      if (!pc || pc === "pending") {
        pc = createPeer(from, stream);
        peers[from] = pc;
      }
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === "offer") {
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          if (pc.localDescription) sendSignal(from, { sdp: pc.localDescription });
        }
      } else if (data.candidate) {
        await pc.addIceCandidate(data.candidate);
      }
    } catch (err) {
      console.warn("signal error:", err);
    }
  }

  function endCall(peerId: string): void {
    const pc = peers[peerId];
    if (pc && pc !== "pending") pc.close();
    delete peers[peerId];
    removeVideo(peerId);
  }

  // เช็คระยะ (Chebyshev) ทุกคน: ใกล้แล้วยังไม่มีสาย → เปิด, ไกลแล้วมีสาย → ปิด
  // เรียกซ้ำ ๆ จาก setInterval ใน useRoom
  function syncProximity(proximity: number): void {
    const dist = (a: Player, b: Player) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    const myId = myIdRef.current;
    if (!myId) return;
    const meP = playersRef.current[myId];
    if (!meP) return;
    for (const id in playersRef.current) {
      if (id === myId) continue;
      const near = dist(meP, playersRef.current[id]) <= proximity;
      if (near && !peers[id]) startCall(id);
      if (!near && peers[id]) endCall(id);
    }
    for (const id in peers) if (!playersRef.current[id]) endCall(id);
  }

  // ปิดทุกสายกับ peer (ใช้ตอนย้ายห้องบน socket เดิม) — คงกล้อง/ไมค์ตัวเอง (tile "me") ไว้
  // เพราะห้องใหม่จะเริ่มจับคู่สายใหม่ได้เลยโดยไม่ต้องขอ getUserMedia ซ้ำ
  function endAllCalls(): void {
    Object.keys(peers).forEach(endCall);
  }

  // ออกจากสายทั้งหมด + ปิดกล้อง/ไมค์ (วางสายแบบตั้งใจ) — ต่างจาก endAllCalls ที่คงกล้องไว้
  function leaveCall(): void {
    endAllCalls();
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    setVideos([]);
  }

  // เปิดกล้อง/ไมค์ + โชว์ tile ตัวเอง (ใช้ตอน "เริ่มวิดีโอ" ก่อนเชิญใคร)
  const openCamera = () => ensureLocalStream();

  // ปิดทุกสาย + ปิดกล้อง/ไมค์ ตอน unmount
  function destroy(): void {
    endAllCalls();
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
  }

  return { handleSignal, startCall, openCamera, endCall, endAllCalls, leaveCall, syncProximity, destroy };
}

export type VideoController = ReturnType<typeof createVideoController>;
