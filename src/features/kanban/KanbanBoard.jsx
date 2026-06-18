import { useState } from "react";
import { ROLE_LABEL } from "../auth/roles.js";

// 3 คอลัมน์ map กับ status ที่ backend ใช้
const COLUMNS = [
  ["todo", "To Do"],
  ["doing", "Doing"],
  ["done", "Done"],
];
const PREV = { todo: null, doing: "todo", done: "doing" };
const NEXT = { todo: "doing", doing: "done", done: null };

const shortId = (id) => (id ? String(id).slice(0, 6) : "?");

// Kanban board แบบ real-time — รับ tasks (object keyed by id), users (รายชื่อทั้งหมดสำหรับ selector),
// send(type,payload) จาก ws เส้นเดิม, myId
export default function KanbanBoard({ tasks, users = [], send, myId, onClose }) {
  const [draft, setDraft] = useState(null); // null = ปิดฟอร์ม | { id?, title, detail, assignTo: string[] }
  const list = Object.values(tasks);
  // map id → ชื่อ ใช้แสดงบนการ์ดแทน id ดิบ ๆ
  const nameById = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const openCreate = () => setDraft({ title: "", detail: "", assignTo: [] });
  const openEdit = (t) =>
    setDraft({ id: t.id, title: t.title, detail: t.detail || "", assignTo: t.assign_to || [] });
  const closeForm = () => setDraft(null);

  // toggle ผู้รับมอบหมายใน draft (เลือกได้หลายคน)
  const toggleAssignee = (uid) =>
    setDraft((d) => ({
      ...d,
      assignTo: d.assignTo.includes(uid) ? d.assignTo.filter((x) => x !== uid) : [...d.assignTo, uid],
    }));

  function submit(e) {
    e.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    const assign_to = draft.assignTo;
    const detail = draft.detail.trim();
    // ขาออก: ห้ามส่ง id/created_by ตอนสร้าง (server แจกเอง)
    if (draft.id) send("task_update", { id: draft.id, title, detail, assign_to });
    else send("task_create", { title, detail, assign_to });
    closeForm();
  }

  const move = (task, status) => {
    if (status && status !== task.status) send("task_move", { id: task.id, status }); // ส่งแค่ id+status
  };
  function onDrop(e, status) {
    e.preventDefault();
    const task = tasks[e.dataTransfer.getData("text/plain")];
    if (task) move(task, status);
  }

  return (
    <div className="board-overlay" onClick={onClose}>
      <div className="board" onClick={(e) => e.stopPropagation()}>
        <div className="board-head">
          <span className="board-title">📋 Task Board</span>
          <button className="ghost" onClick={openCreate}>+ การ์ด</button>
          <span className="spacer" />
          <button className="ghost" onClick={onClose}>✕ ปิด</button>
        </div>

        <div className="board-cols">
          {COLUMNS.map(([status, label]) => {
            const cards = list.filter((t) => t.status === status);
            return (
              <div
                key={status}
                className="board-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, status)}
              >
                <div className="col-head">{label}<span className="col-count">{cards.length}</span></div>
                <div className="col-cards">
                  {cards.map((t) => (
                    <Card
                      key={t.id}
                      task={t}
                      mine={t.created_by === myId}
                      myId={myId}
                      nameById={nameById}
                      onEdit={() => openEdit(t)}
                      onDelete={() => send("task_delete", { id: t.id })}
                      onPrev={() => move(t, PREV[status])}
                      onNext={() => move(t, NEXT[status])}
                      hasPrev={!!PREV[status]}
                      hasNext={!!NEXT[status]}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {draft && (
        <form className="card-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
          <h3>{draft.id ? "แก้ไขการ์ด" : "การ์ดใหม่"}</h3>
          <label>หัวข้อ</label>
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
          <label>รายละเอียด</label>
          <textarea rows={3} value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} />
          <label>มอบหมายให้ ({draft.assignTo.length})</label>
          <div className="assignee-list">
            {users.length === 0 && <span className="muted-sm">ยังไม่มีผู้ใช้ในระบบ</span>}
            {users.map((u) => (
              <label key={u.id} className="check">
                <input
                  type="checkbox"
                  checked={draft.assignTo.includes(u.id)}
                  onChange={() => toggleAssignee(u.id)}
                />
                {u.name}{u.id === myId ? " (ฉัน)" : ""} · {ROLE_LABEL[u.role] || u.role}
              </label>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" className="ghost" onClick={closeForm}>ยกเลิก</button>
            <button type="submit" className="submit-sm">บันทึก</button>
          </div>
        </form>
      )}
    </div>
  );
}

function Card({ task, mine, myId, nameById, onEdit, onDelete, onPrev, onNext, hasPrev, hasNext }) {
  const assignees = task.assign_to || [];
  // ชื่อผู้รับมอบหมาย: ตัวเอง → "ฉัน", คนอื่น → ชื่อจาก nameById (fallback id ย่อ)
  const label = (u) => (u === myId ? "ฉัน" : nameById[u] || shortId(u));
  return (
    <div className="kcard" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}>
      <div className="kcard-title">{task.title}</div>
      {task.detail && <div className="kcard-detail">{task.detail}</div>}
      <div className="kcard-meta">
        <span>โดย {mine ? "คุณ" : nameById[task.created_by] || shortId(task.created_by)}</span>
        {assignees.map((u) => (
          <span key={u} className="assign-badge">{label(u)}</span>
        ))}
      </div>
      <div className="kcard-actions">
        <button onClick={onPrev} disabled={!hasPrev} title="ย้ายซ้าย">◀</button>
        <button onClick={onEdit} title="แก้ไข">✎</button>
        <button onClick={onDelete} title="ลบ">🗑</button>
        <button onClick={onNext} disabled={!hasNext} title="ย้ายขวา">▶</button>
      </div>
    </div>
  );
}
