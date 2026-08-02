import {
  useEffect,
  useState,
} from "react";

import styles from "./GoalForm.module.css";

function GoalForm({
  onSubmit,
  initialData,
}) {
  const [title, setTitle] =
    useState("");

  const [
    targetAmount,
    setTargetAmount,
  ] = useState("");

  const [
    currentAmount,
    setCurrentAmount,
  ] = useState("");

  const [deadline, setDeadline] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(
        initialData.title ||
          initialData.name ||
          ""
      );

      setTargetAmount(
        initialData.targetAmount ??
          initialData.target ??
          ""
      );

      setCurrentAmount(
        initialData.currentAmount ??
          initialData.savedAmount ??
          initialData.saved ??
          ""
      );

      setDeadline(
        initialData.deadline ||
          initialData.date ||
          ""
      );
    } else {
      setTitle("");
      setTargetAmount("");
      setCurrentAmount("");
      setDeadline("");
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(false);
  }, [initialData]);

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const cleanTitle =
      title.trim();

    const numericTarget =
      Number(targetAmount);

    const numericCurrent =
      Number(currentAmount);

    if (!cleanTitle) {
      setErrorMessage(
        "El nombre del objetivo es obligatorio."
      );

      return;
    }

    if (
      targetAmount === "" ||
      !Number.isFinite(
        numericTarget
      ) ||
      numericTarget <= 0
    ) {
      setErrorMessage(
        "El monto objetivo debe ser mayor a 0."
      );

      return;
    }

    if (
      currentAmount === "" ||
      !Number.isFinite(
        numericCurrent
      ) ||
      numericCurrent < 0
    ) {
      setErrorMessage(
        "El monto ahorrado no puede ser negativo."
      );

      return;
    }

    if (!deadline) {
      setErrorMessage(
        "Debes seleccionar una fecha límite."
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const result =
        await onSubmit({
          ...(initialData?.id
            ? {
                id: initialData.id,
              }
            : {}),

          title: cleanTitle,
          name: cleanTitle,

          targetAmount:
            numericTarget,

          currentAmount:
            numericCurrent,

          deadline,
        });

      if (!result?.success) {
        setErrorMessage(
          result?.message ||
            "No se pudo guardar el objetivo."
        );

        return;
      }

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
    } catch (error) {
      console.error(
        "No se pudo guardar el objetivo:",
        error
      );

      setErrorMessage(
        "No se pudo guardar el objetivo. Volvé a intentarlo."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      noValidate
    >
      {errorMessage && (
        <div
          className={`${styles.message} ${styles.errorMessage}`}
          role="alert"
        >
          <i className="bi bi-exclamation-circle"></i>

          <span>
            {errorMessage}
          </span>
        </div>
      )}

      {successMessage && (
        <div
          className={`${styles.message} ${styles.successMessage}`}
          role="status"
        >
          <i className="bi bi-check-circle"></i>

          <span>
            {successMessage}
          </span>
        </div>
      )}

      <div className={styles.group}>
        <label htmlFor="goal-title">
          Nombre del objetivo
        </label>

        <input
          id="goal-title"
          className={styles.input}
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(
              event.target.value
            );

            setErrorMessage("");
            setSuccessMessage("");
          }}
          placeholder="Ej: Viaje a Bariloche"
          autoComplete="off"
          disabled={isSubmitting}
        />
      </div>

      <div className={styles.group}>
        <label htmlFor="goal-target-amount">
          Monto objetivo
        </label>

        <input
          id="goal-target-amount"
          className={styles.input}
          type="number"
          min="0.01"
          step="0.01"
          value={targetAmount}
          onChange={(event) => {
            setTargetAmount(
              event.target.value
            );

            setErrorMessage("");
            setSuccessMessage("");
          }}
          placeholder="Ej: 500000"
          disabled={isSubmitting}
        />
      </div>

      <div className={styles.group}>
        <label htmlFor="goal-current-amount">
          Monto ahorrado
        </label>

        <input
          id="goal-current-amount"
          className={styles.input}
          type="number"
          min="0"
          step="0.01"
          value={currentAmount}
          onChange={(event) => {
            setCurrentAmount(
              event.target.value
            );

            setErrorMessage("");
            setSuccessMessage("");
          }}
          placeholder="Ej: 150000"
          disabled={isSubmitting}
        />
      </div>

      <div
        className={`${styles.group} ${styles.dateGroup}`}
      >
        <label htmlFor="goal-deadline">
          Fecha límite
        </label>

        <div className={styles.dateControl}>
          <input
            id="goal-deadline"
            className={`${styles.input} ${styles.dateInput}`}
            type="date"
            value={deadline}
            onChange={(event) => {
              setDeadline(
                event.target.value
              );

              setErrorMessage("");
              setSuccessMessage("");
            }}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.button}
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? initialData
              ? "Guardando cambios..."
              : "Agregando objetivo..."
            : initialData
              ? "Guardar cambios"
              : "Agregar objetivo"}
        </button>
      </div>
    </form>
  );
}

export default GoalForm;