import {
  useContext,
  useEffect,
  useState,
} from "react";

import { FinanceContext } from "../../context/FinanceContext";

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

  useEffect(() => {
    setUserName(
      settings?.userName || "Usuario"
    );

    setTheme(
      settings?.theme || "light"
    );
  }, [settings]);

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