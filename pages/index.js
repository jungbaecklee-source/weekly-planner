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
function TaskItem({ task, onToggle, onDelete, onCarryOver, isPastTask, isNew }) {
  const primaryProject = task.project?.[0];
  const style = getTagStyle(primaryProject);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 마운트 직후 애니메이션 트리거
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={() => onToggle(task.id, !task.done)}
      style={{
        display: "flex", alignItems: "flex-start", gap: "8px",
        padding: "9px 10px", marginBottom: "5px", borderRadius: "9px",
        background: task.done ? "#F7F7F7" : isPastTask && !task.done ? "#FFF5F5" : style.bg,
        borderLeft: `3px solid ${task.done ? "#DDD" : isPastTask && !task.done ? "#E57373" : style.accent}`,
        opacity: task.done ? 0.55 : visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(-6px) scale(0.97)",
        cursor: "pointer",
        transition: isNew
          ? "opacity 0.3s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)"
          : "opacity 0.25s ease, background 0.2s ease",
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

      <button onClick={e => { e.stopPropagation(); onDelete(task.id); }}
        style={{ background: "none", border: "none", cursor: "pointer",
          color: "#CCCCCC", fontSize: "15px", padding: "0 1px", lineHeight: 1, flexShrink: 0 }}
        onMouseEnter={e => e.target.style.color = "#FF6B6B"}
        onMouseLeave={e => e.target.style.color = "#CCCCCC"}>×</button>
    </div>
  );
}

// ── DayColumn ─────────────────────────────────────────────
function DayColumn({ date, dayLabel, tasks, onToggle, onDelete, onAdd, onCarryOver, activeFilter }) {
  const [input, setInput] = useState("");
  const [projectInput, setProjectInput] = useState("");
  const [showProjectInput, setShowProjectInput] = useState(false);
  const [newTaskIds, setNewTaskIds] = useState(new Set());
  const inputRef = useRef();
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
    const projects = projectInput.split(/[,\s]+/).map(p => p.replace(/^#/, "").trim()).filter(Boolean);
    onAdd(input.trim(), dateKey(date), dayLabel, projects);
    setInput("");
    setProjectInput("");
    setShowProjectInput(false);
    inputRef.current?.focus();
  };

  return (
    <div style={{
      background: isToday ? "white" : "#FAFAFA",
      borderRadius: "14px", padding: "13px 11px",
      border: isToday ? "2px solid #2D7A5E" : hasPastUndone ? "2px solid #FFCDD2" : "2px solid transparent",
      boxShadow: isToday ? "0 4px 20px rgba(45,122,94,0.13)" : "0 1px 3px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", gap: "8px",
      minWidth: "145px", flex: 1,
      opacity: isPast && !hasPastUndone ? 0.65 : 1,
      transition: "all 0.3s ease",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "18px", fontWeight: 700, lineHeight: 1,
            color: isToday ? "#2D7A5E" : isPast ? (hasPastUndone ? "#E57373" : "#CCCCCC") : "#4A4A4A",
            letterSpacing: "-0.2px" }}>{dayLabel}</div>
          <div style={{ fontSize: "11px", marginTop: "3px",
            color: isToday ? "#2D7A5E" : hasPastUndone ? "#E57373" : "#BBBBBB",
            fontWeight: isToday ? 600 : 400 }}>{fmt(date)}</div>
          {isToday && (
            <div style={{ fontSize: "8px", color: "#2D7A5E", fontWeight: 700,
              letterSpacing: "1.2px", marginTop: "2px" }}>TODAY</div>
          )}
          {hasPastUndone && (
            <div style={{ fontSize: "8px", color: "#E57373", fontWeight: 700,
              letterSpacing: "0.8px", marginTop: "2px" }}>미완료</div>
          )}
        </div>
        {total > 0 && (
          <span style={{ fontSize: "10.5px", color: hasPastUndone ? "#E57373" : "#BBBBBB", marginTop: "2px" }}>
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
          />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", gap: "5px" }}>
          <input ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            onFocus={() => setShowProjectInput(true)}
            placeholder="추가"
            style={{
              flex: 1, padding: "5px 8px",
              border: "1.5px solid #E8E8E8", borderRadius: "7px",
              fontSize: "11.5px", outline: "none", color: "#333", background: "white",
              transition: "border-color 0.2s",
            }}
            onBlur={e => e.target.style.borderColor = "#E8E8E8"}
          />
          <button onClick={handleAdd} style={{
            background: "#2D7A5E", color: "white", border: "none",
            borderRadius: "7px", width: "26px", height: "26px",
            cursor: "pointer", fontSize: "15px", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>+</button>
        </div>
        {showProjectInput && (
          <input
            value={projectInput}
            onChange={e => setProjectInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="#프로젝트 (쉼표로 구분)"
            style={{
              padding: "4px 8px",
              border: "1.5px solid #E8E8E8", borderRadius: "7px",
              fontSize: "11px", outline: "none", color: "#666", background: "white",
              transition: "border-color 0.2s",
            }}
            onFocus={e => e.target.style.borderColor = "#2D7A5E"}
            onBlur={e => { e.target.style.borderColor = "#E8E8E8"; if (!input) setShowProjectInput(false); }}
          />
        )}
      </div>
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

  const handleAdd = async (text, date, day, project) => {
    const tempId = `temp-${Date.now()}`;
    setTasks(p => [...p, { id: tempId, text, date, day, project, done: false }]);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, date, day, project }),
    });
    const { id } = await res.json();
    setTasks(p => p.map(t => t.id === tempId ? { ...t, id } : t));
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

  const allProjects = [...new Set(tasks.flatMap(t => t.project || []))].sort();
  const rangeLabel  = `${dates[0].getMonth()+1}월 ${dates[0].getDate()}일 — ${dates[dates.length-1].getMonth()+1}월 ${dates[dates.length-1].getDate()}일`;

  const filteredAll = t => activeFilter ? t.project?.includes(activeFilter) : true;
  const totalDone = tasks.filter(filteredAll).filter(t => t.done).length;
  const totalAll  = tasks.filter(filteredAll).length;

  // 미완료 이월 항목 수
  const pastUndoneCount = tasks.filter(t => {
    const d = new Date(t.date);
    d.setHours(0,0,0,0);
    const tod = new Date(); tod.setHours(0,0,0,0);
    return d < tod && !t.done;
  }).length;

  const weekLabels = ["이번 주", "다음 주", "3주차", "4주차"];

  return (
    <div style={{ minHeight: "100vh", background: "#F1F3F0",
      fontFamily: "'Pretendard', -apple-system, sans-serif", padding: "26px 20px" }}>

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

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>

            {/* 미완료 알림 뱃지 */}
            {pastUndoneCount > 0 && (
              <div style={{
                background: "#FFF3F3", border: "1.5px solid #FFCDD2",
                borderRadius: "10px", padding: "6px 12px",
                fontSize: "11px", color: "#C62828", fontWeight: 600,
                display: "flex", alignItems: "center", gap: "5px",
              }}>
                🔴 미완료 {pastUndoneCount}건
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
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{
                  fontSize: "10px", fontWeight: 700, letterSpacing: "0.7px",
                  color: isCurrentWeek ? "#2D7A5E" : "#BBBBBB", whiteSpace: "nowrap",
                }}>
                  {isCurrentWeek ? `▶ ${offsetLabel}` : offsetLabel}
                  &ensp;{monDate.getMonth()+1}월 {monDate.getDate()}일 — {weekDates[6].getMonth()+1}월 {weekDates[6].getDate()}일
                </span>
                <div style={{ flex: 1, height: "1px", background: "#E6E6E6" }} />
              </div>

              <div style={{ display: "flex", gap: "9px", overflowX: "auto", paddingBottom: "2px" }}>
                {weekDates.map((date, di) => {
                  const dk = dateKey(date);
                  return (
                    <DayColumn
                      key={dk}
                      date={date}
                      dayLabel={DAYS[di]}
                      tasks={tasks.filter(t => t.date === dk)}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onAdd={handleAdd}
                      onCarryOver={handleCarryOver}
                      activeFilter={activeFilter}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        <div style={{ textAlign: "center", marginTop: "18px", fontSize: "11px", color: "#CCCCCC" }}>
          Notion DB 실시간 연동&nbsp;·&nbsp;
          과거 미완료 항목은 <strong style={{ color: "#E57373" }}>오늘로 이월</strong> 가능&nbsp;·&nbsp;
          ‹ › 버튼으로 4주씩 이동
        </div>
      </div>
    </div>
  );
}
