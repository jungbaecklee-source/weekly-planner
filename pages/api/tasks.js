import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        sorts: [{ property: "날짜", direction: "ascending" }],
      });

      const tasks = response.results.map((page) => ({
        id: page.id,
        text: page.properties["이름"]?.title?.[0]?.plain_text || "",
        date: page.properties["날짜"]?.date?.start || null,
        day: page.properties["요일"]?.select?.name || null,
        project: page.properties["프로젝트"]?.multi_select?.map((t) => t.name) || [],
        done: page.properties["완료"]?.checkbox || false,
        concern: page.properties["고민"]?.checkbox || false,
      }));

      res.status(200).json(tasks);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Notion API 오류" });
    }
  }

  else if (req.method === "POST") {
    const { text, date, day, project, concern } = req.body;
    try {
      const page = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties: {
          이름: { title: [{ text: { content: text } }] },
          날짜: date ? { date: { start: date } } : {},
          요일: day ? { select: { name: day } } : {},
          프로젝트: {
            multi_select: (project || []).map((name) => ({ name })),
          },
          완료: { checkbox: false },
          고민: { checkbox: concern || false },
        },
      });
      res.status(200).json({ id: page.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "생성 오류" });
    }
  }

  else if (req.method === "PATCH") {
    const { id, done, date, day } = req.body;
    try {
      const properties = {};
      if (typeof done !== "undefined") properties["완료"] = { checkbox: done };
      if (date) properties["날짜"] = { date: { start: date } };
      if (day)  properties["요일"] = { select: { name: day } };
      await notion.pages.update({ page_id: id, properties });
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "업데이트 오류" });
    }
  }

  else if (req.method === "DELETE") {
    const { id } = req.body;
    try {
      await notion.pages.update({
        page_id: id,
        archived: true,
      });
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
