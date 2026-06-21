import { useEffect, useState } from "react";
import AuthForm from "./features/auth/AuthForm.jsx";
import Office from "./features/office/Office.jsx";
import { fetchMe, setOnUnauthorized } from "./features/auth/api.js";

// composition root + auth gate
// undefined = กำลังเช็ค, null = ยังไม่ login, object = user ที่ login แล้ว
export default function App() {
  const [me, setMe] = useState(undefined);

  const loadMe = () => fetchMe().then(setMe);
  // token ใน storage หมดอายุ/ใช้ไม่ได้ (request ใด ๆ ได้ 401) → เด้งกลับหน้า login
  useEffect(() => { setOnUnauthorized(() => setMe(null)); }, []);
  // ตอนเปิดแอป: fetchMe จะยิง /me พร้อม Bearer ก็ต่อเมื่อมี token ในที่เก็บ (ไม่มี → null = ยังไม่ login)
  useEffect(() => { loadMe(); }, []);

  if (me === undefined) return null;                  // กำลังเช็ค auth
  if (!me) return <AuthForm onAuthed={loadMe} />;     // ยังไม่ login → หน้า auth
  return <Office me={me} onLogout={() => setMe(null)} />; // login แล้ว → office
}
