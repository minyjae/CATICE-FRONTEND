// วิดีโอของคนที่อยู่ใกล้ (videos = [{ id, stream, me }]) — เป็นแถว flex เหนือ stage
// ถ้าไม่มีวิดีโอของคนอื่นเลย (มีแค่ตัวเอง หรือว่างเปล่า) ให้ซ่อนแถบไป stage จะได้ยืดเต็ม
export default function VideoPanel({ videos }) {
  if (videos.filter((v) => !v.me).length < 1) return null;
  return (
    <div className="video-bar">
      {videos.map((v) => (
        <video
          key={v.id}
          className={v.me ? "me" : ""}
          autoPlay
          playsInline
          muted={v.me}
          ref={(el) => { if (el && el.srcObject !== v.stream) el.srcObject = v.stream; }}
        />
      ))}
    </div>
  );
}
