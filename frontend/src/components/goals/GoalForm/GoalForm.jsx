import { useEffect, useState } from "react";
import styles from "./GoalForm.module.css";

function GoalForm({ onSubmit, initialData }) {
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [deadline, setDeadline] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setTargetAmount(initialData.targetAmount);
      setCurrentAmount(initialData.currentAmount);
      setDeadline(initialData.deadline);
    } else {
      setTitle("");
      setTargetAmount("");
      setCurrentAmount("");
      setDeadline("");
    }

    setErrorMessage("");
    setSuccessMessage("");
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const cleanTitle = title.trim();
    const numericTarget = Number(targetAmount);
    const numericCurrent = Number(currentAmount);

    setErrorMessage("");
    setSuccessMessage("");

    if (!cleanTitle) {
      setErrorMessage("El nombre del objetivo es obligatorio.");
      return;
    }

    if (!targetAmount || Number.isNaN(numericTarget) || numericTarget <= 0) {
      setErrorMessage("El monto objetivo debe ser mayor a 0.");
      return;
    }

    if (currentAmount === "" || Number.isNaN(numericCurrent) || numericCurrent < 0) {
      setErrorMessage("El monto ahorrado no puede ser negativo.");
      return;
    }

    if (!deadline) {
      setErrorMessage("Debes seleccionar una fecha límite.");
      return;
    }

    onSubmit({
      id: initialData?.id || Date.now(),
      title: cleanTitle,
      targetAmount: numericTarget,
      currentAmount: numericCurrent,
      deadline,
    });

    setSuccessMessage(
      initialData
        ? "Objetivo actualizado correctamente."
        : "Objetivo agregado correctamente."
    );

    if (!initialData) {
      setTitle("");
      setTargetAmount("");
      setCurrentAmount("");
      setDeadline("");
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {errorMessage && (
        <div className={`${styles.message} ${styles.errorMessage}`}>
          <i className="bi bi-exclamation-circle"></i>
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className={`${styles.message} ${styles.successMessage}`}>
          <i className="bi bi-check-circle"></i>
          <span>{successMessage}</span>
        </div>
      )}

      <div className={styles.group}>
        <label>Nombre del objetivo</label>
        <input
          className={styles.input}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Viaje a Bariloche"
        />
      </div>

      <div className={styles.group}>
        <label>Monto objetivo</label>
        <input
          className={styles.input}
          type="number"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          placeholder="Ej: 500000"
        />
      </div>

      <div className={styles.group}>
        <label>Monto ahorrado</label>
        <input
          className={styles.input}
          type="number"
          value={currentAmount}
          onChange={(e) => setCurrentAmount(e.target.value)}
          placeholder="Ej: 150000"
        />
      </div>

      <div className={styles.group}>
        <label>Fecha límite</label>
        <input
          className={styles.input}
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>

      <button className={styles.button} type="submit">
        {initialData ? "Guardar cambios" : "Agregar objetivo"}
      </button>
    </form>
  );
}

export default GoalForm;