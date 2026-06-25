// ตั้งค่า WebRTC ระดับล่างสุด — ที่เดียวที่กำหนด ICE/STUN server
const stunUrl = import.meta.env.VITE_STUN_URL ?? "stun:stun.l.google.com:19302";

const iceServers: RTCIceServer[] = [{ urls: stunUrl }];

if (import.meta.env.VITE_TURN_URL) {
  iceServers.push({
    urls: import.meta.env.VITE_TURN_URL,
    username: import.meta.env.VITE_TURN_USER,
    credential: import.meta.env.VITE_TURN_CRED,
  });
}

export const ICE_SERVERS: RTCIceServer[] = iceServers;

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}
