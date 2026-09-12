/// <reference types="npm:@types/node@24" />
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from "npm:web-push@3.6.7";
import {
  createClient,
} from "npm:@supabase/supabase-js@2.111.0";

type ReminderRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  reminder_date: string;
  reminder_time: string;
  timezone: string;
  status: string;
  notified_at: string | null;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  is_active: boolean;
};

const jsonResponse = (
  body: unknown,
  status = 200,
) =>
  new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "no-store",
      },
    },
  );

const requireEnv = (
  name: string,
) => {
  const value =
    Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`,
    );
  }

  return value;
};

const getServiceRoleKey =
  () => {
    const legacy =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      )?.trim();

    if (legacy) {
      return legacy;
    }

    const rawSecretKeys =
      Deno.env.get(
        "SUPABASE_SECRET_KEYS",
      );

    if (!rawSecretKeys) {
      throw new Error(
        "Missing Supabase secret key environment variable.",
      );
    }

    const parsed =
      JSON.parse(
        rawSecretKeys,
      ) as Record<
        string,
        string
      >;

    const key =
      parsed.default?.trim();

    if (!key) {
      throw new Error(
        "Missing default Supabase secret key.",
      );
    }

    return key;
  };

const normalizeTime = (
  value: string,
) => {
  const match =
    String(value || "")
      .trim()
      .match(
        /^([01]\d|2[0-3]):([0-5]\d)/,
      );

  if (!match) {
    return "00:00";
  }

  return `${match[1]}:${match[2]}`;
};

const getNowKeyInTimezone = (
  timezone: string,
  date = new Date(),
) => {
  try {
    const parts =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            timezone ||
            "America/Argentina/Buenos_Aires",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        },
      ).formatToParts(date);

    const values:
      Record<string, string> =
      {};

    for (
      const part of parts
    ) {
      if (
        part.type !==
        "literal"
      ) {
        values[part.type] =
          part.value;
      }
    }

    return (
      `${values.year}-${values.month}-${values.day}` +
      `T${values.hour}:${values.minute}`
    );
  } catch {
    return date
      .toISOString()
      .slice(0, 16);
  }
};

const isDue = (
  reminder: ReminderRow,
  now = new Date(),
) => {
  const reminderKey =
    `${reminder.reminder_date}` +
    `T${normalizeTime(
      reminder.reminder_time,
    )}`;

  const currentKey =
    getNowKeyInTimezone(
      reminder.timezone,
      now,
    );

  return (
    reminder.status ===
      "pending" &&
    !reminder.notified_at &&
    reminderKey <=
      currentKey
  );
};

const isGonePushEndpoint = (
  error: unknown,
) => {
  const statusCode =
    Number(
      (
        error as {
          statusCode?: number;
        }
      )?.statusCode,
    );

  return (
    statusCode === 404 ||
    statusCode === 410
  );
};

const getTomorrowUtcDate =
  () => {
    const date =
      new Date(
        Date.now() +
          24 *
            60 *
            60 *
            1000,
      );

    return date
      .toISOString()
      .slice(0, 10);
  };

Deno.serve(
  async (
    request: Request,
  ) => {
    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Method not allowed.",
        },
        405,
      );
    }

    try {
      const cronSecret =
        requireEnv(
          "REMINDER_CRON_SECRET",
        );

      const receivedSecret =
        request.headers
          .get(
            "x-cron-secret",
          )
          ?.trim() ||
        "";

      if (
        !receivedSecret ||
        receivedSecret !==
          cronSecret
      ) {
        return jsonResponse(
          {
            success: false,
            message:
              "Unauthorized.",
          },
          401,
        );
      }

      const supabaseUrl =
        requireEnv(
          "SUPABASE_URL",
        );

      const serviceRoleKey =
        getServiceRoleKey();

      const vapidPublicKey =
        requireEnv(
          "VAPID_PUBLIC_KEY",
        );

      const vapidPrivateKey =
        requireEnv(
          "VAPID_PRIVATE_KEY",
        );

      const vapidSubject =
        requireEnv(
          "VAPID_SUBJECT",
        );

      webpush.setVapidDetails(
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey,
      );

      const supabase =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              persistSession:
                false,
              autoRefreshToken:
                false,
            },
          },
        );

      /*
       * reminder_date <= mañana UTC reduce
       * la cantidad de filas sin perder
       * recordatorios válidos de otras
       * zonas horarias. La comprobación
       * exacta se hace después con Intl.
       */
      const {
        data:
          candidateRows,
        error:
          candidateError,
      } = await supabase
        .from("reminders")
        .select(
          [
            "id",
            "user_id",
            "title",
            "description",
            "reminder_date",
            "reminder_time",
            "timezone",
            "status",
            "notified_at",
          ].join(","),
        )
        .eq(
          "status",
          "pending",
        )
        .is(
          "notified_at",
          null,
        )
        .lte(
          "reminder_date",
          getTomorrowUtcDate(),
        )
        .order(
          "reminder_date",
          {
            ascending: true,
          },
        )
        .order(
          "reminder_time",
          {
            ascending: true,
          },
        )
        .limit(100);

      if (
        candidateError
      ) {
        throw candidateError;
      }

      const now =
        new Date();

      const dueReminders =
        (
          candidateRows ||
          []
        )
          .map(
            (
              row,
            ) =>
              row as
                ReminderRow,
          )
          .filter(
            (
              reminder,
            ) =>
              isDue(
                reminder,
                now,
              ),
          );

      let claimed = 0;
      let sent = 0;
      let noDevices = 0;
      let removedSubscriptions =
        0;
      let transientFailures =
        0;

      for (
        const reminder of
        dueReminders
      ) {
        /*
         * Reclamamos el recordatorio antes
         * de enviar. El filtro
         * notified_at IS NULL evita dobles
         * envíos si dos ejecuciones del cron
         * se superponen.
         */
        const claimedAt =
          new Date()
            .toISOString();

        const {
          data:
            claimedReminder,
          error:
            claimError,
        } = await supabase
          .from(
            "reminders",
          )
          .update({
            notified_at:
              claimedAt,
            is_read: false,
          })
          .eq(
            "id",
            reminder.id,
          )
          .eq(
            "status",
            "pending",
          )
          .is(
            "notified_at",
            null,
          )
          .select(
            "id,user_id,title,description,reminder_date,reminder_time,timezone,status,notified_at",
          )
          .maybeSingle();

        if (claimError) {
          console.error(
            "Could not claim reminder",
            reminder.id,
            claimError,
          );

          continue;
        }

        if (
          !claimedReminder
        ) {
          continue;
        }

        claimed += 1;

        const {
          data:
            subscriptionRows,
          error:
            subscriptionsError,
        } = await supabase
          .from(
            "push_subscriptions",
          )
          .select(
            "id,user_id,endpoint,p256dh,auth,is_active",
          )
          .eq(
            "user_id",
            reminder.user_id,
          )
          .eq(
            "is_active",
            true,
          );

        if (
          subscriptionsError
        ) {
          console.error(
            "Could not load push subscriptions for reminder",
            reminder.id,
            subscriptionsError,
          );

          /*
           * Fue un fallo temporal al leer.
           * Liberamos el recordatorio para
           * que el cron vuelva a intentarlo.
           */
          await supabase
            .from(
              "reminders",
            )
            .update({
              notified_at:
                null,
            })
            .eq(
              "id",
              reminder.id,
            )
            .eq(
              "notified_at",
              claimedAt,
            );

          transientFailures +=
            1;

          continue;
        }

        const subscriptions =
          (
            subscriptionRows ||
            []
          ).map(
            (
              row,
            ) =>
              row as
                PushSubscriptionRow,
          );

        if (
          subscriptions.length ===
          0
        ) {
          /*
           * No repetimos la ejecución cada
           * minuto. El recordatorio ya queda
           * como no leído y aparecerá en la
           * campana cuando el usuario abra
           * MoneyTrack.
           */
          noDevices += 1;
          continue;
        }

        let successForReminder =
          0;
        let temporaryFailureForReminder =
          0;

        const payload =
          JSON.stringify({
            title:
              `MoneyTrack · ${reminder.title}`,

            body:
              reminder.description ||
              `Recordatorio programado para las ${normalizeTime(
                reminder.reminder_time,
              )}.`,

            icon:
              "/pwa-192x192.png",

            badge:
              "/favicon-32x32.png",

            tag:
              `moneytrack-reminder-${reminder.id}`,

            data: {
              url:
                "/reminders",

              reminderId:
                reminder.id,
            },
          });

        for (
          const subscription of
          subscriptions
        ) {
          try {
            await webpush
              .sendNotification(
                {
                  endpoint:
                    subscription.endpoint,

                  keys: {
                    p256dh:
                      subscription.p256dh,

                    auth:
                      subscription.auth,
                  },
                },
                payload,
                {
                  TTL:
                    24 *
                    60 *
                    60,
                },
              );

            successForReminder +=
              1;
            sent += 1;
          } catch (
            pushError
          ) {
            if (
              isGonePushEndpoint(
                pushError,
              )
            ) {
              const {
                error:
                  deleteError,
              } = await supabase
                .from(
                  "push_subscriptions",
                )
                .delete()
                .eq(
                  "id",
                  subscription.id,
                );

              if (
                deleteError
              ) {
                console.error(
                  "Could not remove expired push subscription",
                  subscription.id,
                  deleteError,
                );
              } else {
                removedSubscriptions +=
                  1;
              }

              continue;
            }

            temporaryFailureForReminder +=
              1;
            transientFailures +=
              1;

            console.error(
              "Push delivery failed",
              {
                reminderId:
                  reminder.id,
                subscriptionId:
                  subscription.id,
                statusCode:
                  (
                    pushError as {
                      statusCode?: number;
                    }
                  )
                    ?.statusCode,
                message:
                  (
                    pushError as {
                      message?: string;
                    }
                  )
                    ?.message,
              },
            );
          }
        }

        /*
         * Si no hubo ningún envío exitoso y
         * sí hubo un error temporal, soltamos
         * el claim para que el cron reintente.
         *
         * Si todas las suscripciones estaban
         * vencidas y fueron eliminadas, lo
         * dejamos notificado para evitar un
         * bucle infinito.
         */
        if (
          successForReminder ===
            0 &&
          temporaryFailureForReminder >
            0
        ) {
          await supabase
            .from(
              "reminders",
            )
            .update({
              notified_at:
                null,
            })
            .eq(
              "id",
              reminder.id,
            )
            .eq(
              "notified_at",
              claimedAt,
            );
        }
      }

      return jsonResponse({
        success: true,
        checked:
          (
            candidateRows ||
            []
          ).length,
        due:
          dueReminders.length,
        claimed,
        sent,
        noDevices,
        removedSubscriptions,
        transientFailures,
        executedAt:
          new Date()
            .toISOString(),
      });
    } catch (error) {
      console.error(
        "send-reminder-push failed:",
        error,
      );

      return jsonResponse(
        {
          success: false,
          message:
            "Could not process reminder pushes.",
        },
        500,
      );
    }
  },
);
