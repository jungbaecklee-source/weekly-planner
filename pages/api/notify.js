export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // web-push를 동적으로 import (서버 사이드 전용)
  const webpush = (await import("web-push")).default;

  webpush.setVapidDetails(
    "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const { type, subscription, title, body } = req.body;

  if (type === "subscribe") {
    // 구독 정보를 전역 변수에 저장 (단일 사용자용)
    global._pushSubscription = subscription;
    return res.status(200).json({ ok: true });
  }

  if (type === "send") {
    if (!global._pushSubscription) {
      return res.status(400).json({ error: "구독 없음" });
    }
    try {
      await webpush.sendNotification(
        global._pushSubscription,
        JSON.stringify({ title, body })
      );
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(400).json({ error: "잘못된 요청" });
}
