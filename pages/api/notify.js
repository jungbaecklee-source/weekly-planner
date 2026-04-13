import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:admin@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// 메모리 구독 저장소 (단일 사용자)
let storedSubscription = null;

export default async function handler(req, res) {
  if (req.method === "POST" && req.body?.type === "subscribe") {
    // 구독 저장
    storedSubscription = req.body.subscription;
    return res.status(200).json({ ok: true });
  }

  if (req.method === "POST" && req.body?.type === "send") {
    // 즉시 알림 발송
    const { title, body } = req.body;
    if (!storedSubscription) return res.status(400).json({ error: "구독 없음" });
    try {
      await webpush.sendNotification(storedSubscription, JSON.stringify({ title, body }));
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
}

export { storedSubscription };
