import {
  useContext,
  useEffect,
  useState,
} from "react";

import {
  FinanceContext,
  FREE_LIMIT_ERROR_CODE,
} from "../../../context/FinanceContext";

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

  const availableCategories =
    category &&
    !categories.includes(category)
      ? [category, ...categories]
      : categories;

  const isNewMovement = !initialData;

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
        new Date()
          .toISOString()
          .split("T")[0]
      );
    }

    setErrorMessage("");
    setSuccessMessage("");
  }, [initialData]);

  const handleSubmit = (event) => {
    event.preventDefault();

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

    if (!date) {
      setErrorMessage(
        `Debes seleccionar una fecha para el ${typeLabel}.`
      );
      return;
    }

    const result = onAdd({
      id: initialData?.id || Date.now(),
      description: cleanDescription,
      amount: numericAmount,
      category,
      date,
    });

    if (result?.success === false) {
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
      typeLabel.charAt(0).toUpperCase() +
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
        new Date()
          .toISOString()
          .split("T")[0]
      );
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
        >
          <i className="bi bi-exclamation-circle"></i>
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          className={`${styles.message} ${styles.successMessage}`}
        >
          <i className="bi bi-check-circle"></i>
          <span>{successMessage}</span>
        </div>
      )}

      <div className={styles.group}>
        <label>Descripción</label>

        <input
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
        />
      </div>

      <div className={styles.group}>
        <label>Monto</label>

        <input
          className={styles.input}
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) =>
            setAmount(event.target.value)
          }
          placeholder="Ej: 250000"
        />
      </div>

      <div className={styles.group}>
        <label>Categoría</label>

        <select
          className={styles.input}
          value={category}
          onChange={(event) =>
            setCategory(
              event.target.value
            )
          }
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

      <div className={styles.group}>
        <label>Fecha</label>

        <input
          className={styles.input}
          type="date"
          value={date}
          onChange={(event) =>
            setDate(event.target.value)
          }
        />
      </div>

      <button
        className={styles.button}
        type="submit"
      >
        {isCreationBlocked
          ? "Ver opciones Premium"
          : initialData
            ? "Guardar cambios"
            : type === "expense"
              ? "Agregar gasto"
              : "Agregar ingreso"}
      </button>
    </form>
  );
}

export default IncomeForm;