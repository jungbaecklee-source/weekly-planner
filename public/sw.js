// ── Service Worker for Push Notifications ─────────────────

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// 알림 클릭 시 앱으로 포커스
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return self.clients.openWindow("/");
    })
  );
});

// 메인 앱에서 메시지로 알림 예약
self.addEventListener("message", e => {
  if (e.data?.type === "SCHEDULE_NOTIFICATION") {
    const { id, title, body, fireAt } = e.data;
    const delay = fireAt - Date.now();
    if (delay <= 0) return;

    // 기존 타이머 취소 후 재등록
    if (self._timers) {
      if (self._timers[id]) clearTimeout(self._timers[id]);
    } else {
      self._timers = {};
    }

    self._timers[id] = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: id,
        requireInteraction: false,
      });
    }, delay);
  }

  if (e.data?.type === "CANCEL_NOTIFICATION") {
    if (self._timers?.[e.data.id]) {
      clearTimeout(self._timers[e.data.id]);
      delete self._timers[e.data.id];
    }
  }
});
