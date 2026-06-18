import { createPeerConnection } from "./webrtc.js";

// ตัวจัดการสายวิดีโอแบบ proximity (WebRTC) — เป็น controller ธรรมดา ไม่ใช่ React hook
// เพื่อให้ effect ของ useRoom คุม lifecycle (เปิด/ปิด/cleanup) ได้ตามลำดับที่แน่นอน
//
// รับ refs/ฟังก์ชันจาก useRoom:
//   playersRef, myIdRef — สถานะผู้เล่นปัจจุบัน (อ่านอย่างเดียว)
//   send                — ส่งข้อความผ่าน WebSocket
//   setVideos           — อัปเดต state รายการวิดีโอให้ React render
export function createVideoController({ playersRef, myIdRef, send, setVideos }) {
  const peers = {}; // id -> RTCPeerConnection | "pending"
  let localStream = null;

  const sendSignal = (to, data) => send("signal", { to, data });
  const showVideo = (id, stream, me) =>
    setVideos((v) => (v.some((x) => x.id === id) ? v : [...v, { id, stream, me }]));
  const removeVideo = (id) => setVideos((v) => v.filter((x) => x.id !== id));

  async function ensureLocalStream() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    showVideo("me", localStream, true);
    return localStream;
  }

  function createPeer(peerId) {
    const pc = createPeerConnection();
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    pc.onicecandidate = (ev) => { if (ev.candidate) sendSignal(peerId, { candidate: ev.candidate }); };
    pc.ontrack = (ev) => showVideo(peerId, ev.streams[0], false);
    return pc;
  }

  async function startCall(peerId) {
    if (peers[peerId]) return;
    peers[peerId] = "pending";
    try {
      await ensureLocalStream();
      const pc = createPeer(peerId);
      peers[peerId] = pc;
      // ฝั่ง id น้อยกว่าเป็นคน createOffer เพื่อกัน glare (ทั้งคู่ยื่น offer พร้อมกัน)
      if (myIdRef.current < peerId) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal(peerId, { sdp: pc.localDescription });
      }
    } catch (err) { console.warn("เปิดสายไม่ได้:", err); delete peers[peerId]; }
  }

  async function handleSignal({ from, data }) {
    try {
      await ensureLocalStream();
      let pc = peers[from];
      if (!pc || pc === "pending") { pc = createPeer(from); peers[from] = pc; }
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === "offer") {
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          sendSignal(from, { sdp: pc.localDescription });
        }
      } else if (data.candidate) {
        await pc.addIceCandidate(data.candidate);
      }
    } catch (err) { console.warn("signal error:", err); }
  }

  function endCall(peerId) {
    const pc = peers[peerId];
    if (pc && pc.close) pc.close();
    delete peers[peerId];
    removeVideo(peerId);
  }

  // เช็คระยะ (Chebyshev) ทุกคน: ใกล้แล้วยังไม่มีสาย → เปิด, ไกลแล้วมีสาย → ปิด
  // เรียกซ้ำ ๆ จาก setInterval ใน useRoom
  function syncProximity(proximity) {
    const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    const meP = playersRef.current[myIdRef.current];
    if (!meP) return;
    for (const id in playersRef.current) {
      if (id === myIdRef.current) continue;
      const near = dist(meP, playersRef.current[id]) <= proximity;
      if (near && !peers[id]) startCall(id);
      if (!near && peers[id]) endCall(id);
    }
    for (const id in peers) if (!playersRef.current[id]) endCall(id);
  }

  // ปิดทุกสาย + ปิดกล้อง/ไมค์ ตอน unmount
  function destroy() {
    Object.keys(peers).forEach(endCall);
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
  }

  return { handleSignal, endCall, syncProximity, destroy };
}
