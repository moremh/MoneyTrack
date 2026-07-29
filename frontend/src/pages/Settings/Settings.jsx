import { useContext, useEffect, useState } from "react";
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

  const [userName, setUserName] = useState(settings.userName);
  const [theme, setTheme] = useState(settings.theme);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setUserName(settings.userName);
    setTheme(settings.theme);
  }, [settings]);

  const handleSave = (e) => {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanName = userName.trim();

    if (!cleanName) {
      setErrorMessage("El nombre de usuario no puede estar vacío.");
      return;
    }

    updateSettings({
      userName: cleanName,
      theme,
    });

    setSuccessMessage("Configuración guardada correctamente.");
  };

  const handleClearIncomes = () => {
    const confirmed = window.confirm(
      "¿Seguro que quieres eliminar todos los ingresos?"
    );

    if (!confirmed) return;

    clearIncomes();
    setSuccessMessage("Se eliminaron todos los ingresos.");
    setErrorMessage("");
  };

  const handleClearExpenses = () => {
    const confirmed = window.confirm(
      "¿Seguro que quieres eliminar todos los gastos?"
    );

    if (!confirmed) return;

    clearExpenses();
    setSuccessMessage("Se eliminaron todos los gastos.");
    setErrorMessage("");
  };

  const handleClearGoals = () => {
    const confirmed = window.confirm(
      "¿Seguro que quieres eliminar todos los objetivos?"
    );

    if (!confirmed) return;

    clearGoals();
    setSuccessMessage("Se eliminaron todos los objetivos.");
    setErrorMessage("");
  };

  const handleResetApp = () => {
    const confirmed = window.confirm(
      "Esto reiniciará toda la app. ¿Deseas continuar?"
    );

    if (!confirmed) return;

    resetAppData();
    setSuccessMessage("La app fue reiniciada correctamente.");
    setErrorMessage("");
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Configuración</h1>
        <p className={styles.subtitle}>
          Personaliza tu experiencia y administra los datos de la app.
        </p>
      </div>

      {(errorMessage || successMessage) && (
        <div
          className={`${styles.message} ${
            errorMessage ? styles.errorMessage : styles.successMessage
          }`}
        >
          <i
            className={`bi ${
              errorMessage ? "bi-exclamation-circle" : "bi-check-circle"
            }`}
          ></i>
          <span>{errorMessage || successMessage}</span>
        </div>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Perfil y apariencia</h2>

        <form className={styles.form} onSubmit={handleSave}>
          <div className={styles.group}>
            <label>Nombre visible</label>
            <input
              className={styles.input}
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Ej: More"
            />
          </div>

          <div className={styles.group}>
            <label>Tema</label>
            <select
              className={styles.input}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
            </select>
          </div>

          <button className={styles.saveButton} type="submit">
            Guardar configuración
          </button>
        </form>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Mantenimiento de datos</h2>

        <div className={styles.actionsGrid}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleClearIncomes}
          >
            Limpiar ingresos
          </button>

          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleClearExpenses}
          >
            Limpiar gastos
          </button>

          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleClearGoals}
          >
            Limpiar objetivos
          </button>

          <button
            className={styles.dangerButton}
            type="button"
            onClick={handleResetApp}
          >
            Reiniciar toda la app
          </button>
        </div>
      </section>
    </div>
  );
}

export default Settings;