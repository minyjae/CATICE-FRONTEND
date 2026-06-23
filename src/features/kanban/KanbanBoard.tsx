import { useState } from "react";
import type { DragEvent, FormEvent } from "react";
import { ROLE_LABEL } from "../auth/roles";
import type { Board, PublicUser, Send, Task, TaskStatus } from "../../shared/protocol";

// 3 คอลัมน์ map กับ status ที่ backend ใช้
const COLUMNS: [TaskStatus, string][] = [
  ["todo", "To Do"],
  ["doing", "Doing"],
  ["done", "Done"],
];
const PREV: Record<TaskStatus, TaskStatus | null> = { todo: null, doing: "todo", done: "doing" };
const NEXT: Record<TaskStatus, TaskStatus | null> = { todo: "doing", doing: "done", done: null };

const shortId = (id: string) => (id ? String(id).slice(0, 6) : "?");

interface Draft {
  id?: string;
  title: string;
  detail: string;
  assignTo: string[];
}

interface KanbanBoardProps {
  boards: Record<string, Board>;
  tasks: Record<string, Task>;
  users?: PublicUser[];
  send: Send;
  myId: string | null;
  onClose: () => void;
}

// Kanban หลายบอร์ดแบบ real-time — board/task เป็น single source of truth = server
// ส่ง message แล้ว "รอ broadcast" ค่อย render (ไม่แก้ UI เอง) กันสถานะเพี้ยนเมื่อหลายคนแก้พร้อมกัน
export default function KanbanBoard({ boards, tasks, users = [], send, myId, onClose }: KanbanBoardProps) {
  const [boardId, setBoardId] = useState<string | null>(null); // null = หน้ารายการบอร์ด
  const [draft, setDraft] = useState<Draft | null>(null); // null = ปิดฟอร์มการ์ด
  const [boardDraft, setBoardDraft] = useState<{ id?: string; name: string } | null>(null); // สร้าง/เปลี่ยนชื่อบอร์ด
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null); // ยืนยันการลบ

  // บอร์ดที่เปิดอยู่ — ถ้าโดนลบไปแล้ว (broadcast) จะกลายเป็น undefined → ตกกลับหน้ารายการเอง
  const board = boardId ? boards[boardId] : null;
  // map id → ชื่อ ใช้แสดงบนการ์ดแทน id ดิบ ๆ
  const nameById: Record<string, string> = Object.fromEntries(users.map((u) => [u.id, u.name]));

  // ----- board actions (เปิด modal แทน prompt/confirm) -----
  const createBoard = () => setBoardDraft({ name: "" });
  const renameBoard = (b: Board) => setBoardDraft({ id: b.id, name: b.name });
  function submitBoard(e: FormEvent) {
    e.preventDefault();
    if (!boardDraft) return;
    const name = boardDraft.name.trim();
    if (!name) return;
    if (boardDraft.id) send("board_rename", { id: boardDraft.id, name });
    else send("board_create", { name });
    setBoardDraft(null);
  }
  const deleteBoard = (b: Board) =>
    setConfirm({
      message: `ลบบอร์ด “${b.name}” และการ์ดทั้งหมดในบอร์ดนี้?`,
      onConfirm: () => send("board_delete", { id: b.id }),
    });
  const requestDeleteTask = (t: Task) =>
    setConfirm({ message: `ลบการ์ด “${t.title}”?`, onConfirm: () => send("task_delete", { id: t.id }) });
  const runConfirm = () => {
    confirm?.onConfirm();
    setConfirm(null);
  };

  // ----- task draft -----
  const openCreate = () => setDraft({ title: "", detail: "", assignTo: [] });
  const openEdit = (t: Task) =>
    setDraft({ id: t.id, title: t.title, detail: t.detail || "", assignTo: t.assign_to || [] });
  const closeForm = () => setDraft(null);

  const toggleAssignee = (uid: string) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            assignTo: d.assignTo.includes(uid) ? d.assignTo.filter((x) => x !== uid) : [...d.assignTo, uid],
          }
        : d,
    );

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft || !board) return;
    const title = draft.title.trim();
    if (!title) return;
    const assign_to = draft.assignTo;
    const detail = draft.detail.trim();
    // ขาออก: ห้ามส่ง id/created_by ตอนสร้าง (server แจกเอง); task_create ต้องแนบ board_id
    if (draft.id) send("task_update", { id: draft.id, title, detail, assign_to });
    else send("task_create", { board_id: board.id, title, detail, assign_to });
    closeForm();
  }

  const move = (task: Task, status: TaskStatus | null) => {
    if (status && status !== task.status) send("task_move", { id: task.id, status }); // ส่งแค่ id+status
  };
  function onDrop(e: DragEvent, status: TaskStatus) {
    e.preventDefault();
    const task = tasks[e.dataTransfer.getData("text/plain")];
    if (task) move(task, status);
  }

  // =========================
  // หน้ารายการบอร์ด
  // =========================
  if (!board) {
    const list = Object.values(boards);
    return (
      <div className="board-overlay" onClick={onClose}>
        <div className="board" onClick={(e) => e.stopPropagation()}>
          <div className="board-head">
            <span className="board-title">📋 บอร์ดทั้งหมด</span>
            <button className="ghost" onClick={createBoard}>
              + สร้างบอร์ด
            </button>
            <span className="spacer" />
            <button className="ghost" onClick={onClose}>
              ✕ ปิด
            </button>
          </div>

          {list.length === 0 ? (
            <div className="board-empty">
              <div className="board-empty-icon">📋</div>
              <div className="board-empty-title">ยังไม่มีบอร์ด</div>
              <div className="board-empty-sub">เริ่มจัดงานของทีมด้วยบอร์ดแรกของคุณ</div>
              <button className="submit-sm" onClick={createBoard}>
                + สร้างบอร์ด
              </button>
            </div>
          ) : (
            <div className="board-list">
              {list.map((b) => {
              const count = Object.values(tasks).filter((t) => t.board_id === b.id).length;
              return (
                <div key={b.id} className="board-list-item">
                  <button className="board-list-open" onClick={() => setBoardId(b.id)}>
                    <span className="board-list-name">{b.name}</span>
                    <span className="board-list-meta">{count} การ์ด</span>
                  </button>
                  <button className="icon-btn" title="เปลี่ยนชื่อ" onClick={() => renameBoard(b)}>
                    ✎
                  </button>
                  <button className="icon-btn" title="ลบบอร์ด" onClick={() => deleteBoard(b)}>
                    🗑
                  </button>
                </div>
              );
            })}
            </div>
          )}

          <BoardFormModal
            draft={boardDraft}
            onChange={(name) => setBoardDraft((d) => (d ? { ...d, name } : d))}
            onCancel={() => setBoardDraft(null)}
            onSubmit={submitBoard}
          />
          <ConfirmModal data={confirm} onCancel={() => setConfirm(null)} onConfirm={runConfirm} />
        </div>
      </div>
    );
  }

  // =========================
  // มุมมองบอร์ด (3 columns ของ board ที่เลือก)
  // =========================
  const cardsOfBoard = Object.values(tasks).filter((t) => t.board_id === board.id);
  return (
    <div className="board-overlay" onClick={onClose}>
      <div className="board" onClick={(e) => e.stopPropagation()}>
        <div className="board-head">
          <button className="ghost" onClick={() => setBoardId(null)}>
            ‹ บอร์ด
          </button>
          <span className="board-title">{board.name}</span>
          <button className="ghost" onClick={openCreate}>
            + การ์ด
          </button>
          <span className="spacer" />
          <button className="ghost" onClick={onClose}>
            ✕ ปิด
          </button>
        </div>

        <div className="board-cols">
          {COLUMNS.map(([status, label]) => {
            const cards = cardsOfBoard.filter((t) => t.status === status);
            return (
              <div
                key={status}
                className="board-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, status)}
              >
                <div className="col-head">
                  {label}
                  <span className="col-count">{cards.length}</span>
                </div>
                <div className="col-cards">
                  {cards.map((t) => (
                    <Card
                      key={t.id}
                      task={t}
                      mine={t.created_by === myId}
                      myId={myId}
                      nameById={nameById}
                      onEdit={() => openEdit(t)}
                      onDelete={() => requestDeleteTask(t)}
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

        <ConfirmModal data={confirm} onCancel={() => setConfirm(null)} onConfirm={runConfirm} />
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
                {u.name}
                {u.id === myId ? " (ฉัน)" : ""} · {ROLE_LABEL[u.role] || u.role}
              </label>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" className="ghost" onClick={closeForm}>
              ยกเลิก
            </button>
            <button type="submit" className="submit-sm">
              บันทึก
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

interface CardProps {
  task: Task;
  mine: boolean;
  myId: string | null;
  nameById: Record<string, string>;
  onEdit: () => void;
  onDelete: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function Card({ task, mine, myId, nameById, onEdit, onDelete, onPrev, onNext, hasPrev, hasNext }: CardProps) {
  const assignees = task.assign_to || [];
  // ชื่อผู้รับมอบหมาย: ตัวเอง → "ฉัน", คนอื่น → ชื่อจาก nameById (fallback id ย่อ)
  const label = (u: string) => (u === myId ? "ฉัน" : nameById[u] || shortId(u));
  return (
    <div className="kcard" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}>
      <div className="kcard-title">{task.title}</div>
      {task.detail && <div className="kcard-detail">{task.detail}</div>}
      <div className="kcard-meta">
        <span>โดย {mine ? "คุณ" : nameById[task.created_by] || shortId(task.created_by)}</span>
        {assignees.map((u) => (
          <span key={u} className="assign-badge">
            {label(u)}
          </span>
        ))}
      </div>
      <div className="kcard-actions">
        <button onClick={onPrev} disabled={!hasPrev} title="ย้ายซ้าย">
          ◀
        </button>
        <button onClick={onEdit} title="แก้ไข">
          ✎
        </button>
        <button onClick={onDelete} title="ลบ">
          🗑
        </button>
        <button onClick={onNext} disabled={!hasNext} title="ย้ายขวา">
          ▶
        </button>
      </div>
    </div>
  );
}

// modal สร้าง/เปลี่ยนชื่อบอร์ด (แทน window.prompt)
function BoardFormModal({
  draft,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: { id?: string; name: string } | null;
  onChange: (name: string) => void;
  onCancel: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  if (!draft) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal-box" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h3>{draft.id ? "เปลี่ยนชื่อบอร์ด" : "สร้างบอร์ดใหม่"}</h3>
        <input
          className="modal-input"
          value={draft.name}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ชื่อบอร์ด"
          autoFocus
        />
        <div className="form-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            ยกเลิก
          </button>
          <button type="submit" className="submit-sm">
            บันทึก
          </button>
        </div>
      </form>
    </div>
  );
}

// modal ยืนยันการลบ (แทน window.confirm) — ใช้ทั้งลบบอร์ดและลบการ์ด
function ConfirmModal({
  data,
  onCancel,
  onConfirm,
}: {
  data: { message: string } | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!data) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon">🗑</div>
        <div className="confirm-msg">{data.message}</div>
        <div className="form-actions">
          <button className="ghost" onClick={onCancel}>
            ยกเลิก
          </button>
          <button className="btn-danger" onClick={onConfirm}>
            ลบ
          </button>
        </div>
      </div>
    </div>
  );
}
