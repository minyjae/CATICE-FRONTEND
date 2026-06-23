import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// กัน "จอขาว" — ถ้า render พัง (เช่น hot-patch ของ HMR ล้มเหลว) ให้โชว์ error + ปุ่มรีโหลด
// แทนที่จะ unmount ทั้งต้นไม้จนจอว่างเปล่า
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="err-boundary">
          <h2>เกิดข้อผิดพลาด</h2>
          <pre>{this.state.error.message}</pre>
          <div className="err-actions">
            <button className="submit-sm" onClick={() => this.setState({ error: null })}>
              ลองอีกครั้ง
            </button>
            <button className="ghost" onClick={() => location.reload()}>
              รีโหลดหน้า
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
