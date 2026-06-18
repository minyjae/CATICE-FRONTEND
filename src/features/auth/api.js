// เรียก auth endpoints ของ backend Go (ผ่าน Vite proxy ตอน dev) — ที่เดียวที่รู้จัก URL เหล่านี้
const SAME_ORIGIN = { credentials: "same-origin" };

// คืน user object ถ้า login อยู่, คืน null ถ้ายัง/พลาด — App ใช้แยกสถานะ auth
export async function fetchMe() {
  try {
    const r = await fetch("/me", SAME_ORIGIN);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// รายชื่อ user ที่สมัครทั้งหมด [{ id, name, role }] — ใช้ทำ selector ผู้รับมอบหมาย task
// คืน [] ถ้าพลาด (ยังไม่ login / backend ล่ม) เพื่อให้ฟอร์มยังเปิดได้
export async function fetchUsers() {
  try {
    const r = await fetch("/users", SAME_ORIGIN);
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

export async function logout() {
  await fetch("/logout", { method: "POST", ...SAME_ORIGIN });
}

// POST JSON แล้วคืน { ok, data } ให้ caller ตัดสินใจเรื่องข้อความ/flow เอง
async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...SAME_ORIGIN,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}
