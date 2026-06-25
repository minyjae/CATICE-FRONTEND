/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string; // base URL ของ backend (prod คนละโดเมน); dev เว้นว่าง = ใช้ Vite proxy
}
