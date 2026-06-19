// เรียก auth endpoints ของ backend Go (ผ่าน Vite proxy ตอน dev) — ที่เดียวที่รู้จัก URL เหล่านี้
// backend เป็น JWT แบบ stateless: ไม่มี cookie session แล้ว ต้องแนบ Authorization: Bearer <token> เอง
import { getToken, setToken, clearToken } from "./token.js";

// App ลงทะเบียน handler ไว้ที่นี่ → โดน 401 ที่ไหนก็เด้งกลับหน้า login ที่เดียว
let onUnauthorized = null;
export function setOnUnauthorized(fn) { onUnauthorized = fn; }

// fetch wrapper: แนบ Bearer ให้อัตโนมัติเมื่อมี token, และถ้าได้ 401 → ลบ token + แจ้ง App ให้กลับไป login
async function authFetch(url, opts = {}) {
  const t = getToken();
  const headers = { ...opts.headers };
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) {
    clearToken();
    onUnauthorized?.();
  }
  return res;
}

// คืน user object ถ้า login อยู่, คืน null ถ้ายัง/พลาด — App ใช้แยกสถานะ auth
// ไม่มี token ก็ไม่ต้องยิง (กัน 401 โดยไม่จำเป็น)
export async function fetchMe() {
  if (!getToken()) return null;
  try {
    const r = await authFetch("/me");
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// รายชื่อ user ที่สมัครทั้งหมด [{ id, name, role }] — ใช้ทำ selector ผู้รับมอบหมาย task
// คืน [] ถ้าพลาด (ยังไม่ login / backend ล่ม) เพื่อให้ฟอร์มยังเปิดได้
export async function fetchUsers() {
  try {
    const r = await authFetch("/users");
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

export function login(email, password) {
  return post("/login", { email, password });
}

export function register(email, role, password) {
  return post("/register", { email, role, password });
}

// stateless logout: server ไม่ revoke token — การ logout จริงคือ frontend ลบ token ทิ้งเอง
// ยังเรียก /logout ไว้แบบ best-effort แต่ไม่รอ/ไม่พึ่งผลในการเคลียร์ session
export async function logout() {
  clearToken();
  try {
    await fetch("/logout", { method: "POST" });
  } catch {
    /* ไม่เป็นไร — token ฝั่งเราลบแล้ว ถือว่า logout สำเร็จ */
  }
}

// POST JSON แล้วคืน { ok, data } ให้ caller ตัดสินใจเรื่องข้อความ/flow เอง
// login/register สำเร็จจะมี data.token (JWT) มาด้วย → เก็บไว้เลยที่นี่
async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.token) setToken(data.token);
  return { ok: res.ok, data };
}
