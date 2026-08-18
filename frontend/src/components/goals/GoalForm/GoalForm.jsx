import {
  useEffect,
  useState,
} from "react";

import {
  formatAmountInput,
  formatStoredAmount,
  normalizeAmountOnBlur,
  parseAmountInput,
} from "../../../utils/amountUtils";

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
        formatStoredAmount(
          initialData.targetAmount ??
            initialData.target ??
            ""
        )
      );

      setDeadline(
        initialData.deadline ||
          initialData.date ||
          ""
      );
    } else {
      setTitle("");
      setTargetAmount("");
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
      parseAmountInput(
        targetAmount
      );

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
                id:
                  initialData.id,
              }
            : {}),

          title:
            cleanTitle,

          name:
            cleanTitle,

          targetAmount:
            numericTarget,

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

  const currentSavedAmount =
    initialData
      ? formatStoredAmount(
          initialData.currentAmount ??
            initialData.savedAmount ??
            initialData.saved ??
            0
        )
      : "";

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
          type="text"
          inputMode="decimal"
          lang="es-AR"
          value={targetAmount}
          onChange={(event) => {
            const nextValue =
              event.target.value;

            setTargetAmount(
              (currentValue) =>
                formatAmountInput(
                  nextValue,
                  currentValue
                )
            );

            setErrorMessage("");
            setSuccessMessage("");
          }}
          onBlur={() =>
            setTargetAmount(
              (currentValue) =>
                normalizeAmountOnBlur(
                  currentValue
                )
            )
          }
          placeholder="Ej: 500.000,00"
          autoComplete="off"
          disabled={isSubmitting}
        />
      </div>

      {initialData && (
        <div className={styles.group}>
          <label htmlFor="goal-current-amount">
            Monto ahorrado actual
          </label>

          <input
            id="goal-current-amount"
            className={styles.input}
            type="text"
            value={
              currentSavedAmount
            }
            readOnly
            disabled
          />
        </div>
      )}

      <div
        className={`${styles.group} ${styles.dateGroup}`}
      >
        <label htmlFor="goal-deadline">
          Fecha límite
        </label>

        <div
          className={
            styles.dateControl
          }
        >
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
            disabled={
              isSubmitting
            }
          />
        </div>
      </div>

      <div
        className={styles.actions}
      >
        <button
          className={
            styles.button
          }
          type="submit"
          disabled={
            isSubmitting
          }
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