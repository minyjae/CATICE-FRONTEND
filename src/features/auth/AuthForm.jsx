import { useState } from "react";
import { login, register } from "./api.js";
import { ROLES } from "./roles.js";

export default function AuthForm({ onAuthed }) {
  const [tab, setTab] = useState("login"); // login | register
  const [msg, setMsg] = useState(null); // { text, ok }
  const [form, setForm] = useState({ email: "", password: "", confirm: "", role: "developer" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const switchTab = (t) => { setTab(t); setMsg(null); };

  async function submit(e) {
    e.preventDefault();
    if (tab === "register" && form.password !== form.confirm) {
      return setMsg({ text: "รหัสผ่านไม่ตรงกัน", ok: false });
    }
    try {
      const { ok, data } = tab === "login"
        ? await login(form.email, form.password)
        : await register(form.email, form.role, form.password);
      if (ok) { setMsg({ text: "สำเร็จ! กำลังเข้า…", ok: true }); onAuthed(); }
      else setMsg({ text: data.message || "เกิดข้อผิดพลาด", ok: false });
    } catch {
      setMsg({ text: "ติดต่อเซิร์ฟเวอร์ไม่ได้", ok: false });
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card" onSubmit={submit}>
        <h1>🐱 Catice2</h1>
        <div className="sub">Virtual Office · เดินคุยกันแบบ real-time</div>

        <div className="tabs">
          <button type="button" className={tab === "login" ? "active" : ""} onClick={() => switchTab("login")}>เข้าสู่ระบบ</button>
          <button type="button" className={tab === "register" ? "active" : ""} onClick={() => switchTab("register")}>สมัครสมาชิก</button>
        </div>

        <label>อีเมล</label>
        <input type="email" required value={form.email} onChange={set("email")} autoComplete="email" />

        {tab === "register" && (
          <>
            <label>ตำแหน่ง</label>
            <select value={form.role} onChange={set("role")}>
              {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </>
        )}

        <label>รหัสผ่าน</label>
        <input type="password" required value={form.password} onChange={set("password")} autoComplete={tab === "login" ? "current-password" : "new-password"} />

        {tab === "register" && (
          <>
            <label>ยืนยันรหัสผ่าน</label>
            <input type="password" required value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
          </>
        )}

        <button className="submit" type="submit">{tab === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</button>
        {msg && <div className={"msg " + (msg.ok ? "ok" : "error")}>{msg.text}</div>}
      </form>
    </div>
  );
}
