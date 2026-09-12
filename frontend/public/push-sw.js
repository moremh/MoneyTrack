/*
 * MoneyTrack - receptor de Web Push.
 *
 * Este archivo se carga dentro del Service Worker
 * generado por vite-plugin-pwa / Workbox.
 */

const DEFAULT_NOTIFICATION = {
  title: "MoneyTrack",
  body:
    "Tenés un recordatorio pendiente.",
  icon: "/pwa-192x192.png",
  badge: "/favicon-32x32.png",
  url: "/reminders",
};

const normalizePushPayload = (
  event
) => {
  if (!event.data) {
    return {
      ...DEFAULT_NOTIFICATION,
    };
  }

  try {
    const parsed =
      event.data.json();

    return {
      ...DEFAULT_NOTIFICATION,
      ...parsed,

      data: {
        url:
          parsed?.data?.url ||
          parsed?.url ||
          DEFAULT_NOTIFICATION.url,

        reminderId:
          parsed?.data
            ?.reminderId ||
          parsed?.reminderId ||
          null,

        ...(parsed?.data ||
          {}),
      },
    };
  } catch {
    const text =
      event.data.text();

    return {
      ...DEFAULT_NOTIFICATION,
      body:
        text ||
        DEFAULT_NOTIFICATION.body,

      data: {
        url:
          DEFAULT_NOTIFICATION.url,
      },
    };
  }
};

self.addEventListener(
  "push",
  (event) => {
    const payload =
      normalizePushPayload(
        event
      );

    const options = {
      body:
        payload.body,

      icon:
        payload.icon ||
        DEFAULT_NOTIFICATION.icon,

      badge:
        payload.badge ||
        DEFAULT_NOTIFICATION.badge,

      tag:
        payload.tag ||
        (
          payload.data
            ?.reminderId
            ? `moneytrack-reminder-${payload.data.reminderId}`
            : "moneytrack-reminder"
        ),

      renotify:
        Boolean(
          payload.renotify
        ),

      requireInteraction:
        Boolean(
          payload
            .requireInteraction
        ),

      data: {
        url:
          payload.data?.url ||
          DEFAULT_NOTIFICATION.url,

        reminderId:
          payload.data
            ?.reminderId ||
          null,
      },

      actions: [
        {
          action:
            "open-reminders",
          title:
            "Ver recordatorios",
        },
      ],
    };

    event.waitUntil(
      self.registration
        .showNotification(
          payload.title ||
            DEFAULT_NOTIFICATION.title,
          options
        )
    );
  }
);

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl =
      new URL(
        event.notification
          .data?.url ||
          DEFAULT_NOTIFICATION.url,
        self.location.origin
      ).href;

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled:
            true,
        })
        .then(
          async (
            windowClients
          ) => {
            /*
             * Si MoneyTrack ya está abierto,
             * enfocamos esa pestaña y navegamos
             * a Recordatorios.
             */
            for (
              const client of
              windowClients
            ) {
              if (
                new URL(
                  client.url
                ).origin ===
                self.location
                  .origin
              ) {
                if (
                  "navigate" in
                  client
                ) {
                  await client
                    .navigate(
                      targetUrl
                    );
                }

                return client
                  .focus();
              }
            }

            /*
             * Si no está abierto, iniciamos una
             * nueva ventana/PWA directamente en
             * la pantalla correspondiente.
             */
            if (
              self.clients
                .openWindow
            ) {
              return self.clients
                .openWindow(
                  targetUrl
                );
            }

            return null;
          }
        )
    );
  }
);
