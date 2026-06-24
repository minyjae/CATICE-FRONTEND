import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { login, register } from "./api";
import { ROLES } from "./roles";

import { loginSchema, registerSchema } from "../../shared/form-validation";
import { randomSpriteKey, saveMySprite } from "../office/canvas/spriteConfig";

interface AuthFormProps {
  onAuthed: () => void;
}

type Tab = "login" | "register";
interface Msg {
  text: string;
  ok: boolean;
}
interface FormState {
  email: string;
  password: string;
  confirm: string;
  role: string;
}

export default function AuthForm({ onAuthed }: AuthFormProps) {
  const [tab, setTab] = useState<Tab>("login"); // login | register
  const [msg, setMsg] = useState<Msg | null>(null);
  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    confirm: "",
    role: "developer",
  });
  const set =
    (k: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      // ล้าง error ของ field นั้นทันทีที่ผู้ใช้แก้ไข
      setErrors((prev) => ({ ...prev, [k]: undefined }));
    };
  const switchTab = (t: Tab) => {
    setTab(t);
    setMsg(null);
    setErrors({});
    setForm({
      email: "",
      password: "",
      confirm: "",
      role: "developer",
    });
  };
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});

  async function submit(e: FormEvent) {
    e.preventDefault();

    const validation =
      tab === "login"
        ? loginSchema.safeParse({
            email: form.email,
            password: form.password,
          })
        : registerSchema.safeParse({
            email: form.email,
            password: form.password,
            confirm: form.confirm,
            role: form.role,
          });

    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors as Record<string, string[] | undefined>;

      setErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        confirm: fieldErrors.confirm?.[0],
        role: fieldErrors.role?.[0],
      });

      return;
    }
    try {
      const { ok, data } =
        tab === "login"
          ? await login(form.email, form.password)
          : await register(form.email, form.role, form.password);
      if (ok) {
        if (tab === "register") saveMySprite(randomSpriteKey());
        setMsg({ text: "สำเร็จ! กำลังเข้า…", ok: true });
        onAuthed();
      } else setMsg({ text: data.message || "เกิดข้อผิดพลาด", ok: false });
    } catch {
      setMsg({ text: "ติดต่อเซิร์ฟเวอร์ไม่ได้", ok: false });
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card" onSubmit={submit}>
        <h1>🐱 Catice</h1>
        <div className="sub">Virtual Office · เดินคุยกันแบบ real-time</div>

        <div className="tabs">
          <button
            type="button"
            className={tab === "login" ? "active" : ""}
            onClick={() => switchTab("login")}
          >
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            className={tab === "register" ? "active" : ""}
            onClick={() => switchTab("register")}
          >
            สมัครสมาชิก
          </button>
        </div>

        <label>อีเมล</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={set("email")}
          autoComplete="email"
        />
        {errors.email && <div className="field-error">{errors.email}</div>}

        {tab === "register" && (
          <>
            <label>ตำแหน่ง</label>
            <select value={form.role} onChange={set("role")}>
              {ROLES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {errors.role && <div className="field-error">{errors.role}</div>}
          </>
        )}

        <label>รหัสผ่าน</label>
        <input
          type="password"
          required
          value={form.password}
          onChange={set("password")}
          autoComplete={tab === "login" ? "current-password" : "new-password"}
        />
        {errors.password && <div className="field-error">{errors.password}</div>}

        {tab === "register" && (
          <>
            <label>ยืนยันรหัสผ่าน</label>
            <input
              type="password"
              required
              value={form.confirm}
              onChange={set("confirm")}
              autoComplete="new-password"
            />
            {/* real-time: แสดงทันทีที่พิมพ์ไม่ตรงกัน (ไม่ต้องรอ submit) */}
            {form.confirm && form.password !== form.confirm && (
              <div className="field-error">รหัสผ่านไม่ตรงกัน</div>
            )}
            {errors.confirm && form.password === form.confirm && (
              <div className="field-error">{errors.confirm}</div>
            )}
          </>
        )}

        <button className="submit" type="submit">
          {tab === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </button>
        {msg && (
          <div className={"msg " + (msg.ok ? "ok" : "error")}>{msg.text}</div>
        )}
      </form>
    </div>
  );
}
