import { useState, useEffect, useRef, useCallback } from "react";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

// 미리 정의된 고정 색상 (자주 쓰는 태그)
const PRESET_COLORS = {
  "거꾸로캠퍼스": { h: 158, s: 52, l: 36 },
  "교육실험실21": { h: 228, s: 42, l: 47 },
  "연구":         { h: 32,  s: 76, l: 44 },
  "회의":         { h: 272, s: 46, l: 45 },
  "개인":         { h: 0,   s: 62, l: 51 },
  "컨설팅":       { h: 142, s: 54, l: 36 },
};

// 태그 문자열 → 안정적인 숫자 해시
function strHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
}

// 색상 캐시 (세션 동안 동일 태그 = 동일 색)
const colorCache = {};

function getTagStyle(tag) {
  if (!tag) return { bg: "#F5F5F5", accent: "#888", light: "#CCC" };
  if (colorCache[tag]) return colorCache[tag];

  // 미리 정의된 색상 우선 사용
  const preset = PRESET_COLORS[tag];
  const { h, s, l } = preset || {
    h: strHash(tag) % 360,
    s: 38 + (strHash(tag + "s") % 22),   // 38~60 — 채도: 너무 튀지 않게
    l: 34 + (strHash(tag + "l") % 18),   // 34~52 — 명도: 진하지 않게
  };

  // accent: HSL 원색
  // bg: 매우 연한 버전 (s 낮추고 l 높임)
  // light: 중간 연한 버전
  const accent = `hsl(${h}, ${s}%, ${l}%)`;
  const bg     = `hsl(${h}, ${Math.round(s * 0.4)}%, ${Math.min(l + 44, 97)}%)`;
  const light  = `hsl(${h}, ${Math.round(s * 0.6)}%, ${Math.min(l + 28, 88)}%)`;

  const style = { bg, accent, light };
  colorCache[tag] = style;
  return style;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function getMonday(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(now);
  mon.setDate(diff + offsetWeeks * 7);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function buildDates(monday, weeks = 4) {
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function fmt(date) { return `${date.getMonth()+1}/${date.getDate()}`; }

function getTodayKey() { return dateKey(new Date()); }

// ── TaskItem ──────────────────────────────────────────────
function TaskItem({ task, onToggle, onDelete, onCarryOver, isPastTask, isNew, onDragStart, onDragEnd, isDragging, onAlarmUpdate }) {
  const primaryProject = task.project?.[0];
  const style = getTagStyle(primaryProject);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      draggable
      onClick={() => onToggle(task.id, !task.done)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragStart={e => {
        e.stopPropagation();
        e.dataTransfer.setData("taskId", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(task.id);
      }}
      onDragEnd={() => onDragEnd?.()}
      style={{
        display: "flex", alignItems: "flex-start", gap: "8px",
        padding: "9px 10px", marginBottom: "5px", borderRadius: "9px",
        background: task.done ? "#F7F7F7" : isPastTask && !task.done ? "#FFF5F5" : style.bg,
        borderLeft: `3px solid ${task.done ? "#DDD" : isPastTask && !task.done ? "#E57373" : style.accent}`,
        opacity: isDragging ? 0.35 : task.done ? 0.55 : visible ? 1 : 0,
        transform: !visible
          ? "translateY(-6px) scale(0.97)"
          : isDragging
            ? "scale(0.97)"
            : hovered && !task.done
              ? "translateX(3px) scale(1.015)"
              : "translateY(0) scale(1)",
        boxShadow: hovered && !task.done && !isDragging
          ? `2px 3px 10px ${style.light}88`
          : "none",
        cursor: isDragging ? "grabbing" : "grab",
        transition: isNew
          ? "opacity 0.3s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)"
          : "opacity 0.2s ease, transform 0.18s ease, box-shadow 0.18s ease",
      }}
    >
      {/* 미완료 과거 항목 경고 점 */}
      {isPastTask && !task.done && (
        <div style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: "#E57373", flexShrink: 0, marginTop: "6px",
          boxShadow: "0 0 0 2px #FFCDD2",
        }} />
      )}

      <div style={{
        width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, marginTop: "1px",
        border: `2px solid ${task.done ? "#BBB" : isPastTask && !task.done ? "#E57373" : style.accent}`,
        background: task.done ? style.accent : "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s ease",
        boxShadow: task.done ? `0 0 0 3px ${style.light}44` : "none",
      }}>
        {task.done && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12.5px", lineHeight: "1.45",
          color: task.done ? "#AAAAAA" : isPastTask && !task.done ? "#C62828" : "#222",
          textDecoration: task.done ? "line-through" : "none", wordBreak: "break-word" }}>
          {task.text}
          {task.project?.length > 0 && (
            <span style={{ marginLeft: "6px" }}>
              {task.project.map((p, i) => (
                <span key={i} style={{
                  color: task.done ? "#BBBBBB" : getTagStyle(p).accent,
                  fontWeight: 600, fontSize: "11px", marginRight: "4px"
                }}>#{p}</span>
              ))}
            </span>
          )}
          {task.alarmAt && !task.done && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "2px",
              marginLeft: "5px", fontSize: "10px", color: "#2D7A5E",
              fontWeight: 600,
            }}>
              ⏰{new Date(task.alarmAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}
            </span>
          )}
        </div>

        {/* 이월 버튼 — 과거 미완료만 */}
        {isPastTask && !task.done && (
          <button
            onClick={e => { e.stopPropagation(); onCarryOver(task.id); }}
            style={{
              marginTop: "4px", padding: "2px 8px",
              background: "#FFF3E0", border: "1px solid #FFCC80",
              borderRadius: "4px", fontSize: "10px", fontWeight: 600,
              color: "#E65100", cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#FFE0B2"}
            onMouseLeave={e => e.currentTarget.style.background = "#FFF3E0"}
          >
            오늘로 이월 →
          </button>
        )}
      </div>

      {/* 알림 버튼 */}
      {!task.done && (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={e => {
              e.stopPropagation();
              // datetime-local input 트리거
              const inp = e.currentTarget.nextSibling;
              inp.showPicker?.() || inp.click();
            }}
            title={task.alarmAt ? `알림: ${new Date(task.alarmAt).toLocaleString("ko-KR", {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}` : "알림 설정"}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "13px", padding: "0 1px", lineHeight: 1, flexShrink: 0,
              opacity: task.alarmAt ? 1 : 0.3,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = "1"}
            onMouseLeave={e => e.currentTarget.style.opacity = task.alarmAt ? "1" : "0.3"}
          >🔔</button>
          <input
            type="datetime-local"
            defaultValue={task.alarmAt ? task.alarmAt.slice(0,16) : ""}
            onChange={e => {
              const val = e.target.value;
              onAlarmUpdate?.(task.id, val ? new Date(val).toISOString() : null);
            }}
            onClick={e => e.stopPropagation()}
            style={{ position: "absolute", opacity: 0, width: "1px", height: "1px", pointerEvents: "none" }}
          />
        </div>
      )}

      <button onClick={e => { e.stopPropagation(); onDelete(task.id); }}
        style={{ background: "none", border: "none", cursor: "pointer",
          color: "#CCCCCC", fontSize: "15px", padding: "0 1px", lineHeight: 1, flexShrink: 0 }}
        onMouseEnter={e => e.target.style.color = "#FF6B6B"}
        onMouseLeave={e => e.target.style.color = "#CCCCCC"}>×</button>
    </div>
  );
}

// ── useNotifications ──────────────────────────────────────
function useNotifications(tasks) {
  const swRef = useRef(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    // Service Worker 등록
    navigator.serviceWorker.register("/sw.js").then(reg => {
      swRef.current = reg;
    });
  }, []);

  // 알림 권한 요청 함수 (외부 호출용)
  const requestPermission = async () => {
    if (Notification.permission === "granted") return true;
    const result = await Notification.requestPermission();
    return result === "granted";
  };

  // tasks 바뀔 때마다 SW에 알림 재등록
  useEffect(() => {
    if (!swRef.current?.active) return;
    const now = Date.now();
    tasks.forEach(t => {
      if (!t.alarmAt || t.done) return;
      const fireAt = new Date(t.alarmAt).getTime();
      if (fireAt <= now) return;
      swRef.current.active.postMessage({
        type: "SCHEDULE_NOTIFICATION",
        id: t.id,
        title: `⏰ ${t.text}`,
        body: t.project?.length ? `#${t.project.join(" #")}` : "할 일 알림",
        fireAt,
      });
    });
  }, [tasks]);

  return { requestPermission, swRef };
}

// ── useMidnightRefresh ─────────────────────────────────────
function useMidnightRefresh(fetchTasks) {
  useEffect(() => {
    let lastDate = new Date().toDateString();
    const timer = setInterval(() => {
      const nowDate = new Date().toDateString();
      if (nowDate !== lastDate) {
        lastDate = nowDate;
        fetchTasks();
      }
    }, 60_000); // 1분마다 날짜 체크
    return () => clearInterval(timer);
  }, [fetchTasks]);
}

// ── useDragAutoScroll ─────────────────────────────────────
function useDragAutoScroll(draggingId) {
  useEffect(() => {
    if (!draggingId) return;
    const ZONE = 120;   // 화면 상하단 경계 감지 영역(px)
    const SPEED = 12;   // 스크롤 속도(px)
    let animId = null;

    const onDragOver = (e) => {
      const y = e.clientY;
      const h = window.innerHeight;
      cancelAnimationFrame(animId);

      const scroll = () => {
        if (y < ZONE) {
          window.scrollBy(0, -SPEED);
          animId = requestAnimationFrame(scroll);
        } else if (y > h - ZONE) {
          window.scrollBy(0, SPEED);
          animId = requestAnimationFrame(scroll);
        }
      };
      scroll();
    };

    const onDragEnd = () => cancelAnimationFrame(animId);

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("drop", onDragEnd);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("drop", onDragEnd);
    };
  }, [draggingId]);
}

// ── RepeatModal ───────────────────────────────────────────
function RepeatModal({ onClose, onSave, allProjects }) {
  const [text, setText] = useState("");
  const [repeat, setRepeat] = useState("매일");
  const [repeatDays, setRepeatDays] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [monthDay, setMonthDay] = useState("1");

  const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

  const toggleDay = (d) => setRepeatDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
  const toggleProject = (p) => setSelectedProjects(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const handleSave = () => {
    if (!text.trim()) return;
    const days = repeat === "매달" ? [monthDay] : repeat === "매주" ? repeatDays : [];
    onSave({ text: text.trim(), repeat, repeatDays: days, project: selectedProjects });
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: "18px", padding: "26px 24px",
        width: "100%", maxWidth: "400px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>🔁</span>
            <span style={{ fontSize: "16px", fontWeight: 700, color: "#222" }}>반복 할 일 설정</span>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: "20px",
            color: "#AAAAAA", cursor: "pointer", lineHeight: 1, padding: 0,
          }}>×</button>
        </div>

        {/* 할 일 이름 */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "#888", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>할 일</label>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="반복할 내용 입력"
            autoFocus
            style={{
              width: "100%", padding: "10px 14px",
              border: "1.5px solid #E8E8E8", borderRadius: "10px",
              fontSize: "15px", outline: "none", color: "#333",
            }}
            onFocus={e => e.target.style.borderColor = "#2D7A5E"}
            onBlur={e => e.target.style.borderColor = "#E8E8E8"}
          />
        </div>

        {/* 반복 유형 */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "#888", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>반복 유형</label>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {["매일", "매주", "매달", "매주전체"].map(r => (
              <button key={r} onClick={() => { setRepeat(r); setRepeatDays([]); }} style={{
                padding: "6px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: 600,
                cursor: "pointer", border: "1.5px solid",
                borderColor: repeat === r ? "#2D7A5E" : "#E8E8E8",
                background: repeat === r ? "#2D7A5E" : "white",
                color: repeat === r ? "white" : "#555",
                transition: "all 0.15s",
              }}>
                {r === "매주전체" ? "평일 매일" : r}
              </button>
            ))}
          </div>
        </div>

        {/* 매주 — 요일 선택 */}
        {repeat === "매주" && (
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "#888", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>반복 요일</label>
            <div style={{ display: "flex", gap: "6px" }}>
              {DAYS.map(d => (
                <button key={d} onClick={() => toggleDay(d)} style={{
                  width: "36px", height: "36px", borderRadius: "50%", fontSize: "12px", fontWeight: 600,
                  cursor: "pointer", border: "1.5px solid",
                  borderColor: repeatDays.includes(d) ? "#2D7A5E" : "#E8E8E8",
                  background: repeatDays.includes(d) ? "#2D7A5E" : "white",
                  color: repeatDays.includes(d) ? "white" : "#555",
                  transition: "all 0.15s",
                }}>{d}</button>
              ))}
            </div>
          </div>
        )}

        {/* 매달 — 날짜 입력 */}
        {repeat === "매달" && (
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "#888", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>매달 몇 일?</label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="number" min="1" max="31"
                value={monthDay}
                onChange={e => setMonthDay(e.target.value)}
                style={{
                  width: "70px", padding: "8px 12px",
                  border: "1.5px solid #E8E8E8", borderRadius: "10px",
                  fontSize: "15px", outline: "none", textAlign: "center",
                }}
                onFocus={e => e.target.style.borderColor = "#2D7A5E"}
                onBlur={e => e.target.style.borderColor = "#E8E8E8"}
              />
              <span style={{ fontSize: "13px", color: "#888" }}>일마다 반복</span>
            </div>
          </div>
        )}

        {/* 프로젝트 태그 */}
        {allProjects.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "#888", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>프로젝트 태그</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {allProjects.map(p => {
                const s = getTagStyle(p);
                const sel = selectedProjects.includes(p);
                return (
                  <button key={p} onClick={() => toggleProject(p)} style={{
                    padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                    cursor: "pointer", border: `1.5px solid ${s.accent}`,
                    background: sel ? s.accent : s.bg,
                    color: sel ? "white" : s.accent,
                    transition: "all 0.15s",
                  }}>#{p}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* 저장 버튼 */}
        <button
          onClick={handleSave}
          disabled={!text.trim() || (repeat === "매주" && repeatDays.length === 0)}
          style={{
            width: "100%", padding: "13px",
            background: text.trim() && (repeat !== "매주" || repeatDays.length > 0) ? "#2D7A5E" : "#CCCCCC",
            color: "white", border: "none", borderRadius: "12px",
            fontSize: "15px", fontWeight: 700, cursor: text.trim() ? "pointer" : "not-allowed",
            transition: "background 0.2s",
          }}>
          반복 할 일 저장
        </button>
      </div>
    </div>
  );
}

// ── DayColumn ─────────────────────────────────────────────
function DayColumn({ date, dayLabel, tasks, onToggle, onDelete, onAdd, onCarryOver, activeFilter, allProjects, isMobile, onDrop, draggingId, onDragStart, onDragEnd, onAlarmUpdate }) {
  const [input, setInput] = useState("");
  const [projectInput, setProjectInput] = useState("");
  const [showProjectInput, setShowProjectInput] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [newTaskIds, setNewTaskIds] = useState(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [alarmTime, setAlarmTime] = useState("");
  const [showAlarmInput, setShowAlarmInput] = useState(false);
  const inputRef = useRef();
  const projectInputRef = useRef();
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const prevTaskIds = useRef(new Set(tasks.map(t => t.id)));

  const today = new Date();
  today.setHours(0,0,0,0);
  const isToday = isSameDay(date, today);
  const isPast  = date < today && !isToday;

  // 새로 추가된 task 감지
  useEffect(() => {
    const currentIds = new Set(tasks.map(t => t.id));
    const added = [...currentIds].filter(id => !prevTaskIds.current.has(id));
    if (added.length > 0) {
      setNewTaskIds(prev => new Set([...prev, ...added]));
      setTimeout(() => {
        setNewTaskIds(prev => {
          const next = new Set(prev);
          added.forEach(id => next.delete(id));
          return next;
        });
      }, 600);
    }
    prevTaskIds.current = currentIds;
  }, [tasks]);

  const filtered = activeFilter
    ? tasks.filter(t => t.project?.includes(activeFilter))
    : tasks;

  const done  = filtered.filter(t => t.done).length;
  const total = filtered.length;
  const pct   = total > 0 ? (done / total) * 100 : 0;
  const hasPastUndone = isPast && filtered.some(t => !t.done);

  const handleAdd = () => {
    if (!input.trim()) return;
    const typedProjects = projectInput.split(/[,\s]+/).map(p => p.replace(/^#/, "").trim()).filter(Boolean);
    const projects = [...new Set([...selectedProjects, ...typedProjects])];
    // alarmTime이 있으면 해당 날짜+시간 조합
    let alarmAt = null;
    if (alarmTime) {
      alarmAt = `${dateKey(date)}T${alarmTime}:00+09:00`;
    }
    onAdd(input.trim(), dateKey(date), dayLabel, projects, false, alarmAt);
    setInput("");
    setProjectInput("");
    setAlarmTime("");
    setShowProjectInput(false);
    setShowAlarmInput(false);
    setShowDropdown(false);
    setSelectedProjects([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const toggleProject = (p) => {
    setSelectedProjects(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  // 모바일에서 빈 과거 날짜는 숨김
  if (isMobile && isPast && filtered.length === 0) return null;

  return (
    <div
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        const taskId = e.dataTransfer.getData("taskId");
        if (taskId) onDrop?.(taskId, dateKey(date), dayLabel);
      }}
      style={{
      background: dragOver ? "#EEF7F3" : isToday ? "white" : "#FAFAFA",
      borderRadius: "14px", padding: isMobile ? "12px 14px" : "13px 11px",
      border: dragOver ? "2px dashed #2D7A5E" : isToday ? "2px solid #2D7A5E" : hasPastUndone ? "2px solid #FFCDD2" : "2px solid transparent",
      boxShadow: isToday ? "0 4px 20px rgba(45,122,94,0.13)" : "0 1px 3px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", gap: "8px",
      minWidth: isMobile ? "unset" : "140px",
      maxWidth: isMobile ? "100%" : "none",
      flex: 1,
      opacity: isPast && !hasPastUndone ? 0.65 : 1,
      transition: "background 0.15s ease, border 0.15s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "10px" : "0" }}>
          {isMobile ? (
            // 모바일: 요일 + 날짜 한 줄
            <>
              <div style={{ fontSize: "16px", fontWeight: 700,
                color: isToday ? "#2D7A5E" : isPast ? (hasPastUndone ? "#E57373" : "#CCCCCC") : "#4A4A4A" }}>
                {dayLabel}
              </div>
              <div style={{ fontSize: "12px",
                color: isToday ? "#2D7A5E" : hasPastUndone ? "#E57373" : "#AAAAAA",
                fontWeight: isToday ? 600 : 400 }}>{fmt(date)}</div>
              {isToday && <div style={{ fontSize: "9px", color: "#2D7A5E", fontWeight: 700,
                background: "#E8F4F0", borderRadius: "6px", padding: "1px 6px" }}>TODAY</div>}
              {hasPastUndone && <div style={{ fontSize: "9px", color: "#E57373", fontWeight: 700,
                background: "#FFF5F5", borderRadius: "6px", padding: "1px 6px" }}>미완료</div>}
            </>
          ) : (
            // 데스크탑: 기존
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700, lineHeight: 1,
                color: isToday ? "#2D7A5E" : isPast ? (hasPastUndone ? "#E57373" : "#CCCCCC") : "#4A4A4A",
                letterSpacing: "-0.2px" }}>{dayLabel}</div>
              <div style={{ fontSize: "11px", marginTop: "3px",
                color: isToday ? "#2D7A5E" : hasPastUndone ? "#E57373" : "#BBBBBB",
                fontWeight: isToday ? 600 : 400 }}>{fmt(date)}</div>
              {isToday && <div style={{ fontSize: "8px", color: "#2D7A5E", fontWeight: 700,
                letterSpacing: "1.2px", marginTop: "2px" }}>TODAY</div>}
              {hasPastUndone && <div style={{ fontSize: "8px", color: "#E57373", fontWeight: 700,
                letterSpacing: "0.8px", marginTop: "2px" }}>미완료</div>}
            </div>
          )}
        </div>
        {total > 0 && (
          <span style={{ fontSize: "10.5px", color: hasPastUndone ? "#E57373" : "#BBBBBB" }}>
            {done}/{total}
          </span>
        )}
      </div>

      {total > 0 && (
        <div style={{ height: "2.5px", background: "#EEEEEE", borderRadius: "4px", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: pct === 100 ? "#2D7A5E" : hasPastUndone ? "#EF9A9A" : "#A8D5C2",
            borderRadius: "4px", transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
          }} />
        </div>
      )}

      <div style={{ flex: 1, minHeight: "32px" }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: "10.5px", color: "#DDDDDD", textAlign: "center", paddingTop: "8px" }}>—</div>
        )}
        {filtered.map(t => (
          <TaskItem
            key={t.id}
            task={t}
            onToggle={onToggle}
            onDelete={onDelete}
            onCarryOver={onCarryOver}
            isPastTask={isPast}
            isNew={newTaskIds.has(t.id)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggingId === t.id}
            onAlarmUpdate={onAlarmUpdate}
          />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", gap: "5px" }}>
          <input ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAdd(); } }}
            onFocus={() => setShowProjectInput(true)}
            onBlur={() => setTimeout(() => { setShowProjectInput(false); setShowDropdown(false); }, 200)}
            placeholder="추가"
            style={{
              flex: 1, padding: isMobile ? "9px 12px" : "5px 8px",
              border: "1.5px solid #E8E8E8", borderRadius: "7px",
              fontSize: isMobile ? "16px" : "12px", outline: "none", color: "#333", background: "white",
              transition: "border-color 0.2s",
            }}
            onBlur={e => e.target.style.borderColor = "#E8E8E8"}
          />
          {!isMobile && (
            <button onClick={handleAdd} style={{
              background: "#2D7A5E", color: "white", border: "none",
              borderRadius: "7px", width: "26px", height: "26px",
              cursor: "pointer", fontSize: "15px", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>+</button>
          )}
        </div>
        {isMobile && input.trim() && (
          <button onClick={handleAdd} style={{
            width: "100%", padding: "10px",
            background: "#2D7A5E", color: "white", border: "none",
            borderRadius: "8px", fontSize: "15px", fontWeight: 700,
            cursor: "pointer", letterSpacing: "0.5px",
          }}>+ 추가</button>
        )}
        {showProjectInput && input.trim() && (
          <button
            onClick={() => setShowAlarmInput(v => !v)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "11px", color: showAlarmInput ? "#2D7A5E" : "#BBBBBB",
              padding: "0", textAlign: "left", fontWeight: 600,
              transition: "color 0.15s",
            }}
          >
            {showAlarmInput ? "⏰ 알림 설정 중" : "⏰ 알림 추가"}
          </button>
        )}
        {showAlarmInput && input.trim() && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "#888" }}>⏰</span>
            <input
              type="time"
              value={alarmTime}
              onChange={e => setAlarmTime(e.target.value)}
              style={{
                flex: 1, padding: "4px 8px",
                border: "1.5px solid #2D7A5E", borderRadius: "7px",
                fontSize: isMobile ? "16px" : "12px", outline: "none",
                color: "#333", background: "white",
              }}
            />
            {alarmTime && (
              <button onClick={() => setAlarmTime("")} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#CCCCCC", fontSize: "14px", padding: 0,
              }}>×</button>
            )}
          </div>
        )}
        {showProjectInput && (
          <div style={{ position: "relative", zIndex: 100 }}>
            {/* 선택된 태그 칩 */}
            {selectedProjects.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginBottom: "4px" }}>
                {selectedProjects.map(p => {
                  const s = getTagStyle(p);
                  return (
                    <span key={p} onClick={() => toggleProject(p)} style={{
                      padding: "2px 7px", borderRadius: "12px",
                      background: s.accent, color: "white",
                      fontSize: "10px", fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "3px",
                      transition: "opacity 0.15s",
                    }}>
                      #{p} <span style={{ opacity: 0.8, fontSize: "11px" }}>×</span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* 입력창 */}
            <input
              ref={projectInputRef}
              value={projectInput}
              onChange={e => { setProjectInput(e.target.value); setShowDropdown(true); }}
              onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAdd(); } }}
              onFocus={() => {
                setShowDropdown(true);
                if (projectInputRef.current) {
                  const r = projectInputRef.current.getBoundingClientRect();
                  setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });
                }
              }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              placeholder={selectedProjects.length > 0 ? "추가 태그..." : "#프로젝트 선택 또는 입력"}
              style={{
                width: "100%", padding: "5px 8px",
                border: "1.5px solid #2D7A5E", borderRadius: "7px",
                fontSize: isMobile ? "16px" : "12px", outline: "none", color: "#333", background: "white",
              }}
            />

            {/* 드롭다운 */}
            {showDropdown && allProjects.length > 0 && (
              <div style={{
                position: isMobile ? "absolute" : "fixed",
                top: isMobile ? "calc(100% + 4px)" : dropdownPos.top,
                left: isMobile ? 0 : dropdownPos.left,
                right: isMobile ? 0 : "auto",
                width: isMobile ? "auto" : dropdownPos.width,
                background: "white", borderRadius: "9px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                border: "1.5px solid #EEEEEE",
                zIndex: 999, overflow: "hidden",
                maxHeight: "160px", overflowY: "auto",
              }}>
                {allProjects
                  .filter(p => !projectInput || p.toLowerCase().includes(projectInput.replace(/^#/, "").toLowerCase()))
                  .map(p => {
                    const s = getTagStyle(p);
                    const selected = selectedProjects.includes(p);
                    return (
                      <div key={p}
                        onMouseDown={e => { e.preventDefault(); toggleProject(p); setProjectInput(""); }}
                        style={{
                          padding: "7px 10px", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: "8px",
                          background: selected ? s.bg : "white",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "#F8F8F8"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = selected ? s.bg : "white"; }}
                      >
                        <div style={{
                          width: "14px", height: "14px", borderRadius: "4px", flexShrink: 0,
                          border: `2px solid ${s.accent}`,
                          background: selected ? s.accent : "white",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s",
                        }}>
                          {selected && (
                            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                              <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span style={{ fontSize: "11.5px", color: s.accent, fontWeight: 600 }}>#{p}</span>
                      </div>
                    );
                  })}
                {allProjects.filter(p => !projectInput || p.toLowerCase().includes(projectInput.replace(/^#/, "").toLowerCase())).length === 0 && projectInput && (
                  <div style={{ padding: "7px 10px", fontSize: "11px", color: "#AAAAAA" }}>
                    "{projectInput.replace(/^#/, "")}" 새 태그로 추가됩니다
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── WeekDropZone ──────────────────────────────────────────
function WeekDropZone({ weekDates, monDate, isCurrentWeek, offsetLabel, draggingId, onDrop }) {
  const [dragOver, setDragOver] = useState(false);
  const DAYS_LABEL = ["월", "화", "수", "목", "금", "토", "일"];

  // 드롭 시 해당 주 월요일로 이동
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;
    // 해당 주의 오늘과 가장 가까운 평일로 이동 (기본: 월요일)
    const targetDate = weekDates[0];
    const dk = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,"0")}-${String(targetDate.getDate()).padStart(2,"0")}`;
    onDrop?.(taskId, dk, DAYS_LABEL[0]);
  };

  return (
    <div
      onDragOver={e => { if (draggingId) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px",
        padding: dragOver ? "4px 8px" : "0",
        borderRadius: "8px",
        background: dragOver ? "#EEF7F3" : "transparent",
        border: dragOver ? "2px dashed #2D7A5E" : "2px solid transparent",
        transition: "all 0.15s ease",
      }}
    >
      <span style={{
        fontSize: "10px", fontWeight: 700, letterSpacing: "0.7px",
        color: dragOver ? "#2D7A5E" : isCurrentWeek ? "#2D7A5E" : "#BBBBBB",
        whiteSpace: "nowrap",
        transition: "color 0.15s",
      }}>
        {dragOver ? "📅 여기에 놓기" : (isCurrentWeek ? `▶ ${offsetLabel}` : offsetLabel)}
        {!dragOver && <>&ensp;{monDate.getMonth()+1}월 {monDate.getDate()}일 — {weekDates[6].getMonth()+1}월 {weekDates[6].getDate()}일</>}
      </span>
      <div style={{ flex: 1, height: "1px", background: dragOver ? "#A8D5C2" : "#E6E6E6", transition: "background 0.15s" }} />
    </div>
  );
}

// ── RepeatTemplates Panel ─────────────────────────────────
function RepeatTemplatesPanel({ templates, onDelete, allProjects }) {
  const [open, setOpen] = useState(false);
  if (templates.length === 0) return null;

  return (
    <div style={{
      background: "white", borderRadius: "14px", padding: "14px 16px",
      border: "1.5px solid #E8E8E8", marginBottom: "16px",
    }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px" }}>🔁</span>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#333" }}>반복 설정 중인 할 일</span>
          <span style={{
            background: "#F1F3F0", borderRadius: "10px",
            padding: "1px 8px", fontSize: "11px", color: "#888", fontWeight: 600,
          }}>{templates.length}</span>
        </div>
        <span style={{ fontSize: "16px", color: "#AAAAAA", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌃</span>
      </div>

      {open && (
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {templates.map(t => {
            const repeatLabel = t.repeat === "매주전체" ? "평일 매일"
              : t.repeat === "매주" ? `매주 ${t.repeatDays?.join(", ")}`
              : t.repeat === "매달" ? `매달 ${t.repeatDays?.[0]}일`
              : t.repeat;
            return (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", background: "#FAFAFA", borderRadius: "10px",
                border: "1.5px solid #EEEEEE",
              }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#333" }}>{t.text}</div>
                  <div style={{ fontSize: "11px", color: "#2D7A5E", marginTop: "2px", fontWeight: 600 }}>🔁 {repeatLabel}</div>
                  {t.project?.length > 0 && (
                    <div style={{ marginTop: "4px" }}>
                      {t.project.map(p => (
                        <span key={p} style={{ color: getTagStyle(p).accent, fontSize: "11px", fontWeight: 600, marginRight: "6px" }}>#{p}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => onDelete(t.id)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#CCCCCC", fontSize: "18px", padding: "0 4px", lineHeight: 1,
                }}
                onMouseEnter={e => e.target.style.color = "#FF6B6B"}
                onMouseLeave={e => e.target.style.color = "#CCCCCC"}
                >×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function WeeklyPlanner() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [tasks, setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(null);

  const monday = getMonday(weekOffset);
  const dates  = buildDates(monday, 4);
  const today  = new Date();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleToggle = async (id, done) => {
    setTasks(p => p.map(t => t.id === id ? { ...t, done } : t));
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done }),
    });
  };

  const handleDelete = async (id) => {
    setTasks(p => p.filter(t => t.id !== id));
    await fetch("/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const handleAdd = async (text, date, day, project, concern = false, alarmAt = null) => {
    const tempId = `temp-${Date.now()}`;
    setTasks(p => [...p, { id: tempId, text, date, day, project, done: false, concern, alarmAt }]);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, date, day, project, concern, alarmAt }),
    });
    const { id } = await res.json();
    setTasks(p => p.map(t => t.id === tempId ? { ...t, id } : t));
  };

  const handleAddConcern = async (text) => {
    const tempId = `temp-${Date.now()}`;
    setTasks(p => [...p, { id: tempId, text, date: null, day: null, project: [], done: false, concern: true }]);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, concern: true }),
    });
    const { id } = await res.json();
    setTasks(p => p.map(t => t.id === tempId ? { ...t, id } : t));
  };

  const handleDeleteConcern = async (id) => {
    setTasks(p => p.filter(t => t.id !== id));
    await fetch("/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const handleAddRepeat = async ({ text, repeat, repeatDays, project }) => {
    const tempId = `temp-${Date.now()}`;
    setTasks(p => [...p, { id: tempId, text, repeat, repeatDays, project, done: false, concern: false, date: null, day: null }]);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, repeat, repeatDays, project }),
    });
    const { id } = await res.json();
    setTasks(p => p.map(t => t.id === tempId ? { ...t, id } : t));
    // 반복 항목 즉시 생성 반영
    setTimeout(() => fetchTasks(), 500);
  };

  // 이월: 오늘 날짜로 날짜 변경
  const handleCarryOver = async (id) => {
    const todayKey = getTodayKey();
    const todayDay = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
    setTasks(p => p.map(t => t.id === id ? { ...t, date: todayKey, day: todayDay } : t));
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, date: todayKey, day: todayDay }),
    });
  };

  const handleAlarmUpdate = async (id, alarmAt) => {
    setTasks(p => p.map(t => t.id === id ? { ...t, alarmAt } : t));
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, alarmAt }),
    });
  };

  const handleBulkCarryOver = async () => {
    const todayKey = getTodayKey();
    const todayDay = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
    const tod = new Date(); tod.setHours(0,0,0,0);
    const pastUndone = regularTasks.filter(t => {
      const d = new Date(t.date); d.setHours(0,0,0,0);
      return d < tod && !t.done;
    });
    // 낙관적 업데이트
    setTasks(p => p.map(t =>
      pastUndone.find(u => u.id === t.id)
        ? { ...t, date: todayKey, day: todayDay }
        : t
    ));
    // 병렬로 Notion 업데이트
    await Promise.all(pastUndone.map(t =>
      fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, date: todayKey, day: todayDay }),
      })
    ));
  };

  const handleDrop = async (taskId, newDate, newDay) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.date === newDate) return; // 같은 날이면 무시 (순서 변경은 로컬만)
    // 낙관적 업데이트
    setTasks(p => p.map(t => t.id === taskId ? { ...t, date: newDate, day: newDay } : t));
    setDraggingId(null);
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, date: newDate, day: newDay }),
    });
  };

  const concerns = tasks.filter(t => t.concern);
  const repeatTemplates = tasks.filter(t => t.repeat && !t.date && !t.concern);
  const regularTasks = tasks.filter(t => !t.concern && !(t.repeat && !t.date));
  const allProjects = [...new Set(regularTasks.flatMap(t => t.project || []))].sort();
  const isMobile = useIsMobile();
  const rangeLabel  = `${dates[0].getMonth()+1}월 ${dates[0].getDate()}일 — ${dates[dates.length-1].getMonth()+1}월 ${dates[dates.length-1].getDate()}일`;

  const filteredAll = t => !t.concern && (activeFilter ? t.project?.includes(activeFilter) : true);
  const totalDone = tasks.filter(filteredAll).filter(t => t.done).length;
  const totalAll  = tasks.filter(filteredAll).length;

  // 미완료 이월 항목 수
  const pastUndoneCount = regularTasks.filter(t => {
    const d = new Date(t.date);
    d.setHours(0,0,0,0);
    const tod = new Date(); tod.setHours(0,0,0,0);
    return d < tod && !t.done;
  }).length;

  const weekLabels = ["이번 주", "다음 주", "3주차", "4주차"];

  const [concernOpen, setConcernOpen] = useState(false);
  const [concernInput, setConcernInput] = useState("");
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  useDragAutoScroll(draggingId);
  useMidnightRefresh(fetchTasks);
  const { requestPermission } = useNotifications(tasks);

  return (
    <div style={{ minHeight: "100vh", background: "#F1F3F0",
      fontFamily: "'Pretendard', -apple-system, sans-serif", padding: "26px 20px 100px" }}>

      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        * { box-sizing: border-box; font-family: 'Pretendard', -apple-system, sans-serif; }
        ::-webkit-scrollbar { height: 4px; width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CCC; border-radius: 4px; }
        button, input { font-family: 'Pretendard', -apple-system, sans-serif; }
@keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div style={{ maxWidth: "1500px", margin: "0 auto" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", flexWrap: "wrap", gap: "14px", marginBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#182418",
              margin: 0, letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              쩜백의 To-Do List
            </h1>
            <p style={{ fontSize: "12px", color: "#AAAAAA", margin: "4px 0 0" }}>{rangeLabel}</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>

            {/* 미완료 알림 뱃지 + 일괄 이월 버튼 */}
            {pastUndoneCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{
                  background: "#FFF3F3", border: "1.5px solid #FFCDD2",
                  borderRadius: "10px", padding: "6px 12px",
                  fontSize: "11px", color: "#C62828", fontWeight: 600,
                  display: "flex", alignItems: "center", gap: "5px",
                }}>
                  🔴 미완료 {pastUndoneCount}건
                </div>
                <button
                  onClick={handleBulkCarryOver}
                  style={{
                    background: "#E65100", border: "none",
                    borderRadius: "10px", padding: "6px 12px",
                    fontSize: "11px", color: "white", fontWeight: 700,
                    cursor: "pointer", whiteSpace: "nowrap",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#BF360C"}
                  onMouseLeave={e => e.currentTarget.style.background = "#E65100"}
                >
                  전체 오늘로 이월 →
                </button>
              </div>
            )}

            {/* 네비게이션 */}
            <div style={{ display: "flex", gap: "5px" }}>
              {[
                { label: "‹", action: () => setWeekOffset(o => o - 4) },
                { label: "오늘", action: () => setWeekOffset(0), isHome: true },
                { label: "›", action: () => setWeekOffset(o => o + 4) },
              ].map(({ label, action, isHome }) => (
                <button key={label} onClick={action} style={{
                  background: isHome && weekOffset === 0 ? "#2D7A5E" : "white",
                  border: `1.5px solid ${isHome && weekOffset === 0 ? "#2D7A5E" : "#E2E2E2"}`,
                  borderRadius: "8px",
                  padding: label === "오늘" ? "0 12px" : "0",
                  width: label === "오늘" ? "auto" : "32px",
                  height: "32px", cursor: "pointer",
                  fontSize: label === "오늘" ? "11px" : "15px", fontWeight: 600,
                  color: isHome && weekOffset === 0 ? "white" : "#666",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}>
                  {label}
                </button>
              ))}
            </div>

            {/* 알림 권한 버튼 */}
            {permission !== "granted" && (
              <button onClick={subscribe} style={{
                background: "#FFF8E1", border: "1.5px solid #FFE082",
                borderRadius: "8px", padding: "0 10px", height: "32px",
                cursor: "pointer", fontSize: "11px", fontWeight: 700,
                color: "#F57F17", display: "flex", alignItems: "center", gap: "4px",
                whiteSpace: "nowrap",
              }} title="알림 권한 허용">
                🔔 알림 켜기
              </button>
            )}
            {permission === "granted" && (
              <div style={{
                fontSize: "11px", color: "#2D7A5E", fontWeight: 600,
                background: "#E8F4F0", borderRadius: "8px", padding: "0 10px", height: "32px",
                display: "flex", alignItems: "center", gap: "4px",
              }}>🔔 알림 ON</div>
            )}

            <button onClick={() => setShowRepeatModal(true)} style={{
              background: "white", border: "1.5px solid #E2E2E2",
              borderRadius: "8px", width: "32px", height: "32px",
              cursor: "pointer", fontSize: "14px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }} title="반복 할 일 설정">🔁</button>

            <button onClick={fetchTasks} style={{
              background: "white", border: "1.5px solid #E2E2E2",
              borderRadius: "8px", width: "32px", height: "32px",
              cursor: "pointer", fontSize: "14px",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#888",
            }} title="새로고침">↻</button>

            {/* 완료율 */}
            <div style={{ background: "white", borderRadius: "12px", padding: "9px 14px",
              display: "flex", alignItems: "center", gap: "10px",
              boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              <div>
                <div style={{ fontSize: "9.5px", color: "#BBBBBB", letterSpacing: "0.4px" }}>완료율</div>
                <div style={{ fontSize: "19px", fontWeight: 700, color: "#2D7A5E", lineHeight: 1.1 }}>
                  {totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0}%
                </div>
              </div>
              <div style={{ width: "46px", height: "46px", position: "relative" }}>
                <svg viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)", width: "46px", height: "46px" }}>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#E8F4F0" strokeWidth="3.5"/>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#2D7A5E" strokeWidth="3.5"
                    strokeDasharray={`${totalAll > 0 ? (totalDone/totalAll)*88 : 0} 88`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 0.6s ease" }}/>
                </svg>
                <div style={{ position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%,-50%)",
                  fontSize: "9px", fontWeight: 700, color: "#2D7A5E" }}>
                  {totalDone}/{totalAll}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── TAG FILTER ── */}
        <RepeatTemplatesPanel
          templates={repeatTemplates}
          onDelete={handleDelete}
          allProjects={allProjects}
        />

        {allProjects.length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
            {[{ tag: null, label: "전체" }, ...allProjects.map(t => ({ tag: t, label: `#${t}` }))].map(({ tag, label }) => {
              const active = activeFilter === tag;
              const s = tag ? getTagStyle(tag) : null;
              return (
                <button key={label} onClick={() => setActiveFilter(active ? null : tag)}
                  style={{
                    padding: "4px 12px", borderRadius: "20px",
                    border: `1.5px solid ${active ? (s ? s.accent : "#2D7A5E") : "#E0E0E0"}`,
                    background: active ? (s ? s.accent : "#2D7A5E") : "white",
                    color: active ? "white" : (s ? s.accent : "#888"),
                    fontSize: "11.5px", fontWeight: 600, cursor: "pointer", transition: "all 0.18s",
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── 로딩 ── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "#AAAAAA", fontSize: "13px" }}>
            Notion에서 불러오는 중...
          </div>
        )}

        {/* ── 4-WEEK GRID ── */}
        {!loading && [0, 1, 2, 3].map(week => {
          const weekDates     = dates.slice(week * 7, week * 7 + 7);
          const monDate       = weekDates[0];
          const isCurrentWeek = weekDates.some(d => isSameDay(d, today));
          const offsetLabel   = weekOffset === 0
            ? weekLabels[week]
            : `${monDate.getMonth()+1}월 ${monDate.getDate()}일 주`;

          return (
            <div key={week} style={{ marginBottom: "14px" }}>
              <WeekDropZone
                weekDates={weekDates}
                monDate={monDate}
                isCurrentWeek={isCurrentWeek}
                offsetLabel={offsetLabel}
                draggingId={draggingId}
                onDrop={handleDrop}
              />

              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? "8px" : "9px", overflowX: isMobile ? "visible" : "auto", paddingBottom: "2px" }}>
                {weekDates.map((date, di) => {
                  const dk = dateKey(date);
                  return (
                    <DayColumn
                      key={dk}
                      date={date}
                      dayLabel={DAYS[di]}
                      tasks={regularTasks.filter(t => t.date === dk)}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onAdd={handleAdd}
                      onCarryOver={handleCarryOver}
                      activeFilter={activeFilter}
                      allProjects={allProjects}
                      isMobile={isMobile}
                      onDrop={handleDrop}
                      draggingId={draggingId}
                      onDragStart={id => setDraggingId(id)}
                      onDragEnd={() => setDraggingId(null)}
                      onAlarmUpdate={handleAlarmUpdate}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        <div style={{ textAlign: "center", marginTop: "18px", marginBottom: "8px", fontSize: "11px", color: "#CCCCCC" }}>
          Notion DB 실시간 연동&nbsp;·&nbsp;
          과거 미완료 항목은 <strong style={{ color: "#E57373" }}>오늘로 이월</strong> 가능&nbsp;·&nbsp;
          ‹ › 버튼으로 4주씩 이동
        </div>
      </div>

      {/* ── 반복 모달 ── */}
      {showRepeatModal && (
        <RepeatModal
          onClose={() => setShowRepeatModal(false)}
          onSave={handleAddRepeat}
          allProjects={allProjects}
        />
      )}

      {/* ── 하단 고민 패널 ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        zIndex: 1000,
        background: "white",
        borderTop: "1.5px solid #E8E8E8",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {/* 핸들 바 — 항상 보임 */}
        <div
          onClick={() => setConcernOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 24px", cursor: "pointer",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "16px" }}>💭</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#333", letterSpacing: "-0.2px" }}>
              상시 고민
            </span>
            {concerns.length > 0 && (
              <span style={{
                background: "#F1F3F0", borderRadius: "10px",
                padding: "1px 8px", fontSize: "11px", color: "#888", fontWeight: 600,
              }}>{concerns.length}</span>
            )}
          </div>
          <div style={{
            fontSize: "18px", color: "#AAAAAA", lineHeight: 1,
            transform: concernOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
          }}>⌃</div>
        </div>

        {/* 펼쳐지는 내용 */}
        {concernOpen && (
          <div style={{
            padding: "0 24px 20px",
            maxHeight: "40vh", overflowY: "auto",
          }}>
            {/* 고민 목록 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
              {concerns.length === 0 && (
                <div style={{ fontSize: "12px", color: "#CCCCCC", padding: "8px 0" }}>
                  아직 등록된 고민이 없어요
                </div>
              )}
              {concerns.map(c => (
                <div key={c.id} style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 14px", borderRadius: "20px",
                  background: "#F8F8F6", border: "1.5px solid #E8E8E4",
                  fontSize: "13px", color: "#333",
                  transition: "all 0.2s ease",
                }}>
                  <span>💬</span>
                  <span>{c.text}</span>
                  <button
                    onClick={() => handleDeleteConcern(c.id)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#CCCCCC", fontSize: "14px", padding: "0", lineHeight: 1,
                    }}
                    onMouseEnter={e => e.target.style.color = "#FF6B6B"}
                    onMouseLeave={e => e.target.style.color = "#CCCCCC"}
                  >×</button>
                </div>
              ))}
            </div>

            {/* 고민 입력 */}
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                value={concernInput}
                onChange={e => setConcernInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && concernInput.trim()) {
                    e.preventDefault();
                    handleAddConcern(concernInput.trim());
                    setConcernInput("");
                  }
                }}
                placeholder="고민 추가..."
                style={{
                  flex: 1, padding: "8px 14px",
                  border: "1.5px solid #E8E8E8", borderRadius: "20px",
                  fontSize: "13px", outline: "none", color: "#333", background: "#FAFAFA",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = "#2D7A5E"}
                onBlur={e => e.target.style.borderColor = "#E8E8E8"}
              />
              <button
                onClick={() => {
                  if (concernInput.trim()) {
                    handleAddConcern(concernInput.trim());
                    setConcernInput("");
                  }
                }}
                style={{
                  background: "#2D7A5E", color: "white", border: "none",
                  borderRadius: "20px", padding: "0 18px", height: "38px",
                  cursor: "pointer", fontSize: "13px", fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >+ 추가</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
