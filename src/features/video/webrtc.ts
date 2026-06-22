// ตั้งค่า WebRTC ระดับล่างสุด — ที่เดียวที่กำหนด ICE/STUN server
export const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}
