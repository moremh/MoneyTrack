import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY =
  String(
    import.meta.env
      .VITE_VAPID_PUBLIC_KEY ||
      ""
  ).trim();

const READY_TIMEOUT_MS =
  10000;

const wait = (
  milliseconds
) =>
  new Promise(
    (resolve) =>
      window.setTimeout(
        resolve,
        milliseconds
      )
  );

const urlBase64ToUint8Array = (
  base64String
) => {
  const padding =
    "=".repeat(
      (
        4 -
        (
          base64String
            .length % 4
        )
      ) % 4
    );

  const base64 =
    (
      base64String +
      padding
    )
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      );

  const rawData =
    window.atob(
      base64
    );

  const outputArray =
    new Uint8Array(
      rawData.length
    );

  for (
    let index = 0;
    index <
    rawData.length;
    index += 1
  ) {
    outputArray[index] =
      rawData.charCodeAt(
        index
      );
  }

  return outputArray;
};

const uint8ArrayToBase64Url = (
  value
) => {
  const bytes =
    value instanceof
    Uint8Array
      ? value
      : new Uint8Array(
          value
        );

  let binary = "";

  for (
    const byte of bytes
  ) {
    binary +=
      String.fromCharCode(
        byte
      );
  }

  return window
    .btoa(binary)
    .replace(
      /\+/g,
      "-"
    )
    .replace(
      /\//g,
      "_"
    )
    .replace(
      /=+$/g,
      ""
    );
};

const getRegistration =
  async () => {
    if (
      typeof window ===
        "undefined" ||
      !(
        "serviceWorker" in
        navigator
      )
    ) {
      return {
        success: false,
        registration: null,
        message:
          "Este navegador no admite Service Workers.",
      };
    }

    const existing =
      await navigator
        .serviceWorker
        .getRegistration();

    if (existing) {
      return {
        success: true,
        registration:
          existing,
      };
    }

    const result =
      await Promise.race([
        navigator
          .serviceWorker
          .ready
          .then(
            (
              registration
            ) => ({
              success: true,
              registration,
            })
          ),

        wait(
          READY_TIMEOUT_MS
        ).then(() => ({
          success: false,
          registration: null,
          message:
            "El Service Worker todavía no está disponible. Probá nuevamente desde la versión instalada o publicada de MoneyTrack.",
        })),
      ]);

    return result;
  };

const getSubscriptionKey =
  (subscription) => {
    try {
      const applicationServerKey =
        subscription
          ?.options
          ?.applicationServerKey;

      if (
        !applicationServerKey
      ) {
        return null;
      }

      return uint8ArrayToBase64Url(
        applicationServerKey
      );
    } catch {
      return null;
    }
  };

export const isPushSupported =
  () => {
    return (
      typeof window !==
        "undefined" &&
      "Notification" in
        window &&
      "serviceWorker" in
        navigator &&
      "PushManager" in
        window
    );
  };

export const hasVapidPublicKey =
  () =>
    Boolean(
      VAPID_PUBLIC_KEY
    );

export const getCurrentPushSubscription =
  async () => {
    if (
      !isPushSupported()
    ) {
      return {
        success: false,
        subscription: null,
        message:
          "Este navegador no admite notificaciones Push.",
      };
    }

    const registrationResult =
      await getRegistration();

    if (
      !registrationResult
        .success
    ) {
      return {
        ...registrationResult,
        subscription: null,
      };
    }

    const subscription =
      await registrationResult
        .registration
        .pushManager
        .getSubscription();

    return {
      success: true,
      subscription:
        subscription ||
        null,
    };
  };

const saveSubscriptionInSupabase =
  async (subscription) => {
    const serialized =
      subscription.toJSON();

    const endpoint =
      serialized.endpoint ||
      subscription.endpoint ||
      "";

    const p256dh =
      serialized.keys
        ?.p256dh ||
      "";

    const auth =
      serialized.keys
        ?.auth ||
      "";

    if (
      !endpoint ||
      !p256dh ||
      !auth
    ) {
      return {
        success: false,
        message:
          "El navegador no devolvió una suscripción Push completa.",
      };
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "save_my_push_subscription",
      {
        p_endpoint:
          endpoint,

        p_p256dh:
          p256dh,

        p_auth:
          auth,

        p_user_agent:
          navigator.userAgent ||
          null,

        p_platform:
          navigator
            .userAgentData
            ?.platform ||
          navigator.platform ||
          null,
      }
    );

    if (error) {
      console.error(
        "No se pudo guardar la suscripción Push:",
        error
      );

      return {
        success: false,
        message:
          "No se pudo guardar este dispositivo para recibir notificaciones.",
        error,
      };
    }

    return {
      success: true,
      subscription,
      record:
        Array.isArray(data)
          ? data[0] ||
            null
          : data ||
            null,
    };
  };

const removeEndpointFromSupabase =
  async (endpoint) => {
    if (!endpoint) {
      return {
        success: true,
      };
    }

    const {
      error,
    } = await supabase.rpc(
      "remove_my_push_subscription",
      {
        p_endpoint:
          endpoint,
      }
    );

    if (error) {
      console.error(
        "No se pudo quitar la suscripción Push de Supabase:",
        error
      );

      return {
        success: false,
        error,
      };
    }

    return {
      success: true,
    };
  };

export const subscribeCurrentDeviceToPush =
  async () => {
    if (
      !isPushSupported()
    ) {
      return {
        success: false,
        status:
          "unsupported",
        message:
          "Este navegador no admite notificaciones Push.",
      };
    }

    if (
      !VAPID_PUBLIC_KEY
    ) {
      return {
        success: false,
        status:
          "missing-key",
        message:
          "Falta configurar VITE_VAPID_PUBLIC_KEY.",
      };
    }

    if (
      window.Notification
        .permission !==
      "granted"
    ) {
      return {
        success: false,
        status:
          "permission-required",
        message:
          "Primero tenés que permitir las notificaciones.",
      };
    }

    const registrationResult =
      await getRegistration();

    if (
      !registrationResult
        .success
    ) {
      return {
        success: false,
        status:
          "service-worker-unavailable",
        message:
          registrationResult
            .message,
      };
    }

    const registration =
      registrationResult
        .registration;

    let subscription =
      await registration
        .pushManager
        .getSubscription();

    /*
     * Si ya existía una suscripción creada
     * con otra clave VAPID, la reemplazamos.
     */
    if (subscription) {
      const currentKey =
        getSubscriptionKey(
          subscription
        );

      if (
        currentKey &&
        currentKey !==
          VAPID_PUBLIC_KEY
      ) {
        const oldEndpoint =
          subscription.endpoint;

        await removeEndpointFromSupabase(
          oldEndpoint
        );

        try {
          await subscription
            .unsubscribe();
        } catch (
          unsubscribeError
        ) {
          console.warn(
            "No se pudo eliminar la suscripción Push anterior:",
            unsubscribeError
          );
        }

        subscription =
          null;
      }
    }

    if (!subscription) {
      try {
        subscription =
          await registration
            .pushManager
            .subscribe({
              userVisibleOnly:
                true,

              applicationServerKey:
                urlBase64ToUint8Array(
                  VAPID_PUBLIC_KEY
                ),
            });
      } catch (error) {
        console.error(
          "No se pudo crear la suscripción Push:",
          error
        );

        return {
          success: false,
          status:
            "subscription-error",
          message:
            "No se pudo registrar este navegador para notificaciones Push.",
          error,
        };
      }
    }

    const saved =
      await saveSubscriptionInSupabase(
        subscription
      );

    if (!saved.success) {
      return {
        ...saved,
        status:
          "save-error",
      };
    }

    return {
      success: true,
      status:
        "subscribed",
      subscription,
      record:
        saved.record,
      message:
        "Este dispositivo quedó registrado para recibir notificaciones Push.",
    };
  };

export const unsubscribeCurrentDeviceFromPush =
  async () => {
    if (
      !isPushSupported()
    ) {
      return {
        success: true,
        status:
          "unsupported",
      };
    }

    const current =
      await getCurrentPushSubscription();

    if (
      !current.success
    ) {
      return current;
    }

    const subscription =
      current.subscription;

    if (!subscription) {
      return {
        success: true,
        status:
          "not-subscribed",
      };
    }

    const endpoint =
      subscription.endpoint;

    const remoteResult =
      await removeEndpointFromSupabase(
        endpoint
      );

    if (
      !remoteResult.success
    ) {
      return {
        success: false,
        status:
          "remove-error",
        message:
          "No se pudo quitar este dispositivo de las notificaciones.",
      };
    }

    try {
      await subscription
        .unsubscribe();
    } catch (error) {
      console.warn(
        "La suscripción se quitó de Supabase, pero el navegador no pudo eliminarla localmente:",
        error
      );
    }

    return {
      success: true,
      status:
        "not-subscribed",
      message:
        "Las notificaciones Push quedaron desactivadas en este dispositivo.",
    };
  };

export const showTestSystemNotification =
  async () => {
    if (
      !isPushSupported()
    ) {
      return {
        success: false,
        message:
          "Este navegador no admite notificaciones del sistema.",
      };
    }

    if (
      window.Notification
        .permission !==
      "granted"
    ) {
      return {
        success: false,
        message:
          "Primero tenés que permitir las notificaciones.",
      };
    }

    const registrationResult =
      await getRegistration();

    if (
      !registrationResult
        .success
    ) {
      return registrationResult;
    }

    try {
      await registrationResult
        .registration
        .showNotification(
          "MoneyTrack · Prueba",
          {
            body:
              "Si ves este aviso, las notificaciones del sistema están habilitadas en este dispositivo.",
            icon:
              "/pwa-192x192.png",
            badge:
              "/favicon-32x32.png",
            tag:
              "moneytrack-notification-test",
            renotify: true,
            requireInteraction:
              true,
            silent: false,
            vibrate: [
              220,
              100,
              220,
              100,
              320,
            ],
            data: {
              url: "/settings",
            },
          }
        );

      return {
        success: true,
        message:
          "Notificación de prueba enviada al sistema.",
      };
    } catch (error) {
      console.error(
        "No se pudo mostrar la notificación de prueba:",
        error
      );

      return {
        success: false,
        message:
          "No se pudo mostrar la notificación de prueba.",
        error,
      };
    }
  };
