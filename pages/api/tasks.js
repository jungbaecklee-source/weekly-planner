import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function dayLabel(d) {
  return DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

function getRepeatDates(template) {
  const results = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const end = new Date(today); end.setDate(end.getDate() + 28);

  for (let d = new Date(today); d <= end; d.setDate(d.getDate() + 1)) {
    const cur = new Date(d);
    const dow = cur.getDay() === 0 ? 6 : cur.getDay() - 1;
    const dom = cur.getDate();
    const label = DAYS[dow];

    if (template.repeat === "매일") {
      results.push({ date: dateKey(cur), day: label });
    } else if (template.repeat === "매주전체" && dow <= 4) {
      results.push({ date: dateKey(cur), day: label });
    } else if (template.repeat === "매주" && template.repeatDays?.includes(label)) {
      results.push({ date: dateKey(cur), day: label });
    } else if (template.repeat === "매달" && template.repeatDays?.map(Number).includes(dom)) {
      results.push({ date: dateKey(cur), day: label });
    }
  }
  return results;
}

async function fetchAllPages() {
  let allResults = [];
  let cursor = undefined;
  do {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      // sort 없이 가져와서 날짜 없는 항목(고민, 반복템플릿)도 누락 없이 수집
      start_cursor: cursor,
      page_size: 100,
    });
    allResults = allResults.concat(response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return allResults;
}

export default async function handler(req, res) {

  // ── GET ──────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const allResults = await fetchAllPages();

      const tasks = allResults.map((page) => ({
        id: page.id,
        text: page.properties["이름"]?.title?.[0]?.plain_text || "",
        date: page.properties["날짜"]?.date?.start || null,
        day: page.properties["요일"]?.select?.name || null,
        project: page.properties["프로젝트"]?.multi_select?.map((t) => t.name) || [],
        done: page.properties["완료"]?.checkbox || false,
        concern: page.properties["고민"]?.checkbox || false,
        repeat: page.properties["반복"]?.select?.name || null,
        repeatDays: page.properties["반복요일"]?.multi_select?.map(t => t.name) || [],
        alarmAt: page.properties["알림시간"]?.date?.start || null,
        alarmAt: page.properties["알림시간"]?.date?.start || null,
      }));

      // 고민 항목 — concern: true (별도 보존)
      const concerns = tasks.filter(t => t.concern);

      // 반복 템플릿 — 반복 속성 있고 날짜 없는 항목
      const templates = tasks.filter(t => t.repeat && !t.date && !t.concern);

      // 일반 항목 — 나머지
      const regular = tasks.filter(t => !t.concern && !(t.repeat && !t.date));

      // 반복 항목 중복 방지 키
      const existingKeys = new Set(
        regular.filter(t => t.date).map(t => `${t.text}__${t.date}`)
      );

      const toCreate = [];
      for (const tmpl of templates) {
        const dates = getRepeatDates(tmpl);
        for (const { date, day } of dates) {
          const key = `${tmpl.text}__${date}`;
          if (!existingKeys.has(key)) {
            toCreate.push({ tmpl, date, day });
            existingKeys.add(key);
          }
        }
      }

      // 반복 항목 배치 생성
      const created = [];
      for (let i = 0; i < toCreate.length; i += 10) {
        const batch = toCreate.slice(i, i + 10);
        const results = await Promise.all(batch.map(({ tmpl, date, day }) =>
          notion.pages.create({
            parent: { database_id: DATABASE_ID },
            properties: {
              이름: { title: [{ text: { content: tmpl.text } }] },
              날짜: { date: { start: date } },
              요일: { select: { name: day } },
              프로젝트: { multi_select: (tmpl.project || []).map(name => ({ name })) },
              완료: { checkbox: false },
            },
          }).then(page => ({
            id: page.id, text: tmpl.text, date, day,
            project: tmpl.project || [], done: false,
            concern: false, repeat: null, repeatDays: [],
          }))
        ));
        created.push(...results);
      }

      // 고민 + 일반 + 새로 생성된 반복 항목 모두 반환
      res.status(200).json([...concerns, ...regular, ...created]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Notion API 오류" });
    }
  }

  // ── POST ─────────────────────────────────────────────────
  else if (req.method === "POST") {
    const { text, date, day, project, concern, repeat, repeatDays, alarmAt } = req.body;
    try {
      const props = {
        이름: { title: [{ text: { content: text } }] },
        프로젝트: { multi_select: (project || []).map((name) => ({ name })) },
        완료: { checkbox: false },
        고민: { checkbox: concern === true },
      };
      if (date) props["날짜"] = { date: { start: date } };
      if (day)  props["요일"] = { select: { name: day } };
      if (repeat) props["반복"] = { select: { name: repeat } };
      if (repeatDays?.length) props["반복요일"] = { multi_select: repeatDays.map(name => ({ name })) };
      if (alarmAt) props["알림시간"] = { date: { start: alarmAt } };
      if (alarmAt) props["알림시간"] = { date: { start: alarmAt } };

      const page = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties: props,
      });
      res.status(200).json({ id: page.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "생성 오류: " + error.message });
    }
  }

  // ── PATCH ────────────────────────────────────────────────
  else if (req.method === "PATCH") {
    const { id, done, date, day, alarmAt } = req.body;
    try {
      const properties = {};
      if (typeof done !== "undefined") properties["완료"] = { checkbox: done };
      if (date) properties["날짜"] = { date: { start: date } };
      if (day)  properties["요일"] = { select: { name: day } };
      if (alarmAt !== undefined) properties["알림시간"] = alarmAt ? { date: { start: alarmAt } } : { date: null };
      await notion.pages.update({ page_id: id, properties });
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "업데이트 오류" });
    }
  }

  // ── DELETE ───────────────────────────────────────────────
  else if (req.method === "DELETE") {
    const { id } = req.body;
    try {
      await notion.pages.update({ page_id: id, archived: true });
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "삭제 오류" });
    }
  }

  else {
    res.status(405).json({ error: "허용되지 않는 메서드" });
  }
}
