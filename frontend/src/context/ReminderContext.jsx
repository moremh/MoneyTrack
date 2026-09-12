import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

import {
  getCurrentPushSubscription,
  hasVapidPublicKey,
  isPushSupported,
  subscribeCurrentDeviceToPush,
  unsubscribeCurrentDeviceFromPush,
} from "../lib/pushNotifications";

import {
  getNotificationPreferences,
  subscribeNotificationPreferences,
  updateNotificationPreferences,
} from "../lib/notificationPreferences";

import { useAuth } from "./AuthContext";
import {
  getLocalToday,
  isValidDateString,
} from "../utils/dateUtils";

export const ReminderContext =
  createContext(null);

const DEFAULT_TIMEZONE =
  (() => {
    try {
      return (
        Intl.DateTimeFormat()
          .resolvedOptions()
          .timeZone ||
        "America/Argentina/Buenos_Aires"
      );
    } catch {
      return "America/Argentina/Buenos_Aires";
    }
  })();

const REMINDER_FIELDS = `
  id,
  user_id,
  title,
  description,
  type,
  reminder_date,
  reminder_time,
  timezone,
  recurrence,
  recurrence_end_date,
  related_goal_id,
  status,
  is_read,
  notified_at,
  completed_at,
  created_at,
  updated_at
`;

const VALID_TYPES = [
  "general",
  "payment",
  "goal",
  "custom",
];

const VALID_RECURRENCES = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

const VALID_STATUSES = [
  "pending",
  "completed",
  "cancelled",
];

const normalizeTime = (value) => {
  const time =
    String(value || "")
      .trim();

  if (!time) {
    return "09:00";
  }

  const match =
    time.match(
      /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/
    );

  if (!match) {
    return null;
  }

  return `${match[1]}:${match[2]}`;
};


const getNotificationPermissionValue =
  () => {
    if (
      typeof window ===
        "undefined" ||
      !("Notification" in window)
    ) {
      return "unsupported";
    }

    return window.Notification
      .permission;
  };

const getNowKeyInTimezone = (
  timezone,
  date = new Date()
) => {
  try {
    const parts =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            timezone ||
            DEFAULT_TIMEZONE,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }
      ).formatToParts(date);

    const values = {};

    for (const part of parts) {
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
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    const hour =
      String(
        date.getHours()
      ).padStart(2, "0");

    const minute =
      String(
        date.getMinutes()
      ).padStart(2, "0");

    return (
      `${year}-${month}-${day}` +
      `T${hour}:${minute}`
    );
  }
};

const hasReminderTimeArrived = (
  reminder,
  date = new Date()
) => {
  if (
    !reminder?.reminderDate ||
    !reminder?.reminderTime
  ) {
    return false;
  }

  const reminderKey =
    `${reminder.reminderDate}` +
    `T${normalizeTime(
      reminder.reminderTime
    ) || "00:00"}`;

  const nowKey =
    getNowKeyInTimezone(
      reminder.timezone ||
      DEFAULT_TIMEZONE,
      date
    );

  return reminderKey <= nowKey;
};

const isReminderDue = (
  reminder,
  date = new Date()
) => {
  return (
    reminder?.status ===
      "pending" &&
    !reminder?.notifiedAt &&
    hasReminderTimeArrived(
      reminder,
      date
    )
  );
};

const formatDateString = (
  year,
  month,
  day
) => {
  return [
    String(year).padStart(
      4,
      "0"
    ),
    String(month).padStart(
      2,
      "0"
    ),
    String(day).padStart(
      2,
      "0"
    ),
  ].join("-");
};

const getDaysInMonth = (
  year,
  month
) => {
  return new Date(
    Date.UTC(
      year,
      month,
      0
    )
  ).getUTCDate();
};

const getNextRecurrenceDate = (
  dateString,
  recurrence
) => {
  const match =
    String(dateString || "")
      .match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

  if (!match) {
    return null;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  if (
    recurrence ===
      "daily" ||
    recurrence ===
      "weekly"
  ) {
    const date =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day
        )
      );

    date.setUTCDate(
      date.getUTCDate() +
        (
          recurrence ===
          "weekly"
            ? 7
            : 1
        )
    );

    return formatDateString(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate()
    );
  }

  if (
    recurrence ===
    "monthly"
  ) {
    let targetYear =
      year;

    let targetMonth =
      month + 1;

    if (targetMonth > 12) {
      targetMonth = 1;
      targetYear += 1;
    }

    const targetDay =
      Math.min(
        day,
        getDaysInMonth(
          targetYear,
          targetMonth
        )
      );

    return formatDateString(
      targetYear,
      targetMonth,
      targetDay
    );
  }

  if (
    recurrence ===
    "yearly"
  ) {
    const targetYear =
      year + 1;

    const targetDay =
      Math.min(
        day,
        getDaysInMonth(
          targetYear,
          month
        )
      );

    return formatDateString(
      targetYear,
      month,
      targetDay
    );
  }

  return null;
};

const showBrowserReminderNotification =
  async (reminder) => {
    if (
      typeof window ===
        "undefined" ||
      !("Notification" in window) ||
      window.Notification
        .permission !==
        "granted"
    ) {
      return false;
    }

    const title =
      `MoneyTrack · ${reminder.title}`;

    const body =
      reminder.description ||
      `Tenés un recordatorio programado para las ${reminder.reminderTime}.`;

    const options = {
      body,
      icon:
        "/pwa-192x192.png",
      badge:
        "/favicon-32x32.png",
      tag:
        `moneytrack-reminder-${reminder.id}`,
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [
        220,
        100,
        220,
        100,
        320,
      ],
      data: {
        url: "/reminders",
        reminderId:
          reminder.id,
      },
    };

    /*
     * En escritorio suele funcionar el
     * constructor Notification. En algunos
     * navegadores móviles/PWA necesitamos
     * mostrarla mediante el Service Worker.
     */
    try {
      const notification =
        new window.Notification(
          title,
          options
        );

      notification.onclick =
        () => {
          window.focus();
          notification.close();
        };

      return true;
    } catch {
      try {
        if (
          "serviceWorker" in
          navigator
        ) {
          const registration =
            await navigator
              .serviceWorker
              .ready;

          await registration
            .showNotification(
              title,
              options
            );

          return true;
        }
      } catch (error) {
        console.warn(
          "No se pudo mostrar la notificación del recordatorio:",
          error
        );
      }
    }

    return false;
  };

const mapReminder = (reminder) => ({
  id: reminder.id,

  userId:
    reminder.user_id,

  title:
    reminder.title || "",

  description:
    reminder.description || "",

  type:
    reminder.type || "general",

  reminderDate:
    reminder.reminder_date,

  reminderTime:
    normalizeTime(
      reminder.reminder_time
    ) || "09:00",

  timezone:
    reminder.timezone ||
    DEFAULT_TIMEZONE,

  recurrence:
    reminder.recurrence ||
    "none",

  recurrenceEndDate:
    reminder.recurrence_end_date ||
    "",

  relatedGoalId:
    reminder.related_goal_id ||
    null,

  status:
    reminder.status ||
    "pending",

  isRead:
    Boolean(
      reminder.is_read
    ),

  notifiedAt:
    reminder.notified_at ||
    null,

  completedAt:
    reminder.completed_at ||
    null,

  createdAt:
    reminder.created_at,

  updatedAt:
    reminder.updated_at,
});

const getErrorMessage = (
  error,
  fallback
) => {
  const content = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (
    content.includes(
      "REMINDER_GOAL_NOT_OWNED_BY_USER"
    )
  ) {
    return "El objetivo seleccionado no pertenece a esta cuenta.";
  }

  if (
    content.includes(
      "ACCOUNT_BLOCKED"
    )
  ) {
    return "Esta cuenta se encuentra bloqueada.";
  }

  if (
    content.includes(
      "ROW-LEVEL SECURITY"
    ) ||
    content.includes(
      "42501"
    )
  ) {
    return "No tenés permiso para realizar esta acción.";
  }

  console.error(
    fallback,
    error
  );

  return fallback;
};

const validateReminder = (
  reminder,
  {
    allowPastDate = false,
  } = {}
) => {
  const title =
    String(
      reminder?.title || ""
    ).trim();

  if (!title) {
    return {
      success: false,
      message:
        "El título del recordatorio es obligatorio.",
    };
  }

  if (
    title.length > 120
  ) {
    return {
      success: false,
      message:
        "El título puede tener hasta 120 caracteres.",
    };
  }

  const description =
    String(
      reminder?.description || ""
    ).trim();

  if (
    description.length > 1000
  ) {
    return {
      success: false,
      message:
        "La descripción puede tener hasta 1000 caracteres.",
    };
  }

  const type =
    String(
      reminder?.type ||
      "general"
    )
      .trim()
      .toLowerCase();

  if (
    !VALID_TYPES.includes(type)
  ) {
    return {
      success: false,
      message:
        "El tipo de recordatorio no es válido.",
    };
  }

  const reminderDate =
    String(
      reminder?.reminderDate ||
      reminder?.reminder_date ||
      ""
    ).trim();

  if (
    !reminderDate ||
    !isValidDateString(
      reminderDate
    )
  ) {
    return {
      success: false,
      message:
        "La fecha del recordatorio no es válida.",
    };
  }

  if (
    !allowPastDate &&
    reminderDate <
      getLocalToday()
  ) {
    return {
      success: false,
      message:
        "La fecha del recordatorio no puede ser anterior a hoy.",
    };
  }

  const reminderTime =
    normalizeTime(
      reminder?.reminderTime ||
      reminder?.reminder_time ||
      "09:00"
    );

  if (!reminderTime) {
    return {
      success: false,
      message:
        "La hora del recordatorio no es válida.",
    };
  }

  const recurrence =
    String(
      reminder?.recurrence ||
      "none"
    )
      .trim()
      .toLowerCase();

  if (
    !VALID_RECURRENCES.includes(
      recurrence
    )
  ) {
    return {
      success: false,
      message:
        "La repetición seleccionada no es válida.",
    };
  }

  const recurrenceEndDate =
    String(
      reminder
        ?.recurrenceEndDate ||
      reminder
        ?.recurrence_end_date ||
      ""
    ).trim();

  if (
    recurrenceEndDate &&
    !isValidDateString(
      recurrenceEndDate
    )
  ) {
    return {
      success: false,
      message:
        "La fecha de finalización de la repetición no es válida.",
    };
  }

  if (
    recurrenceEndDate &&
    recurrenceEndDate <
      reminderDate
  ) {
    return {
      success: false,
      message:
        "La repetición no puede finalizar antes del primer recordatorio.",
    };
  }

  const timezone =
    String(
      reminder?.timezone ||
      DEFAULT_TIMEZONE
    ).trim();

  if (!timezone) {
    return {
      success: false,
      message:
        "La zona horaria no es válida.",
    };
  }

  const relatedGoalId =
    reminder
      ?.relatedGoalId ||
    reminder
      ?.related_goal_id ||
    null;

  return {
    success: true,

    payload: {
      title,

      description:
        description || null,

      type,

      reminder_date:
        reminderDate,

      reminder_time:
        reminderTime,

      timezone,

      recurrence,

      recurrence_end_date:
        recurrence === "none"
          ? null
          : recurrenceEndDate ||
            null,

      related_goal_id:
        relatedGoalId || null,
    },
  };
};

function ReminderProvider({
  children,
}) {
  const {
    currentUser,
  } = useAuth();

  const currentUserId =
    currentUser?.id || null;

  const [
    notificationPermission,
    setNotificationPermission,
  ] = useState(
    getNotificationPermissionValue
  );

  const notificationCheckRef =
    useRef(false);

  const notificationSupported =
    notificationPermission !==
    "unsupported";

  const [
    pushSubscriptionStatus,
    setPushSubscriptionStatus,
  ] = useState(() => {
    if (
      !isPushSupported()
    ) {
      return "unsupported";
    }

    if (
      !hasVapidPublicKey()
    ) {
      return "missing-key";
    }

    return "idle";
  });

  const [
    notificationPreferences,
    setNotificationPreferences,
  ] = useState(
    getNotificationPreferences
  );

  useEffect(() => {
    return subscribeNotificationPreferences(
      (nextPreferences) => {
        setNotificationPreferences(
          nextPreferences
        );
      }
    );
  }, []);

  const [
    reminders,
    setReminders,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const loadReminders =
    useCallback(async () => {
      if (!currentUserId) {
        setReminders([]);
        setErrorMessage("");

        return {
          success: false,
          reminders: [],
          message:
            "No hay una sesión activa.",
        };
      }

      setLoading(true);
      setErrorMessage("");

      const {
        data,
        error,
      } = await supabase
        .from("reminders")
        .select(
          REMINDER_FIELDS
        )
        .eq(
          "user_id",
          currentUserId
        )
        .order(
          "reminder_date",
          {
            ascending: true,
          }
        )
        .order(
          "reminder_time",
          {
            ascending: true,
          }
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (error) {
        const message =
          getErrorMessage(
            error,
            "No se pudieron cargar los recordatorios."
          );

        setErrorMessage(
          message
        );

        setLoading(false);

        return {
          success: false,
          reminders: [],
          message,
        };
      }

      const mapped =
        (data || [])
          .map(
            mapReminder
          );

      setReminders(mapped);
      setLoading(false);

      return {
        success: true,
        reminders: mapped,
      };
    }, [
      currentUserId,
    ]);

  useEffect(() => {
    if (!currentUserId) {
      setReminders([]);
      setErrorMessage("");
      setLoading(false);
      return;
    }

    void loadReminders();
  }, [
    currentUserId,
    loadReminders,
  ]);

  const addReminder =
    useCallback(
      async (reminder) => {
        if (!currentUserId) {
          return {
            success: false,
            message:
              "No hay una sesión activa.",
          };
        }

        const validation =
          validateReminder(
            reminder
          );

        if (
          !validation.success
        ) {
          return validation;
        }

        const {
          data,
          error,
        } = await supabase
          .from("reminders")
          .insert({
            user_id:
              currentUserId,

            ...validation.payload,

            status:
              "pending",

            is_read:
              true,
          })
          .select(
            REMINDER_FIELDS
          )
          .single();

        if (error) {
          return {
            success: false,
            message:
              getErrorMessage(
                error,
                "No se pudo crear el recordatorio."
              ),
          };
        }

        const newReminder =
          mapReminder(data);

        setReminders(
          (
            currentReminders
          ) =>
            [
              ...currentReminders,
              newReminder,
            ].sort(
              (
                first,
                second
              ) => {
                const date =
                  String(
                    first
                      .reminderDate
                  ).localeCompare(
                    String(
                      second
                        .reminderDate
                    )
                  );

                if (date !== 0) {
                  return date;
                }

                return String(
                  first
                    .reminderTime
                ).localeCompare(
                  String(
                    second
                      .reminderTime
                  )
                );
              }
            )
        );

        return {
          success: true,
          reminder:
            newReminder,
          message:
            "Recordatorio creado correctamente.",
        };
      },
      [
        currentUserId,
      ]
    );

  const updateReminder =
    useCallback(
      async (
        reminderId,
        changes
      ) => {
        if (
          !currentUserId ||
          !reminderId
        ) {
          return {
            success: false,
            message:
              "No se encontró el recordatorio.",
          };
        }

        const currentReminder =
          reminders.find(
            (reminder) =>
              reminder.id ===
              reminderId
          );

        if (!currentReminder) {
          return {
            success: false,
            message:
              "No se encontró el recordatorio.",
          };
        }

        const merged = {
          ...currentReminder,
          ...changes,
        };

        const validation =
          validateReminder(
            merged,
            {
              /*
               * Permitimos conservar la
               * fecha original de un
               * recordatorio atrasado.
               */
              allowPastDate: true,
            }
          );

        if (
          !validation.success
        ) {
          return validation;
        }

        const scheduleChanged =
          currentReminder
            .reminderDate !==
            validation.payload
              .reminder_date ||
          currentReminder
            .reminderTime !==
            validation.payload
              .reminder_time ||
          currentReminder
            .timezone !==
            validation.payload
              .timezone;

        const updatePayload = {
          ...validation.payload,

          ...(scheduleChanged
            ? {
                notified_at:
                  null,

                is_read:
                  true,
              }
            : {}),
        };

        const {
          data,
          error,
        } = await supabase
          .from("reminders")
          .update(
            updatePayload
          )
          .eq(
            "id",
            reminderId
          )
          .eq(
            "user_id",
            currentUserId
          )
          .select(
            REMINDER_FIELDS
          )
          .single();

        if (error) {
          return {
            success: false,
            message:
              getErrorMessage(
                error,
                "No se pudo actualizar el recordatorio."
              ),
          };
        }

        const updatedReminder =
          mapReminder(data);

        setReminders(
          (
            currentReminders
          ) =>
            currentReminders.map(
              (reminder) =>
                reminder.id ===
                reminderId
                  ? updatedReminder
                  : reminder
            )
        );

        return {
          success: true,
          reminder:
            updatedReminder,
          message:
            "Recordatorio actualizado correctamente.",
        };
      },
      [
        currentUserId,
        reminders,
      ]
    );

  const updateReminderState =
    useCallback(
      async (
        reminderId,
        changes,
        successMessage
      ) => {
        if (
          !currentUserId ||
          !reminderId
        ) {
          return {
            success: false,
            message:
              "No se encontró el recordatorio.",
          };
        }

        const {
          data,
          error,
        } = await supabase
          .from("reminders")
          .update(changes)
          .eq(
            "id",
            reminderId
          )
          .eq(
            "user_id",
            currentUserId
          )
          .select(
            REMINDER_FIELDS
          )
          .single();

        if (error) {
          return {
            success: false,
            message:
              getErrorMessage(
                error,
                "No se pudo actualizar el recordatorio."
              ),
          };
        }

        const updatedReminder =
          mapReminder(data);

        setReminders(
          (
            currentReminders
          ) =>
            currentReminders.map(
              (reminder) =>
                reminder.id ===
                reminderId
                  ? updatedReminder
                  : reminder
            )
        );

        return {
          success: true,
          reminder:
            updatedReminder,
          message:
            successMessage,
        };
      },
      [
        currentUserId,
      ]
    );

  const completeReminder =
    useCallback(
      async (reminderId) => {
        const currentReminder =
          reminders.find(
            (reminder) =>
              reminder.id ===
              reminderId
          );

        if (!currentReminder) {
          return {
            success: false,
            message:
              "No se encontró el recordatorio.",
          };
        }

        if (
          currentReminder
            .recurrence !==
            "none"
        ) {
          let nextDate =
            getNextRecurrenceDate(
              currentReminder
                .reminderDate,
              currentReminder
                .recurrence
            );

          /*
           * Si el recordatorio estaba
           * atrasado varios períodos,
           * avanzamos hasta la primera
           * fecha que todavía no haya
           * vencido.
           */
          let safety = 0;

          while (
            nextDate &&
            hasReminderTimeArrived(
              {
                ...currentReminder,
                reminderDate:
                  nextDate,
                notifiedAt:
                  null,
                status:
                  "pending",
              }
            ) &&
            safety < 500
          ) {
            nextDate =
              getNextRecurrenceDate(
                nextDate,
                currentReminder
                  .recurrence
              );

            safety += 1;
          }

          const endDate =
            currentReminder
              .recurrenceEndDate ||
            "";

          if (
            nextDate &&
            (
              !endDate ||
              nextDate <=
                endDate
            )
          ) {
            return (
              updateReminderState(
                reminderId,
                {
                  reminder_date:
                    nextDate,

                  status:
                    "pending",

                  is_read:
                    true,

                  notified_at:
                    null,

                  completed_at:
                    null,
                },
                "Recordatorio realizado. La próxima repetición quedó programada."
              )
            );
          }
        }

        return (
          updateReminderState(
            reminderId,
            {
              status:
                "completed",

              is_read:
                true,
            },
            "Recordatorio marcado como realizado."
          )
        );
      },
      [
        reminders,
        updateReminderState,
      ]
    );

  const cancelReminder =
    useCallback(
      async (reminderId) =>
        updateReminderState(
          reminderId,
          {
            status:
              "cancelled",
            is_read: true,
          },
          "Recordatorio cancelado."
        ),
      [
        updateReminderState,
      ]
    );

  const reopenReminder =
    useCallback(
      async (reminderId) =>
        updateReminderState(
          reminderId,
          {
            status:
              "pending",

            is_read:
              true,

            notified_at:
              null,
          },
          "Recordatorio reactivado."
        ),
      [
        updateReminderState,
      ]
    );

  const markReminderRead =
    useCallback(
      async (reminderId) =>
        updateReminderState(
          reminderId,
          {
            is_read: true,
          },
          "Recordatorio marcado como leído."
        ),
      [
        updateReminderState,
      ]
    );

  const markReminderUnread =
    useCallback(
      async (reminderId) =>
        updateReminderState(
          reminderId,
          {
            is_read: false,
          },
          "Recordatorio marcado como no leído."
        ),
      [
        updateReminderState,
      ]
    );

  const markAllRemindersRead =
    useCallback(
      async () => {
        if (!currentUserId) {
          return {
            success: false,
            message:
              "No hay una sesión activa.",
          };
        }

        const unreadIds =
          reminders
            .filter(
              (reminder) =>
                !reminder.isRead
            )
            .map(
              (reminder) =>
                reminder.id
            );

        if (
          unreadIds.length ===
          0
        ) {
          return {
            success: true,
            updated: 0,
            message:
              "No hay recordatorios sin leer.",
          };
        }

        const {
          error,
        } = await supabase
          .from("reminders")
          .update({
            is_read: true,
          })
          .eq(
            "user_id",
            currentUserId
          )
          .in(
            "id",
            unreadIds
          );

        if (error) {
          return {
            success: false,
            message:
              getErrorMessage(
                error,
                "No se pudieron marcar los recordatorios como leídos."
              ),
          };
        }

        const unreadIdSet =
          new Set(
            unreadIds
          );

        setReminders(
          (
            currentReminders
          ) =>
            currentReminders.map(
              (reminder) =>
                unreadIdSet.has(
                  reminder.id
                )
                  ? {
                      ...reminder,
                      isRead:
                        true,
                    }
                  : reminder
            )
        );

        return {
          success: true,
          updated:
            unreadIds.length,
          message:
            "Recordatorios marcados como leídos.",
        };
      },
      [
        currentUserId,
        reminders,
      ]
    );

  const deleteReminder =
    useCallback(
      async (reminderId) => {
        if (
          !currentUserId ||
          !reminderId
        ) {
          return {
            success: false,
            message:
              "No se encontró el recordatorio.",
          };
        }

        const {
          error,
        } = await supabase
          .from("reminders")
          .delete()
          .eq(
            "id",
            reminderId
          )
          .eq(
            "user_id",
            currentUserId
          );

        if (error) {
          return {
            success: false,
            message:
              getErrorMessage(
                error,
                "No se pudo eliminar el recordatorio."
              ),
          };
        }

        setReminders(
          (
            currentReminders
          ) =>
            currentReminders.filter(
              (reminder) =>
                reminder.id !==
                reminderId
            )
        );

        return {
          success: true,
          message:
            "Recordatorio eliminado correctamente.",
        };
      },
      [
        currentUserId,
      ]
    );

  const applyNotificationPreferenceChanges =
    useCallback((changes) => {
      const next =
        updateNotificationPreferences(
          changes
        );

      setNotificationPreferences(
        next
      );

      return next;
    }, []);

  const refreshPushSubscriptionStatus =
    useCallback(async () => {
      const permission =
        getNotificationPermissionValue();

      setNotificationPermission(
        permission
      );

      if (
        !isPushSupported()
      ) {
        setPushSubscriptionStatus(
          "unsupported"
        );

        return {
          success: false,
          status:
            "unsupported",
        };
      }

      if (
        !hasVapidPublicKey()
      ) {
        setPushSubscriptionStatus(
          "missing-key"
        );

        return {
          success: false,
          status:
            "missing-key",
        };
      }

      if (
        permission ===
        "denied"
      ) {
        setPushSubscriptionStatus(
          "permission-denied"
        );

        return {
          success: false,
          status:
            "permission-denied",
        };
      }

      if (
        permission !==
        "granted"
      ) {
        setPushSubscriptionStatus(
          "permission-required"
        );

        return {
          success: false,
          status:
            "permission-required",
        };
      }

      const current =
        await getCurrentPushSubscription();

      if (!current.success) {
        setPushSubscriptionStatus(
          "error"
        );

        return {
          ...current,
          status: "error",
        };
      }

      const status =
        current.subscription
          ? "subscribed"
          : "not-subscribed";

      setPushSubscriptionStatus(
        status
      );

      return {
        success: true,
        status,
        subscription:
          current.subscription,
      };
    }, []);

  const disableCurrentDeviceNotifications =
    useCallback(async () => {
      applyNotificationPreferenceChanges({
        pushEnabled: false,
      });

      const result =
        await unsubscribeCurrentDeviceFromPush();

      setPushSubscriptionStatus(
        result.status ||
        (
          result.success
            ? "not-subscribed"
            : "error"
        )
      );

      return result;
    }, [
      applyNotificationPreferenceChanges,
    ]);

  const setInAppAlertsEnabled =
    useCallback(
      (enabled) => {
        return applyNotificationPreferenceChanges({
          inAppAlertsEnabled:
            Boolean(enabled),
        });
      },
      [
        applyNotificationPreferenceChanges,
      ]
    );

  const setNotificationSoundEnabled =
    useCallback(
      (enabled) => {
        return applyNotificationPreferenceChanges({
          soundEnabled:
            Boolean(enabled),
        });
      },
      [
        applyNotificationPreferenceChanges,
      ]
    );

  const registerCurrentDeviceForPush =
    useCallback(async () => {
      if (
        !isPushSupported()
      ) {
        setPushSubscriptionStatus(
          "unsupported"
        );

        return {
          success: false,
          status:
            "unsupported",
          message:
            "Este navegador no admite notificaciones Push.",
        };
      }

      if (
        !hasVapidPublicKey()
      ) {
        setPushSubscriptionStatus(
          "missing-key"
        );

        return {
          success: false,
          status:
            "missing-key",
          message:
            "Falta configurar la clave pública VAPID.",
        };
      }

      setPushSubscriptionStatus(
        "subscribing"
      );

      const result =
        await subscribeCurrentDeviceToPush();

      setPushSubscriptionStatus(
        result.status ||
        (
          result.success
            ? "subscribed"
            : "error"
        )
      );

      if (result.success) {
        applyNotificationPreferenceChanges({
          pushEnabled: true,
        });
      }

      return result;
    }, [
      applyNotificationPreferenceChanges,
    ]);

  const requestNotificationPermission =
    useCallback(async () => {
      if (
        typeof window ===
          "undefined" ||
        !("Notification" in window)
      ) {
        setNotificationPermission(
          "unsupported"
        );

        setPushSubscriptionStatus(
          "unsupported"
        );

        return {
          success: false,
          permission:
            "unsupported",
          message:
            "Este navegador no admite notificaciones del sistema.",
        };
      }

      try {
        const permission =
          await window.Notification
            .requestPermission();

        setNotificationPermission(
          permission
        );

        if (
          permission ===
          "granted"
        ) {
          applyNotificationPreferenceChanges({
            pushEnabled: true,
          });

          const pushResult =
            await registerCurrentDeviceForPush();

          if (
            pushResult.success
          ) {
            return {
              success: true,
              permission,
              pushStatus:
                pushResult.status,
              message:
                "Las notificaciones Push quedaron activadas en este dispositivo.",
            };
          }

          /*
           * El permiso del navegador sí quedó
           * concedido. Si el registro Push
           * falla, los avisos locales mientras
           * MoneyTrack esté abierto siguen
           * disponibles.
           */
          return {
            success: true,
            permission,
            pushStatus:
              pushResult.status,
            message:
              "Las notificaciones quedaron permitidas, pero este dispositivo todavía no pudo registrarse para recibir avisos con MoneyTrack cerrado.",
          };
        }

        if (
          permission ===
          "denied"
        ) {
          setPushSubscriptionStatus(
            "permission-denied"
          );

          return {
            success: false,
            permission,
            message:
              "Las notificaciones están bloqueadas en el navegador.",
          };
        }

        setPushSubscriptionStatus(
          "permission-required"
        );

        return {
          success: false,
          permission,
          message:
            "No se activaron las notificaciones.",
        };
      } catch (error) {
        console.error(
          "No se pudo solicitar permiso para notificaciones:",
          error
        );

        return {
          success: false,
          permission:
            getNotificationPermissionValue(),
          message:
            "No se pudo solicitar el permiso de notificaciones.",
        };
      }
    }, [
      applyNotificationPreferenceChanges,
      registerCurrentDeviceForPush,
    ]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    void refreshPushSubscriptionStatus();
  }, [
    currentUserId,
    refreshPushSubscriptionStatus,
  ]);

  useEffect(() => {
    if (
      !currentUserId ||
      notificationPermission !==
        "granted" ||
      !notificationPreferences
        .pushEnabled
    ) {
      return;
    }

    if (
      typeof navigator !==
        "undefined" &&
      navigator.onLine ===
        false
    ) {
      return;
    }

    void registerCurrentDeviceForPush();
  }, [
    currentUserId,
    notificationPermission,
    notificationPreferences
      .pushEnabled,
    registerCurrentDeviceForPush,
  ]);

  const checkDueReminders =
    useCallback(async () => {
      if (
        !currentUserId ||
        notificationCheckRef
          .current
      ) {
        return {
          success: false,
          notified: 0,
        };
      }

      if (
        typeof navigator !==
          "undefined" &&
        navigator.onLine ===
          false
      ) {
        return {
          success: false,
          offline: true,
          notified: 0,
        };
      }

      const dueReminders =
        reminders.filter(
          (reminder) =>
            isReminderDue(
              reminder
            )
        );

      if (
        dueReminders.length ===
        0
      ) {
        return {
          success: true,
          notified: 0,
        };
      }

      notificationCheckRef
        .current = true;

      let notifiedCount = 0;

      try {
        for (
          const reminder of
          dueReminders
        ) {
          const {
            data,
            error,
          } = await supabase
            .from("reminders")
            .update({
              notified_at:
                new Date()
                  .toISOString(),

              is_read:
                false,
            })
            .eq(
              "id",
              reminder.id
            )
            .eq(
              "user_id",
              currentUserId
            )
            .eq(
              "status",
              "pending"
            )
            .is(
              "notified_at",
              null
            )
            .select(
              REMINDER_FIELDS
            )
            .maybeSingle();

          if (error) {
            console.error(
              "No se pudo activar el aviso del recordatorio:",
              error
            );

            continue;
          }

          /*
           * maybeSingle devuelve null
           * si otra pestaña ya tomó
           * este recordatorio.
           */
          if (!data) {
            /*
             * El Cron puede haber tomado el
             * recordatorio unos milisegundos
             * antes que esta pestaña. En ese
             * caso refrescamos esa fila para
             * que el aviso emergente y la
             * campana se actualicen igual.
             */
            const {
              data:
                latestReminder,
              error:
                latestError,
            } = await supabase
              .from("reminders")
              .select(
                REMINDER_FIELDS
              )
              .eq(
                "id",
                reminder.id
              )
              .eq(
                "user_id",
                currentUserId
              )
              .maybeSingle();

            if (
              !latestError &&
              latestReminder
            ) {
              const latestMapped =
                mapReminder(
                  latestReminder
                );

              setReminders(
                (
                  currentReminders
                ) =>
                  currentReminders.map(
                    (item) =>
                      item.id ===
                      latestMapped.id
                        ? latestMapped
                        : item
                  )
              );
            }

            continue;
          }

          const mapped =
            mapReminder(data);

          setReminders(
            (
              currentReminders
            ) =>
              currentReminders.map(
                (item) =>
                  item.id ===
                  mapped.id
                    ? mapped
                    : item
              )
          );

          notifiedCount += 1;

          if (
            notificationPreferences
              .pushEnabled &&
            getNotificationPermissionValue() ===
              "granted"
          ) {
            await showBrowserReminderNotification(
              mapped
            );
          }
        }

        return {
          success: true,
          notified:
            notifiedCount,
        };
      } finally {
        notificationCheckRef
          .current = false;
      }
    }, [
      currentUserId,
      reminders,
      notificationPreferences
        .pushEnabled,
    ]);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    const syncPermission =
      () => {
        setNotificationPermission(
          getNotificationPermissionValue()
        );
      };

    const runCheck =
      () => {
        syncPermission();
        void checkDueReminders();
      };

    runCheck();

    const intervalId =
      window.setInterval(
        runCheck,
        30 * 1000
      );

    const handleVisibility =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          runCheck();
        }
      };

    window.addEventListener(
      "online",
      runCheck
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      window.clearInterval(
        intervalId
      );

      window.removeEventListener(
        "online",
        runCheck
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [
    currentUserId,
    checkDueReminders,
  ]);

  const today =
    getLocalToday();

  const pendingReminders =
    useMemo(
      () =>
        reminders.filter(
          (reminder) =>
            reminder.status ===
            "pending"
        ),
      [
        reminders,
      ]
    );

  const completedReminders =
    useMemo(
      () =>
        reminders.filter(
          (reminder) =>
            reminder.status ===
            "completed"
        ),
      [
        reminders,
      ]
    );

  const cancelledReminders =
    useMemo(
      () =>
        reminders.filter(
          (reminder) =>
            reminder.status ===
            "cancelled"
        ),
      [
        reminders,
      ]
    );

  const dueTodayReminders =
    useMemo(
      () =>
        pendingReminders.filter(
          (reminder) =>
            reminder
              .reminderDate ===
            today
        ),
      [
        pendingReminders,
        today,
      ]
    );

  const overdueReminders =
    useMemo(
      () =>
        pendingReminders.filter(
          (reminder) =>
            reminder
              .reminderDate <
            today
        ),
      [
        pendingReminders,
        today,
      ]
    );

  const upcomingReminders =
    useMemo(
      () =>
        pendingReminders.filter(
          (reminder) =>
            reminder
              .reminderDate >
            today
        ),
      [
        pendingReminders,
        today,
      ]
    );

  const unreadReminders =
    useMemo(
      () =>
        reminders.filter(
          (reminder) =>
            !reminder.isRead
        ),
      [
        reminders,
      ]
    );

  const unreadCount =
    unreadReminders.length;

  const pendingCount =
    pendingReminders.length;

  const value =
    useMemo(
      () => ({
        reminders,

        pendingReminders,
        completedReminders,
        cancelledReminders,

        dueTodayReminders,
        overdueReminders,
        upcomingReminders,

        unreadReminders,
        unreadCount,
        pendingCount,

        loading,
        errorMessage,

        notificationSupported,
        notificationPermission,
        notificationPreferences,
        pushSubscriptionStatus,
        registerCurrentDeviceForPush,
        refreshPushSubscriptionStatus,
        disableCurrentDeviceNotifications,
        requestNotificationPermission,
        setInAppAlertsEnabled,
        setNotificationSoundEnabled,
        checkDueReminders,

        loadReminders,
        addReminder,
        updateReminder,
        deleteReminder,

        completeReminder,
        cancelReminder,
        reopenReminder,

        markReminderRead,
        markReminderUnread,
        markAllRemindersRead,
      }),
      [
        reminders,

        pendingReminders,
        completedReminders,
        cancelledReminders,

        dueTodayReminders,
        overdueReminders,
        upcomingReminders,

        unreadReminders,
        unreadCount,
        pendingCount,

        loading,
        errorMessage,

        notificationSupported,
        notificationPermission,
        notificationPreferences,
        pushSubscriptionStatus,
        registerCurrentDeviceForPush,
        refreshPushSubscriptionStatus,
        disableCurrentDeviceNotifications,
        requestNotificationPermission,
        setInAppAlertsEnabled,
        setNotificationSoundEnabled,
        checkDueReminders,

        loadReminders,
        addReminder,
        updateReminder,
        deleteReminder,

        completeReminder,
        cancelReminder,
        reopenReminder,

        markReminderRead,
        markReminderUnread,
        markAllRemindersRead,
      ]
    );

  return createElement(
    ReminderContext.Provider,
    {
      value,
    },
    children
  );
}

export const useReminders =
  () => {
    const context =
      useContext(
        ReminderContext
      );

    if (!context) {
      throw new Error(
        "useReminders debe utilizarse dentro de ReminderProvider."
      );
    }

    return context;
  };

export default ReminderProvider;
