# Logic การทำ Unread / Unseen ของแชต

อธิบายวิธีที่ [ChatPanel.tsx](../src/features/chat/ChatPanel.tsx) ตรวจจับ "ข้อความใหม่ที่ยังไม่ได้อ่าน" แล้วโชว์จุดแดง (unread dot) ทั้งบน **แท็บ** (ส่วนตัว / ห้องนี้ / ทั้งหมด) และบน **การ์ดคู่สนทนา** ในแท็บส่วนตัว

---

## 1. หลักการรวม

แชตเป็น **single source of truth = server**: ทุกข้อความ (รวมของเราเอง) มาจาก WebSocket broadcast แล้วถูกเก็บใน state ที่ [useRoom.ts](../src/features/office/useRoom.ts) — `roomMsgs`, `allMsgs`, `privateMsgs`. ChatPanel เป็นแค่ฝั่งแสดงผล

แทนที่จะ "ตั้ง flag ตอนรับ message" (ซึ่ง ChatPanel ทำไม่ได้ เพราะมันไม่ได้เป็นคนรับ socket) เราใช้วิธี **เทียบจำนวนข้อความ (count diff)**:

> เก็บไว้ว่า "เห็นแล้วกี่ข้อความ" ต่อแต่ละกล่อง → พอ React re-render เพราะ prop ข้อความเปลี่ยน เราเทียบ `ความยาวปัจจุบัน > จำนวนที่เห็นแล้ว` ก็รู้ว่ามีของใหม่เข้ามา

เพราะ list เป็น append-only (ไม่ลบข้อความ) การเทียบความยาวจึงเชื่อถือได้

**กติกาว่าเมื่อไรนับเป็น unread** (ใช้ร่วมกันทุกกล่อง):
1. มีข้อความใหม่จริง (`length > seen`)
2. ข้อความล่าสุด **ไม่ใช่ของเราเอง** (`last.id !== myId`) — กัน echo ของตัวเองมาเด้ง unread
3. ผู้ใช้ **ไม่ได้กำลังดูกล่องนั้นอยู่** (ไม่ได้เปิดแท็บ/thread นั้น)

---

## 2. State & refs ที่เกี่ยวข้อง

```ts
// แท็บ/มุมมองที่เปิดอยู่
const [tab, setTab] = useState<ChatScope>("room");        // แท็บปัจจุบัน
const [openThread, setOpenThread] = useState<string|null>(null); // thread ส่วนตัวที่เปิด (null = หน้ารายการ)

// ตัวเก็บสถานะ unread
const [unread, setUnread] = useState<Record<string, boolean>>({}); // ส่วนตัว: ราย userId
const [roomUnread, setRoomUnread] = useState(false);      // แท็บ "ห้องนี้"
const [allUnread, setAllUnread] = useState(false);        // แท็บ "ทั้งหมด"

// "เห็นแล้วกี่ข้อความ" — เก็บใน ref เพราะไม่ต้อง re-render เวลาอัปเดต
const seenCounts = useRef<Record<string, number>>({});    // ส่วนตัว: ราย userId
const seenRoom = useRef(0);
const seenAll = useRef(0);
```

ทำไม `seen*` เป็น **ref** ไม่ใช่ state: มันเป็นข้อมูลภายในของ algorithm (bookkeeping) ไม่ได้ใช้ render โดยตรง — ถ้าเป็น state จะ re-render ฟรี ๆ และทำให้ effect loop

---

## 3. แชตส่วนตัว (per-thread unread)

`privateMsgs: Record<otherUserId, ChatMsg[]>` — แยก thread ตาม "อีกฝั่ง" ของคู่สนทนา

### 3.1 ตั้ง unread เมื่อมีข้อความใหม่

```ts
useEffect(() => {
  const newly: string[] = [];
  for (const [uid, msgs] of Object.entries(privateMsgs)) {
    const prev = seenCounts.current[uid] ?? 0;
    seenCounts.current[uid] = msgs.length;          // อัปเดต "เห็นแล้ว" เสมอ
    if (msgs.length > prev) {                        // (1) มีของใหม่
      const last = msgs[msgs.length - 1];
      if (last.id !== myId && openThread !== uid)    // (2) ไม่ใช่ของเรา + (3) ไม่ได้เปิด thread นี้
        newly.push(uid);
    }
  }
  if (newly.length) setUnread(u => { /* ...set true ทุก uid ใน newly... */ });
}, [privateMsgs, myId, openThread]);
```

- effect รันทุกครั้งที่ `privateMsgs` (หรือ `openThread`) เปลี่ยน
- วน **ทุก thread** เทียบ count → thread ไหนยาวขึ้น = มีของใหม่
- `seenCounts.current[uid]` ถูกอัปเดต **ทุกครั้ง** (ไม่ว่าจะ mark unread หรือไม่) → ไม่นับซ้ำ
- `openThread !== uid`: ถ้ากำลังเปิดอ่าน thread นั้นอยู่พอดี ข้อความใหม่ถือว่า "อ่านแล้ว" ไม่ต้องขึ้น unread

> หมายเหตุ: `openThread` อยู่ใน dependency array เพราะ ESLint (`react-hooks`) ห้ามอ่าน ref ที่ตั้งระหว่าง render — เราจึงอ่าน `openThread` (state) ตรง ๆ แล้วใส่ใน deps การที่ effect รันซ้ำตอน `openThread` เปลี่ยนไม่เป็นไร เพราะ count ไม่ได้เพิ่ม → ไม่ mark อะไรใหม่

### 3.2 เคลียร์ unread เมื่อเปิดอ่าน

```ts
const openDm = (uid: string) => {
  setOpenThread(uid);
  setUnread(u => (u[uid] ? { ...u, [uid]: false } : u)); // เคลียร์เฉพาะ thread นี้
};
```

เรียกจาก 2 ที่: คลิกการ์ดในรายการ, และจาก `dmRequest` (คลิกชื่อใน MembersPanel)

### 3.3 เปิด thread จากภายนอก (คลิกสมาชิก)

```ts
useEffect(() => {
  if (!dmRequest) return;
  setTab("private");
  setOpenThread(dmRequest.id);
  setUnread(u => (u[dmRequest.id] ? { ...u, [dmRequest.id]: false } : u));
}, [dmRequest]);
```

`dmRequest = { id, n }` โดย `n` เป็น nonce — ทำให้คลิกคนเดิมซ้ำก็ยัง trigger effect ได้

---

## 4. แท็บ "ห้องนี้" / "ทั้งหมด"

หลักการเดียวกัน แต่กล่องเดียวต่อแท็บ (ไม่แยกราย thread):

```ts
useEffect(() => {
  const fresh = (list, seen) => {
    const last = list[list.length - 1];
    return list.length > seen && !!last && last.id !== myId; // (1)+(2)
  };
  // (3) ถ้ากำลังเปิดแท็บนั้น → เคลียร์; ถ้าไม่ → เช็คของใหม่
  if (tab === "room") setRoomUnread(false);
  else if (fresh(roomMsgs, seenRoom.current)) setRoomUnread(true);
  seenRoom.current = roomMsgs.length;

  if (tab === "all") setAllUnread(false);
  else if (fresh(allMsgs, seenAll.current)) setAllUnread(true);
  seenAll.current = allMsgs.length;
}, [roomMsgs, allMsgs, tab, myId]);
```

ต่างจากส่วนตัวตรงที่ unread เป็น **boolean** (มี/ไม่มีของใหม่) ไม่ได้นับจำนวน — พอเปิดแท็บก็เคลียร์เป็น `false`

---

## 5. การแสดงผล

### จุดแดงบนแท็บ
```ts
const hasUnread = Object.values(unread).some(Boolean); // ส่วนตัวมี thread ไหน unread ไหม
const tabUnread = { private: hasUnread, room: roomUnread, all: allUnread };
// ใน TABS.map:
{v !== tab && tabUnread[v] && <span className="tab-dot" />}
```
`v !== tab`: ไม่โชว์จุดบนแท็บที่เปิดอยู่ (กันจุดค้างแวบเดียวก่อน effect เคลียร์)

### จุดแดง + ข้อความล่าสุดบนการ์ด (แท็บส่วนตัว)
แต่ละการ์ดอ่าน `unread[u.id]` ตรง ๆ → โชว์ `.dm-unread-dot` และเน้นตัวหนาที่ข้อความล่าสุด

---

## 6. Edge cases

| กรณี | พฤติกรรม | เหตุผล |
|---|---|---|
| ข้อความที่เราส่งเอง (echo กลับจาก server) | **ไม่** ขึ้น unread | กติกา (2) `last.id !== myId` |
| กำลังเปิดอ่าน thread/แท็บนั้นพอดีตอนข้อความเข้า | **ไม่** ขึ้น unread, นับเป็นเห็นแล้วทันที | กติกา (3) |
| ข้อความเข้า thread A ขณะเปิด thread B | thread A ขึ้น unread (การ์ด + จุดบนแท็บ) | `openThread (B) !== A` |
| สลับห้อง (`roomMsgs` เปลี่ยนชุด) | อาจขึ้นจุดบนแท็บ "ห้องนี้" ถ้าห้องใหม่มีแชตเก่าค้างมากกว่า seen | minor — จุดแค่บอก "มีของในห้องนี้" |
| reconnect | `useRoom` ล้าง `privateMsgs/roomMsgs/allMsgs` หมด → ทุก list สั้นลง, ไม่ trigger unread | count ลดลงไม่เข้าเงื่อนไข (1) |

---

## 7. ทำไมไม่ "ตั้ง flag ตอนรับ message"

เพราะ socket ถูกรับที่ `useRoom` (ชั้น hook) ส่วน "ผู้ใช้กำลังดูแท็บ/thread ไหน" เป็น UI state ใน `ChatPanel` การจะตั้ง unread ตอนรับ ต้องส่งข้อมูล "แท็บที่เปิด" ลงไปถึง useRoom ซึ่งทำให้ layer ปนกัน

วิธี **count diff ที่ฝั่ง ChatPanel** แยกความรับผิดชอบสะอาดกว่า: useRoom รู้แค่ "ข้อมูลแชต", ChatPanel รู้ "ผู้ใช้กำลังดูอะไร" แล้วคำนวณ unread เองจากการเทียบ snapshot ก่อน/หลัง

ข้อแลกเปลี่ยน: ChatPanel ต้องจำ `seen*` เอง และ logic ผูกกับ "list เป็น append-only" (ถ้าวันหลังมีลบ/แก้ข้อความ ต้องเปลี่ยนวิธีตรวจ)

---

## 8. ข้อจำกัดปัจจุบัน

- **ออนไลน์ (presence)** อิงผู้เล่นในห้องเดียวกันเท่านั้น (backend ไม่ส่ง presence ข้ามห้อง) — ไม่เกี่ยวกับ unread โดยตรง แต่โชว์บนการ์ดเดียวกัน
- unread เป็น **ephemeral** ใน memory — reload/reconnect แล้วรีเซ็ตหมด (ตรงกับที่แชตไม่มีประวัติ)
- ไม่นับ "จำนวนข้อความที่ยังไม่อ่าน" (badge ตัวเลข) — เป็นแค่ boolean จุด/ไม่จุด ถ้าต้องการตัวเลขให้เก็บ `seenCounts` เทียบกับ `length` แล้วแสดงส่วนต่าง
