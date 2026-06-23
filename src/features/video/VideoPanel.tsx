import type { VideoTile } from "./videoController";

interface VideoPanelProps {
  videos: VideoTile[];
}

// วิดีโอในสาย (videos = [{ id, stream, me }]) — เป็นแถว flex เหนือ stage
// แสดงตั้งแต่ "เริ่มวิดีโอ" (มี tile ตัวเอง) แม้ยังไม่มี peer; ว่างจริงค่อยซ่อนให้ stage ยืดเต็ม
export default function VideoPanel({ videos }: VideoPanelProps) {
  if (videos.length === 0) return null;
  return (
    <div className="video-bar">
      {videos.map((v) => (
        <video
          key={v.id}
          className={v.me ? "me" : ""}
          autoPlay
          playsInline
          muted={v.me}
          ref={(el) => {
            if (el && el.srcObject !== v.stream) el.srcObject = v.stream;
          }}
        />
      ))}
    </div>
  );
}
