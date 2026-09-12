import {
  useContext,
  useEffect,
  useState,
} from "react";

import { FinanceContext } from "../../context/FinanceContext";

import {
  useReminders,
} from "../../context/ReminderContext";

import {
  playReminderSound,
  primeReminderSound,
} from "../../lib/notificationPreferences";

import {
  showTestSystemNotification,
} from "../../lib/pushNotifications";

import styles from "./Settings.module.css";

function Settings() {
  const {
    settings,
    updateSettings,
    clearIncomes,
    clearExpenses,
    clearGoals,
    resetAppData,
  } = useContext(FinanceContext);

  const {
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
  } = useReminders();

  const [userName, setUserName] =
    useState(
      settings?.userName || "Usuario"
    );

  const [theme, setTheme] =
    useState(
      settings?.theme || "light"
    );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    activeAction,
    setActiveAction,
  ] = useState("");

  const isBusy =
    Boolean(activeAction);

  const devicePushEnabled =
    Boolean(
      notificationPreferences
        ?.pushEnabled
    );

  const inAppAlertsEnabled =
    notificationPreferences
      ?.inAppAlertsEnabled !==
    false;

  const notificationSoundEnabled =
    notificationPreferences
      ?.soundEnabled !==
    false;

  let notificationStatus = {
    label:
      "Notificaciones desactivadas",
    description:
      "Activá este dispositivo para recibir recordatorios aunque MoneyTrack esté cerrado.",
    tone: "neutral",
  };

  if (
    !notificationSupported ||
    pushSubscriptionStatus ===
      "unsupported"
  ) {
    notificationStatus = {
      label:
        "Notificaciones no compatibles",
      description:
        "Este navegador o dispositivo no admite notificaciones Push.",
      tone: "warning",
    };
  } else if (
    pushSubscriptionStatus ===
    "missing-key"
  ) {
    notificationStatus = {
      label:
        "Falta configuración",
      description:
        "MoneyTrack todavía no tiene disponible la clave pública necesaria para registrar este dispositivo.",
      tone: "error",
    };
  } else if (
    notificationPermission ===
    "denied"
  ) {
    notificationStatus = {
      label:
        "Notificaciones bloqueadas",
      description:
        "El navegador bloqueó las notificaciones. Tenés que habilitarlas desde los permisos del sitio.",
      tone: "error",
    };
  } else if (
    notificationPermission ===
      "granted" &&
    pushSubscriptionStatus ===
      "subscribed" &&
    devicePushEnabled
  ) {
    notificationStatus = {
      label:
        "Notificaciones activadas",
      description:
        "Este dispositivo está registrado para recibir recordatorios fuera de MoneyTrack.",
      tone: "success",
    };
  } else if (
    notificationPermission ===
      "granted" &&
    pushSubscriptionStatus ===
      "subscribing"
  ) {
    notificationStatus = {
      label:
        "Activando notificaciones...",
      description:
        "Estamos registrando este dispositivo para recibir avisos Push.",
      tone: "neutral",
    };
  } else if (
    notificationPermission ===
    "granted"
  ) {
    notificationStatus = {
      label:
        "Permiso concedido",
      description:
        "El navegador permite notificaciones, pero este dispositivo todavía no está registrado para recibir avisos con MoneyTrack cerrado.",
      tone: "warning",
    };
  }

  useEffect(() => {
    setUserName(
      settings?.userName || "Usuario"
    );

    setTheme(
      settings?.theme || "light"
    );
  }, [settings]);

  useEffect(() => {
    void refreshPushSubscriptionStatus();
  }, [
    refreshPushSubscriptionStatus,
  ]);

  const clearMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const showResult = (
    result,
    successText,
    errorText
  ) => {
    if (!result?.success) {
      setErrorMessage(
        result?.message || errorText
      );

      return false;
    }

    setSuccessMessage(
      result?.message || successText
    );

    return true;
  };

  const handleEnableNotifications =
    async () => {
      if (isBusy) {
        return;
      }

      clearMessages();
      setActiveAction(
        "enable-notifications"
      );

      try {
        const result =
          notificationPermission ===
          "granted"
            ? await registerCurrentDeviceForPush()
            : await requestNotificationPermission();

        if (result?.success) {
          await primeReminderSound();
        }

        showResult(
          result,
          "Las notificaciones quedaron activadas en este dispositivo.",
          "No se pudieron activar las notificaciones."
        );

        await refreshPushSubscriptionStatus();
      } catch (error) {
        console.error(
          "No se pudieron activar las notificaciones:",
          error
        );

        setErrorMessage(
          "No se pudieron activar las notificaciones. Volvé a intentarlo."
        );
      } finally {
        setActiveAction("");
      }
    };

  const handleDisableNotifications =
    async () => {
      if (isBusy) {
        return;
      }

      clearMessages();
      setActiveAction(
        "disable-notifications"
      );

      try {
        const result =
          await disableCurrentDeviceNotifications();

        showResult(
          result,
          "Las notificaciones Push quedaron desactivadas en este dispositivo.",
          "No se pudieron desactivar las notificaciones."
        );

        await refreshPushSubscriptionStatus();
      } catch (error) {
        console.error(
          "No se pudieron desactivar las notificaciones:",
          error
        );

        setErrorMessage(
          "No se pudieron desactivar las notificaciones. Volvé a intentarlo."
        );
      } finally {
        setActiveAction("");
      }
    };

  const handleToggleInAppAlerts =
    (enabled) => {
      clearMessages();

      setInAppAlertsEnabled(
        enabled
      );

      setSuccessMessage(
        enabled
          ? "Los avisos emergentes dentro de MoneyTrack quedaron activados."
          : "Los avisos emergentes dentro de MoneyTrack quedaron desactivados."
      );
    };

  const handleToggleNotificationSound =
    async (enabled) => {
      clearMessages();

      setNotificationSoundEnabled(
        enabled
      );

      if (enabled) {
        await primeReminderSound();
      }

      setSuccessMessage(
        enabled
          ? "El sonido de los recordatorios dentro de MoneyTrack quedó activado."
          : "El sonido de los recordatorios dentro de MoneyTrack quedó desactivado."
      );
    };

  const handleTestReminderSound =
    async () => {
      if (isBusy) {
        return;
      }

      clearMessages();
      setActiveAction(
        "test-reminder-sound"
      );

      try {
        const primed =
          await primeReminderSound();

        const result =
          await playReminderSound();

        if (
          primed &&
          result?.success
        ) {
          setSuccessMessage(
            "Sonido de prueba reproducido correctamente."
          );
        } else {
          setErrorMessage(
            "El navegador no permitió reproducir el sonido. Interactuá con la página y volvé a probar."
          );
        }
      } catch (error) {
        console.error(
          "No se pudo reproducir el sonido de prueba:",
          error
        );

        setErrorMessage(
          "No se pudo reproducir el sonido de prueba."
        );
      } finally {
        setActiveAction("");
      }
    };

  const handleTestSystemNotification =
    async () => {
      if (isBusy) {
        return;
      }

      clearMessages();
      setActiveAction(
        "test-system-notification"
      );

      try {
        const result =
          await showTestSystemNotification();

        showResult(
          result,
          "Notificación de prueba enviada al sistema.",
          "No se pudo mostrar la notificación de prueba."
        );
      } catch (error) {
        console.error(
          "No se pudo mostrar la notificación de prueba:",
          error
        );

        setErrorMessage(
          "No se pudo mostrar la notificación de prueba."
        );
      } finally {
        setActiveAction("");
      }
    };

  const handleSave = async (
    event
  ) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    clearMessages();

    const cleanName =
      userName.trim();

    if (!cleanName) {
      setErrorMessage(
        "El nombre de usuario no puede estar vacío."
      );

      return;
    }

    setActiveAction(
      "save-settings"
    );

    try {
      const result =
        await updateSettings({
          userName: cleanName,
          theme,
        });

      showResult(
        result,
        "Configuración guardada correctamente.",
        "No se pudo guardar la configuración."
      );
    } catch (error) {
      console.error(
        "No se pudo guardar la configuración:",
        error
      );

      setErrorMessage(
        "No se pudo guardar la configuración. Volvé a intentarlo."
      );
    } finally {
      setActiveAction("");
    }
  };

  const handleClearIncomes =
    async () => {
      if (isBusy) {
        return;
      }

      const confirmed =
        window.confirm(
          "¿Seguro que querés eliminar todos los ingresos? Esta acción no se puede deshacer."
        );

      if (!confirmed) {
        return;
      }

      clearMessages();

      setActiveAction(
        "clear-incomes"
      );

      try {
        const result =
          await clearIncomes();

        showResult(
          result,
          "Se eliminaron todos los ingresos.",
          "No se pudieron eliminar los ingresos."
        );
      } catch (error) {
        console.error(
          "No se pudieron eliminar los ingresos:",
          error
        );

        setErrorMessage(
          "No se pudieron eliminar los ingresos. Volvé a intentarlo."
        );
      } finally {
        setActiveAction("");
      }
    };

  const handleClearExpenses =
    async () => {
      if (isBusy) {
        return;
      }

      const confirmed =
        window.confirm(
          "¿Seguro que querés eliminar todos los gastos? Esta acción no se puede deshacer."
        );

      if (!confirmed) {
        return;
      }

      clearMessages();

      setActiveAction(
        "clear-expenses"
      );

      try {
        const result =
          await clearExpenses();

        showResult(
          result,
          "Se eliminaron todos los gastos.",
          "No se pudieron eliminar los gastos."
        );
      } catch (error) {
        console.error(
          "No se pudieron eliminar los gastos:",
          error
        );

        setErrorMessage(
          "No se pudieron eliminar los gastos. Volvé a intentarlo."
        );
      } finally {
        setActiveAction("");
      }
    };

  const handleClearGoals =
    async () => {
      if (isBusy) {
        return;
      }

      const confirmed =
        window.confirm(
          "¿Seguro que querés eliminar todos los objetivos? Esta acción no se puede deshacer."
        );

      if (!confirmed) {
        return;
      }

      clearMessages();

      setActiveAction(
        "clear-goals"
      );

      try {
        const result =
          await clearGoals();

        showResult(
          result,
          "Se eliminaron todos los objetivos.",
          "No se pudieron eliminar los objetivos."
        );
      } catch (error) {
        console.error(
          "No se pudieron eliminar los objetivos:",
          error
        );

        setErrorMessage(
          "No se pudieron eliminar los objetivos. Volvé a intentarlo."
        );
      } finally {
        setActiveAction("");
      }
    };

  const handleResetApp =
    async () => {
      if (isBusy) {
        return;
      }

      const confirmed =
        window.confirm(
          "Esto eliminará tus ingresos, gastos, objetivos y categorías personalizadas. ¿Deseás continuar?"
        );

      if (!confirmed) {
        return;
      }

      clearMessages();

      setActiveAction(
        "reset-app"
      );

      try {
        const result =
          await resetAppData();

        showResult(
          result,
          "La aplicación fue reiniciada correctamente.",
          "No se pudieron restablecer los datos."
        );
      } catch (error) {
        console.error(
          "No se pudieron restablecer los datos:",
          error
        );

        setErrorMessage(
          "No se pudieron restablecer los datos. Volvé a intentarlo."
        );
      } finally {
        setActiveAction("");
      }
    };

  return (
    <div
      className={styles.page}
      aria-busy={isBusy}
    >
      <div className={styles.header}>
        <h1 className={styles.title}>
          Configuración
        </h1>

        <p className={styles.subtitle}>
          Personalizá tu experiencia y
          administrá los datos de la
          aplicación.
        </p>
      </div>

      {(errorMessage ||
        successMessage) && (
        <div
          className={`${styles.message} ${
            errorMessage
              ? styles.errorMessage
              : styles.successMessage
          }`}
          role={
            errorMessage
              ? "alert"
              : "status"
          }
        >
          <i
            className={`bi ${
              errorMessage
                ? "bi-exclamation-circle"
                : "bi-check-circle"
            }`}
          ></i>

          <span>
            {errorMessage ||
              successMessage}
          </span>
        </div>
      )}

      <section className={styles.card}>
        <h2
          className={styles.cardTitle}
        >
          Perfil y apariencia
        </h2>

        <form
          className={styles.form}
          onSubmit={handleSave}
          noValidate
        >
          <div className={styles.group}>
            <label htmlFor="settings-name">
              Nombre visible
            </label>

            <input
              id="settings-name"
              className={styles.input}
              type="text"
              value={userName}
              onChange={(event) => {
                setUserName(
                  event.target.value
                );

                clearMessages();
              }}
              placeholder="Ej: More"
              disabled={isBusy}
            />
          </div>

          <div className={styles.group}>
            <label htmlFor="settings-theme">
              Tema
            </label>

            <select
              id="settings-theme"
              className={styles.input}
              value={theme}
              onChange={(event) => {
                setTheme(
                  event.target.value
                );

                clearMessages();
              }}
              disabled={isBusy}
            >
              <option value="light">
                Claro
              </option>

              <option value="dark">
                Oscuro
              </option>

              <option value="system">
                Usar configuración del sistema
              </option>
            </select>
          </div>

          <button
            className={
              styles.saveButton
            }
            type="submit"
            disabled={isBusy}
          >
            {activeAction ===
            "save-settings"
              ? "Guardando..."
              : "Guardar configuración"}
          </button>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitleRow}>
          <div>
            <h2
              className={styles.cardTitle}
            >
              Notificaciones
            </h2>

            <p
              className={styles.cardDescription}
            >
              Configurá cómo querés recibir
              recordatorios en este dispositivo.
            </p>
          </div>

          <span
            className={`${styles.statusBadge} ${
              notificationStatus.tone ===
              "success"
                ? styles.statusSuccess
                : notificationStatus.tone ===
                    "warning"
                  ? styles.statusWarning
                  : notificationStatus.tone ===
                      "error"
                    ? styles.statusError
                    : styles.statusNeutral
            }`}
          >
            {notificationStatus.label}
          </span>
        </div>

        <div
          className={styles.notificationStatus}
        >
          <div
            className={styles.notificationIcon}
            aria-hidden="true"
          >
            <i
              className={`bi ${
                notificationStatus.tone ===
                "success"
                  ? "bi-bell-fill"
                  : notificationStatus.tone ===
                      "error"
                    ? "bi-bell-slash-fill"
                    : "bi-bell"
              }`}
            ></i>
          </div>

          <div>
            <strong>
              Estado de este dispositivo
            </strong>

            <p>
              {notificationStatus.description}
            </p>
          </div>
        </div>

        <div
          className={styles.notificationActions}
        >
          {notificationSupported &&
            notificationPermission !==
              "denied" &&
            !(
              notificationPermission ===
                "granted" &&
              pushSubscriptionStatus ===
                "subscribed" &&
              devicePushEnabled
            ) && (
              <button
                type="button"
                className={styles.saveButton}
                onClick={() =>
                  void handleEnableNotifications()
                }
                disabled={isBusy}
              >
                {activeAction ===
                "enable-notifications"
                  ? "Activando..."
                  : notificationPermission ===
                      "granted"
                    ? "Registrar este dispositivo"
                    : "Activar notificaciones"}
              </button>
            )}

          {notificationPermission ===
            "granted" &&
            pushSubscriptionStatus ===
              "subscribed" &&
            devicePushEnabled && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() =>
                  void handleDisableNotifications()
                }
                disabled={isBusy}
              >
                {activeAction ===
                "disable-notifications"
                  ? "Desactivando..."
                  : "Desactivar en este dispositivo"}
              </button>
            )}
        </div>

        {notificationPermission ===
          "denied" && (
            <div
              className={styles.permissionHelp}
            >
              <i
                className="bi bi-info-circle"
                aria-hidden="true"
              ></i>

              <span>
                MoneyTrack no puede volver a pedir
                el permiso automáticamente. Abrí
                los permisos del sitio en el
                navegador y habilitá
                Notificaciones.
              </span>
            </div>
          )}

        <div
          className={styles.preferenceList}
        >
          <label
            className={styles.preferenceRow}
          >
            <div
              className={styles.preferenceText}
            >
              <strong>
                Avisos emergentes dentro de
                MoneyTrack
              </strong>

              <span>
                Muestra una tarjeta sobre la
                pantalla cuando vence un
                recordatorio.
              </span>
            </div>

            <input
              className={styles.toggle}
              type="checkbox"
              checked={inAppAlertsEnabled}
              onChange={(event) =>
                handleToggleInAppAlerts(
                  event.target.checked
                )
              }
              disabled={isBusy}
            />
          </label>

          <label
            className={styles.preferenceRow}
          >
            <div
              className={styles.preferenceText}
            >
              <strong>
                Sonido dentro de MoneyTrack
              </strong>

              <span>
                Reproduce un tono cuando aparece
                un recordatorio mientras la app
                está abierta.
              </span>
            </div>

            <input
              className={styles.toggle}
              type="checkbox"
              checked={
                notificationSoundEnabled
              }
              onChange={(event) =>
                void handleToggleNotificationSound(
                  event.target.checked
                )
              }
              disabled={isBusy}
            />
          </label>
        </div>

        <div
          className={styles.testRow}
        >
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() =>
              void handleTestReminderSound()
            }
            disabled={
              isBusy ||
              !notificationSoundEnabled
            }
          >
            {activeAction ===
            "test-reminder-sound"
              ? "Probando..."
              : "Probar sonido"}
          </button>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() =>
              void handleTestSystemNotification()
            }
            disabled={
              isBusy ||
              notificationPermission !==
                "granted"
            }
          >
            {activeAction ===
            "test-system-notification"
              ? "Enviando..."
              : "Probar notificación"}
          </button>

          <p
            className={styles.notificationNote}
          >
            Cuando MoneyTrack está cerrado o
            minimizado, el banner y el sonido
            dependen de los permisos de
            notificaciones del sistema operativo
            y del navegador.
          </p>
        </div>
      </section>

      <section className={styles.card}>
        <h2
          className={styles.cardTitle}
        >
          Mantenimiento de datos
        </h2>

        <div
          className={
            styles.actionsGrid
          }
        >
          <button
            className={
              styles.secondaryButton
            }
            type="button"
            onClick={() =>
              void handleClearIncomes()
            }
            disabled={isBusy}
          >
            {activeAction ===
            "clear-incomes"
              ? "Eliminando ingresos..."
              : "Limpiar ingresos"}
          </button>

          <button
            className={
              styles.secondaryButton
            }
            type="button"
            onClick={() =>
              void handleClearExpenses()
            }
            disabled={isBusy}
          >
            {activeAction ===
            "clear-expenses"
              ? "Eliminando gastos..."
              : "Limpiar gastos"}
          </button>

          <button
            className={
              styles.secondaryButton
            }
            type="button"
            onClick={() =>
              void handleClearGoals()
            }
            disabled={isBusy}
          >
            {activeAction ===
            "clear-goals"
              ? "Eliminando objetivos..."
              : "Limpiar objetivos"}
          </button>

          <button
            className={
              styles.dangerButton
            }
            type="button"
            onClick={() =>
              void handleResetApp()
            }
            disabled={isBusy}
          >
            {activeAction ===
            "reset-app"
              ? "Reiniciando..."
              : "Reiniciar toda la app"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default Settings;