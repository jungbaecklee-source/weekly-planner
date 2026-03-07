import { useState, useEffect, useRef, useCallback } from "react";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

const COLORS = {
  "거꾸로캠퍼스": { bg: "#E8F4F0", accent: "#2D7A5E", light: "#A8D5C2" },
  "교육실험실21": { bg: "#EEF0F8", accent: "#4A5FA8", light: "#B0BCE8" },
  "연구":         { bg: "#FDF3E7", accent: "#C4721A", light: "#F0C490" },
  "회의":         { bg: "#F5EEFA", accent: "#7B3FA8", light: "#CCA8E8" },
  "개인":         { bg: "#FEF0EF", accent: "#C44040", light: "#F0AAAA" },
  "컨설팅":       { bg: "#EFFAF3", accent: "#2A8A50", light: "#8ADAAA" },
  default:        { bg: "#F5F5F5", accent: "#777",    light: "#CCC"    },
};

function getTagStyle(tag) { return COLORS[tag] || COLORS.default; }

function getMonday(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(now);
  mon.setDate(diff + offsetWeeks * 7);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function buildDates(monday) {
  return Array.from({ length: 14 }, (_, i) => {
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

// ── TaskItem ──────────────────────────────────────────────
function TaskItem({ task, onToggle, onDelete }) {
  const primaryProject = task.project?.[0];
  const style = getTagStyle(primaryProject);

  return (
    <div
      onClick={() => onToggle(task.id, !task.done)}
      style={{
        display: "flex", alignItems: "flex-start", gap: "8px",
        padding: "9px 10px", marginBottom: "5px", borderRadius: "9px",
        background: task.done ? "#F7F7F7" : style.bg,
        borderLeft: `3px solid ${task.done ? "#DDD" : style.accent}`,
        opacity: task.done ? 0.55 : 1,
        cursor: "pointer", transition: "all 0.25s ease",
      }}
    >
      <div style={{
        width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, marginTop: "1px",
        border: `2px solid ${task.done ? "#BBB" : style.accent}`,
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

      <div style={{ flex: 1, minWidth: 0, fontSize: "12.5px", lineHeight: "1.45",
        color: task.done ? "#AAAAAA" : "#222",
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

      <button onClick={e => { e.stopPropagation(); onDelete(task.id); }}
        style={{ background: "none", border: "none", cursor: "pointer",
          color: "#CCCCCC", fontSize: "15px", padding: "0 1px", lineHeight: 1, flexShrink: 0 }}
        onMouseEnter={e => e.target.style.color = "#FF6B6B"}
        onMouseLeave={e => e.target.style.color = "#CCCCCC"}>×</button>
    </div>
  );
}

// ── DayColumn ─────────────────────────────────────────────
function DayColumn({ date, dayLabel, tasks, onToggle, onDelete, onAdd, activeFilter }) {
  const [input, setInput] = useState("");
  const [projectInput, setProjectInput] = useState("");
  const [showProjectInput, setShowProjectInput] = useState(false);
  const inputRef = useRef();
  const today = new Date();
  const isToday = isSameDay(date, today);
  const isPast  = date < today && !isToday;

  const filtered = activeFilter
    ? tasks.filter(t => t.project?.includes(activeFilter))
    : tasks;

  const done  = filtered.filter(t => t.done).length;
  const total = filtered.length;
  const pct   = total > 0 ? (done / total) * 100 : 0;

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
      border: isToday ? "2px solid #2D7A5E" : "2px solid transparent",
      boxShadow: isToday ? "0 4px 20px rgba(45,122,94,0.13)" : "0 1px 3px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", gap: "8px",
      minWidth: "145px", flex: 1,
      opacity: isPast ? 0.72 : 1,
      transition: "all 0.3s ease",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "18px", fontWeight: 700, lineHeight: 1,
            color: isToday ? "#2D7A5E" : isPast ? "#CCCCCC" : "#4A4A4A",
            letterSpacing: "-0.2px" }}>{dayLabel}</div>
          <div style={{ fontSize: "11px", marginTop: "3px",
            color: isToday ? "#2D7A5E" : "#BBBBBB",
            fontWeight: isToday ? 600 : 400 }}>{fmt(date)}</div>
          {isToday && (
            <div style={{ fontSize: "8px", color: "#2D7A5E", fontWeight: 700,
              letterSpacing: "1.2px", marginTop: "2px" }}>TODAY</div>
          )}
        </div>
        {total > 0 && (
          <span style={{ fontSize: "10.5px", color: "#BBBBBB", marginTop: "2px" }}>{done}/{total}</span>
        )}
      </div>

      {total > 0 && (
        <div style={{ height: "2.5px", background: "#EEEEEE", borderRadius: "4px", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: pct === 100 ? "#2D7A5E" : "#A8D5C2",
            borderRadius: "4px", transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
          }} />
        </div>
      )}

      <div style={{ flex: 1, minHeight: "32px" }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: "10.5px", color: "#DDDDDD", textAlign: "center", paddingTop: "8px" }}>—</div>
        )}
        {filtered.map(t => (
          <TaskItem key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} />
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
            onBlur={e => { e.target.style.borderColor = "#E8E8E8"; }}
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
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(null);

  const monday = getMonday(weekOffset);
  const dates  = buildDates(monday);
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
    const newTask = { id: tempId, text, date, day, project, done: false };
    setTasks(p => [...p, newTask]);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, date, day, project }),
    });
    const { id } = await res.json();
    setTasks(p => p.map(t => t.id === tempId ? { ...t, id } : t));
  };

  const allProjects = [...new Set(tasks.flatMap(t => t.project || []))].sort();
  const rangeLabel = `${dates[0].getMonth()+1}월 ${dates[0].getDate()}일 — ${dates[13].getMonth()+1}월 ${dates[13].getDate()}일`;

  const filteredAll = t => activeFilter ? t.project?.includes(activeFilter) : true;
  const totalDone = tasks.filter(filteredAll).filter(t => t.done).length;
  const totalAll  = tasks.filter(filteredAll).length;

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
      `}</style>

      <div style={{ maxWidth: "1500px", margin: "0 auto" }}>

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", flexWrap: "wrap", gap: "14px", marginBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#182418",
              margin: 0, letterSpacing: "-0.4px", lineHeight: 1.2 }}>2주 플래너</h1>
            <p style={{ fontSize: "12px", color: "#AAAAAA", margin: "4px 0 0" }}>{rangeLabel}</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", gap: "5px" }}>
              {[
                { label: "‹", action: () => setWeekOffset(o => o - 2) },
                { label: "오늘", action: () => setWeekOffset(0), isHome: true },
                { label: "›", action: () => setWeekOffset(o => o + 2) },
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
              color: "#888", transition: "all 0.15s",
            }} title="새로고침">↻</button>

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

        {/* TAG FILTER */}
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

        {/* 로딩 */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "#AAAAAA", fontSize: "13px" }}>
            Notion에서 불러오는 중...
          </div>
        )}

        {/* 2-WEEK GRID */}
        {!loading && [0, 1].map(week => {
          const weekDates = dates.slice(week * 7, week * 7 + 7);
          const monDate   = weekDates[0];
          const isCurrentWeek = weekDates.some(d => isSameDay(d, today));

          return (
            <div key={week} style={{ marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{
                  fontSize: "10px", fontWeight: 700, letterSpacing: "0.7px",
                  color: isCurrentWeek ? "#2D7A5E" : "#BBBBBB", whiteSpace: "nowrap",
                }}>
                  {isCurrentWeek ? "▶ 이번 주" : week === 0 ? "첫째 주" : "둘째 주"}
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
                      activeFilter={activeFilter}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        <div style={{ textAlign: "center", marginTop: "18px", fontSize: "11px", color: "#CCCCCC" }}>
          Notion DB와 실시간 연동 중&nbsp;·&nbsp;
          할 일 입력 후 <strong style={{ color: "#BBBBBB" }}>#프로젝트</strong> 태그 추가 가능
        </div>
      </div>
    </div>
  );
}
