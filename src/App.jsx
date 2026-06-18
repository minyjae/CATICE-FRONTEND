import { useEffect, useState } from "react";
import AuthForm from "./features/auth/AuthForm.jsx";
import Office from "./features/office/Office.jsx";
import { fetchMe } from "./features/auth/api.js";

// composition root + auth gate
// undefined = กำลังเช็ค, null = ยังไม่ login, object = user ที่ login แล้ว
export default function App() {
  const [me, setMe] = useState(undefined);

  const loadMe = () => fetchMe().then(setMe);
  useEffect(() => { loadMe(); }, []);

  if (me === undefined) return null;                  // กำลังเช็ค auth
  if (!me) return <AuthForm onAuthed={loadMe} />;     // ยังไม่ login → หน้า auth
  return <Office me={me} onLogout={() => setMe(null)} />; // login แล้ว → office
}
