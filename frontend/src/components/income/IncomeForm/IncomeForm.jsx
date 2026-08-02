import {
  useContext,
  useEffect,
  useState,
} from "react";

import {
  FinanceContext,
  FREE_LIMIT_ERROR_CODE,
} from "../../../context/FinanceContext";

import {
  getLocalToday,
  isValidDateString,
} from "../../../utils/dateUtils";

import styles from "./IncomeForm.module.css";

function IncomeForm({
  onAdd,
  initialData,
  type = "income",
  onLimitReached,
}) {
  const {
    incomeCategories = [],
    expenseCategories = [],
    movementUsage,
  } = useContext(FinanceContext);

  const categories =
    type === "expense"
      ? expenseCategories
      : incomeCategories;

  const typeLabel =
    type === "expense"
      ? "gasto"
      : "ingreso";

  const [description, setDescription] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [category, setCategory] =
    useState("");

  const [date, setDate] =
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

  const availableCategories =
    category &&
    !categories.includes(category)
      ? [category, ...categories]
      : categories;

  const isNewMovement =
    !initialData;

  const isCreationBlocked =
    isNewMovement &&
    movementUsage?.hasReachedLimit;

  useEffect(() => {
    if (initialData) {
      setDescription(
        initialData.description || ""
      );

      setAmount(
        initialData.amount ?? ""
      );

      setCategory(
        initialData.category || ""
      );

      setDate(
        initialData.date || ""
      );
    } else {
      setDescription("");
      setAmount("");
      setCategory("");

      setDate(
        getLocalToday()
      );
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

    if (isCreationBlocked) {
      setErrorMessage(
        `Llegaste al límite de ${movementUsage.limit} movimientos mensuales del plan gratuito.`
      );

      onLimitReached?.();
      return;
    }

    const cleanDescription =
      description.trim();

    const numericAmount =
      Number(amount);

    if (!cleanDescription) {
      setErrorMessage(
        `La descripción del ${typeLabel} es obligatoria.`
      );

      return;
    }

    if (
      !amount ||
      Number.isNaN(numericAmount) ||
      numericAmount <= 0
    ) {
      setErrorMessage(
        `El monto del ${typeLabel} debe ser mayor a 0.`
      );

      return;
    }

    if (!category) {
      setErrorMessage(
        `Debes seleccionar una categoría para el ${typeLabel}.`
      );

      return;
    }

    const cleanDate =
      String(date || "").trim();

    if (!cleanDate) {
      setErrorMessage(
        `Debes seleccionar una fecha para el ${typeLabel}.`
      );

      return;
    }

    if (
      !isValidDateString(
        cleanDate
      )
    ) {
      setErrorMessage(
        `La fecha del ${typeLabel} no es válida.`
      );

      return;
    }

    if (
      cleanDate >
      getLocalToday()
    ) {
      setErrorMessage(
        `La fecha del ${typeLabel} no puede ser posterior a hoy.`
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const result = await onAdd({
        ...(initialData?.id
          ? {
              id: initialData.id,
            }
          : {}),

        description:
          cleanDescription,

        amount:
          numericAmount,

        category,
        date: cleanDate,
      });

      if (
        result?.success === false
      ) {
        setErrorMessage(
          result.message ||
            `No se pudo guardar el ${typeLabel}.`
        );

        if (
          result.code ===
          FREE_LIMIT_ERROR_CODE
        ) {
          onLimitReached?.();
        }

        return;
      }

      const capitalizedType =
        typeLabel
          .charAt(0)
          .toUpperCase() +
        typeLabel.slice(1);

      setSuccessMessage(
        initialData
          ? `${capitalizedType} actualizado correctamente.`
          : `${capitalizedType} agregado correctamente.`
      );

      if (!initialData) {
        setDescription("");
        setAmount("");
        setCategory("");

        setDate(
          getLocalToday()
        );
      }
    } catch (error) {
      console.error(
        `No se pudo guardar el ${typeLabel}:`,
        error
      );

      setErrorMessage(
        `No se pudo guardar el ${typeLabel}. Volvé a intentarlo.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
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
        <label htmlFor={`${type}-description`}>
          Descripción
        </label>

        <input
          id={`${type}-description`}
          className={styles.input}
          type="text"
          value={description}
          onChange={(event) =>
            setDescription(
              event.target.value
            )
          }
          placeholder={
            type === "expense"
              ? "Ej: Supermercado"
              : "Ej: Sueldo"
          }
          disabled={isSubmitting}
        />
      </div>

      <div className={styles.group}>
        <label htmlFor={`${type}-amount`}>
          Monto
        </label>

        <input
          id={`${type}-amount`}
          className={styles.input}
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) =>
            setAmount(
              event.target.value
            )
          }
          placeholder="Ej: 250000"
          disabled={isSubmitting}
        />
      </div>

      <div className={styles.group}>
        <label htmlFor={`${type}-category`}>
          Categoría
        </label>

        <select
          id={`${type}-category`}
          className={styles.input}
          value={category}
          onChange={(event) =>
            setCategory(
              event.target.value
            )
          }
          disabled={isSubmitting}
        >
          <option value="">
            Seleccione...
          </option>

          {availableCategories.map(
            (currentCategory) => (
              <option
                key={currentCategory}
                value={currentCategory}
              >
                {currentCategory}
              </option>
            )
          )}
        </select>
      </div>
      <div
  className={`${styles.group} ${styles.dateGroup}`}
>
  <label htmlFor={`${type}-date`}>
    Fecha
  </label>

  <div className={styles.dateControl}>
    <input
      id={`${type}-date`}
      className={`${styles.input} ${styles.dateInput}`}
      type="date"
      value={date}
      max={getLocalToday()}
      onChange={(event) =>
        setDate(
          event.target.value
        )
      }
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
        : "Guardando..."
      : isCreationBlocked
        ? "Ver opciones Premium"
        : initialData
          ? "Guardar cambios"
          : type === "expense"
            ? "Agregar gasto"
            : "Agregar ingreso"}
  </button>
</div>
    </form>
  );
}

export default IncomeForm;