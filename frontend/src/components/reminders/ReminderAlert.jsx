import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useReminders,
} from "../../context/ReminderContext";

import {
  playReminderSound,
  primeReminderSound,
} from "../../lib/notificationPreferences";

import styles from "./ReminderAlert.module.css";

const TYPE_ICONS = {
  general: "bi-bell",
  payment: "bi-credit-card",
  goal: "bi-bullseye",
  custom: "bi-stars",
};

const formatReminderMoment = (
  reminder
) => {
  if (!reminder) {
    return "";
  }

  const [year, month, day] =
    String(
      reminder.reminderDate || ""
    )
      .split("-")
      .map(Number);

  let dateLabel =
    reminder.reminderDate || "";

  if (year && month && day) {
    dateLabel =
      new Intl.DateTimeFormat(
        "es-AR",
        {
          day: "2-digit",
          month: "short",
        }
      ).format(
        new Date(
          year,
          month - 1,
          day
        )
      );
  }

  const timeLabel =
    String(
      reminder.reminderTime || ""
    ).slice(0, 5);

  return [
    dateLabel,
    timeLabel,
  ]
    .filter(Boolean)
    .join(" · ");
};

function ReminderAlert() {
  const navigate = useNavigate();

  const {
    unreadReminders,
    notificationPreferences,
    markReminderRead,
  } = useReminders();

  const [activeReminder, setActiveReminder] =
    useState(null);

  const shownIdsRef =
    useRef(new Set());

  const candidates =
    useMemo(() => {
      return [...unreadReminders]
        .filter(
          (reminder) =>
            reminder.status ===
              "pending" &&
            Boolean(
              reminder.notifiedAt
            )
        )
        .sort((a, b) => {
          const aTime =
            Date.parse(
              a.notifiedAt || ""
            ) || 0;

          const bTime =
            Date.parse(
              b.notifiedAt || ""
            ) || 0;

          return bTime - aTime;
        });
    }, [
      unreadReminders,
    ]);

  /*
   * Los navegadores pueden bloquear audio
   * hasta que la persona interactúa con la
   * página. Desbloqueamos el contexto en la
   * primera interacción normal con MoneyTrack.
   */
  useEffect(() => {
    if (
      !notificationPreferences
        ?.soundEnabled
    ) {
      return undefined;
    }

    const prime = () => {
      void primeReminderSound();
    };

    window.addEventListener(
      "pointerdown",
      prime,
      {
        once: true,
        passive: true,
      }
    );

    window.addEventListener(
      "keydown",
      prime,
      {
        once: true,
      }
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        prime
      );

      window.removeEventListener(
        "keydown",
        prime
      );
    };
  }, [
    notificationPreferences
      ?.soundEnabled,
  ]);

  useEffect(() => {
    if (
      !notificationPreferences
        ?.inAppAlertsEnabled
    ) {
      setActiveReminder(null);
      return;
    }

    if (activeReminder) {
      return;
    }

    const next =
      candidates.find(
        (reminder) =>
          !shownIdsRef.current.has(
            reminder.id
          )
      );

    if (!next) {
      return;
    }

    shownIdsRef.current.add(
      next.id
    );

    setActiveReminder(next);

    if (
      notificationPreferences
        ?.soundEnabled
    ) {
      void playReminderSound();
    }
  }, [
    activeReminder,
    candidates,
    notificationPreferences
      ?.inAppAlertsEnabled,
    notificationPreferences
      ?.soundEnabled,
  ]);

  useEffect(() => {
    if (!activeReminder) {
      return;
    }

    const stillUnread =
      unreadReminders.some(
        (reminder) =>
          reminder.id ===
            activeReminder.id &&
          !reminder.isRead
      );

    if (!stillUnread) {
      setActiveReminder(null);
    }
  }, [
    activeReminder,
    unreadReminders,
  ]);

  if (!activeReminder) {
    return null;
  }

  const handleView = async () => {
    await markReminderRead(
      activeReminder.id
    );

    setActiveReminder(null);
    navigate("/reminders");
  };

  const handleMarkRead = async () => {
    await markReminderRead(
      activeReminder.id
    );

    setActiveReminder(null);
  };

  return (
    <aside
      className={styles.alert}
      role="alertdialog"
      aria-live="assertive"
      aria-label={`Recordatorio: ${activeReminder.title}`}
    >
      <div
        className={styles.icon}
        aria-hidden="true"
      >
        <i
          className={`bi ${
            TYPE_ICONS[
              activeReminder.type
            ] || "bi-bell"
          }`}
        ></i>
      </div>

      <div
        className={styles.content}
      >
        <div
          className={styles.header}
        >
          <div>
            <span
              className={styles.eyebrow}
            >
              Recordatorio de MoneyTrack
            </span>

            <h2
              className={styles.title}
            >
              {activeReminder.title}
            </h2>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={() =>
              setActiveReminder(null)
            }
            aria-label="Cerrar aviso"
            title="Cerrar"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {activeReminder.description && (
          <p
            className={styles.description}
          >
            {activeReminder.description}
          </p>
        )}

        <div
          className={styles.meta}
        >
          <i
            className="bi bi-clock"
            aria-hidden="true"
          ></i>

          <span>
            {formatReminderMoment(
              activeReminder
            )}
          </span>
        </div>

        <div
          className={styles.actions}
        >
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() =>
              void handleMarkRead()
            }
          >
            Marcar leído
          </button>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={() =>
              void handleView()
            }
          >
            Ver recordatorio
          </button>
        </div>
      </div>
    </aside>
  );
}

export default ReminderAlert;
