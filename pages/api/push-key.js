// VAPID 공개키 반환 (클라이언트에서 구독 시 필요)
export default function handler(req, res) {
  res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
}
