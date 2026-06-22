// เก็บ JWT ของผู้ใช้ — backend เป็น stateless (ไม่มี cookie session แล้ว) frontend ต้องถือ token เอง
// เก็บใน localStorage ให้รอด reload + cache ใน memory เพื่ออ่านเร็ว ๆ ระหว่าง render/WS
const KEY = "catice_token";

let token: string | null = localStorage.getItem(KEY) || null;

export const getToken = (): string | null => token;

export function setToken(t: string | null): void {
  token = t || null;
  if (token) localStorage.setItem(KEY, token);
  else localStorage.removeItem(KEY);
}

export const clearToken = (): void => setToken(null);
