import {
  useContext,
  useState,
} from "react";

import { FinanceContext } from "../../context/FinanceContext";

import styles from "./Categories.module.css";

function Categories() {
  const {
    incomeCategories,
    expenseCategories,

    addIncomeCategory,
    deleteIncomeCategory,
    updateIncomeCategory,

    addExpenseCategory,
    deleteExpenseCategory,
    updateExpenseCategory,
  } = useContext(FinanceContext);

  const [
    newIncomeCategory,
    setNewIncomeCategory,
  ] = useState("");

  const [
    newExpenseCategory,
    setNewExpenseCategory,
  ] = useState("");

  const [
    editingIncomeCategory,
    setEditingIncomeCategory,
  ] = useState(null);

  const [
    editingExpenseCategory,
    setEditingExpenseCategory,
  ] = useState(null);

  const [
    incomeEditValue,
    setIncomeEditValue,
  ] = useState("");

  const [
    expenseEditValue,
    setExpenseEditValue,
  ] = useState("");

  const [
    incomeMessage,
    setIncomeMessage,
  ] = useState("");

  const [
    expenseMessage,
    setExpenseMessage,
  ] = useState("");

  const [
    incomeError,
    setIncomeError,
  ] = useState("");

  const [
    expenseError,
    setExpenseError,
  ] = useState("");

  const [
    incomeAction,
    setIncomeAction,
  ] = useState("");

  const [
    expenseAction,
    setExpenseAction,
  ] = useState("");

  const isIncomeBusy =
    Boolean(incomeAction);

  const isExpenseBusy =
    Boolean(expenseAction);

  const resetIncomeMessages = () => {
    setIncomeMessage("");
    setIncomeError("");
  };

  const resetExpenseMessages = () => {
    setExpenseMessage("");
    setExpenseError("");
  };

  const handleAddIncomeCategory =
    async () => {
      const value =
        newIncomeCategory.trim();

      resetIncomeMessages();

      if (!value) {
        setIncomeError(
          "Debes escribir un nombre para la categoría de ingreso."
        );

        return;
      }

      const duplicated =
        incomeCategories.some(
          (category) =>
            category.toLowerCase() ===
            value.toLowerCase()
        );

      if (duplicated) {
        setIncomeError(
          "Esa categoría de ingreso ya existe."
        );

        return;
      }

      setIncomeAction("add");

      try {
        const result =
          await addIncomeCategory(
            value
          );

        if (!result?.success) {
          setIncomeError(
            result?.message ||
              "No se pudo agregar la categoría de ingreso."
          );

          return;
        }

        setNewIncomeCategory("");

        setIncomeMessage(
          result.message ||
            "Categoría de ingreso agregada correctamente."
        );
      } catch (error) {
        console.error(
          "No se pudo agregar la categoría de ingreso:",
          error
        );

        setIncomeError(
          "No se pudo agregar la categoría de ingreso. Volvé a intentarlo."
        );
      } finally {
        setIncomeAction("");
      }
    };

  const handleAddExpenseCategory =
    async () => {
      const value =
        newExpenseCategory.trim();

      resetExpenseMessages();

      if (!value) {
        setExpenseError(
          "Debes escribir un nombre para la categoría de gasto."
        );

        return;
      }

      const duplicated =
        expenseCategories.some(
          (category) =>
            category.toLowerCase() ===
            value.toLowerCase()
        );

      if (duplicated) {
        setExpenseError(
          "Esa categoría de gasto ya existe."
        );

        return;
      }

      setExpenseAction("add");

      try {
        const result =
          await addExpenseCategory(
            value
          );

        if (!result?.success) {
          setExpenseError(
            result?.message ||
              "No se pudo agregar la categoría de gasto."
          );

          return;
        }

        setNewExpenseCategory("");

        setExpenseMessage(
          result.message ||
            "Categoría de gasto agregada correctamente."
        );
      } catch (error) {
        console.error(
          "No se pudo agregar la categoría de gasto:",
          error
        );

        setExpenseError(
          "No se pudo agregar la categoría de gasto. Volvé a intentarlo."
        );
      } finally {
        setExpenseAction("");
      }
    };

  const handleStartEditIncome = (
    category
  ) => {
    if (isIncomeBusy) {
      return;
    }

    resetIncomeMessages();

    setEditingIncomeCategory(
      category
    );

    setIncomeEditValue(
      category
    );
  };

  const handleStartEditExpense = (
    category
  ) => {
    if (isExpenseBusy) {
      return;
    }

    resetExpenseMessages();

    setEditingExpenseCategory(
      category
    );

    setExpenseEditValue(
      category
    );
  };

  const handleSaveIncomeEdit =
    async (oldName) => {
      const value =
        incomeEditValue.trim();

      resetIncomeMessages();

      if (!value) {
        setIncomeError(
          "El nombre de la categoría no puede estar vacío."
        );

        return;
      }

      const duplicated =
        incomeCategories.some(
          (category) =>
            category.toLowerCase() ===
              value.toLowerCase() &&
            category.toLowerCase() !==
              oldName.toLowerCase()
        );

      if (duplicated) {
        setIncomeError(
          "Ya existe otra categoría de ingreso con ese nombre."
        );

        return;
      }

      if (
        value.toLowerCase() ===
        oldName.toLowerCase()
      ) {
        setEditingIncomeCategory(
          null
        );

        setIncomeEditValue("");

        return;
      }

      setIncomeAction(
        `edit-${oldName}`
      );

      try {
        const result =
          await updateIncomeCategory(
            oldName,
            value
          );

        if (!result?.success) {
          setIncomeError(
            result?.message ||
              "No se pudo actualizar la categoría de ingreso."
          );

          return;
        }

        setEditingIncomeCategory(
          null
        );

        setIncomeEditValue("");

        setIncomeMessage(
          result.message ||
            "Categoría de ingreso actualizada correctamente."
        );
      } catch (error) {
        console.error(
          "No se pudo actualizar la categoría de ingreso:",
          error
        );

        setIncomeError(
          "No se pudo actualizar la categoría de ingreso. Volvé a intentarlo."
        );
      } finally {
        setIncomeAction("");
      }
    };

  const handleSaveExpenseEdit =
    async (oldName) => {
      const value =
        expenseEditValue.trim();

      resetExpenseMessages();

      if (!value) {
        setExpenseError(
          "El nombre de la categoría no puede estar vacío."
        );

        return;
      }

      const duplicated =
        expenseCategories.some(
          (category) =>
            category.toLowerCase() ===
              value.toLowerCase() &&
            category.toLowerCase() !==
              oldName.toLowerCase()
        );

      if (duplicated) {
        setExpenseError(
          "Ya existe otra categoría de gasto con ese nombre."
        );

        return;
      }

      if (
        value.toLowerCase() ===
        oldName.toLowerCase()
      ) {
        setEditingExpenseCategory(
          null
        );

        setExpenseEditValue("");

        return;
      }

      setExpenseAction(
        `edit-${oldName}`
      );

      try {
        const result =
          await updateExpenseCategory(
            oldName,
            value
          );

        if (!result?.success) {
          setExpenseError(
            result?.message ||
              "No se pudo actualizar la categoría de gasto."
          );

          return;
        }

        setEditingExpenseCategory(
          null
        );

        setExpenseEditValue("");

        setExpenseMessage(
          result.message ||
            "Categoría de gasto actualizada correctamente."
        );
      } catch (error) {
        console.error(
          "No se pudo actualizar la categoría de gasto:",
          error
        );

        setExpenseError(
          "No se pudo actualizar la categoría de gasto. Volvé a intentarlo."
        );
      } finally {
        setExpenseAction("");
      }
    };

  const handleCancelIncomeEdit =
    () => {
      if (isIncomeBusy) {
        return;
      }

      setEditingIncomeCategory(
        null
      );

      setIncomeEditValue("");

      resetIncomeMessages();
    };

  const handleCancelExpenseEdit =
    () => {
      if (isExpenseBusy) {
        return;
      }

      setEditingExpenseCategory(
        null
      );

      setExpenseEditValue("");

      resetExpenseMessages();
    };

  const handleDeleteIncome =
    async (category) => {
      resetIncomeMessages();

      const confirmed =
        window.confirm(
          `¿Seguro que deseas eliminar la categoría "${category}"? Los ingresos asociados pasarán a la categoría General.`
        );

      if (!confirmed) {
        return;
      }

      setIncomeAction(
        `delete-${category}`
      );

      try {
        const result =
          await deleteIncomeCategory(
            category
          );

        if (!result?.success) {
          setIncomeError(
            result?.message ||
              "No se pudo eliminar la categoría de ingreso."
          );

          return;
        }

        if (
          editingIncomeCategory ===
          category
        ) {
          setEditingIncomeCategory(
            null
          );

          setIncomeEditValue("");
        }

        setIncomeMessage(
          result.message ||
            "Categoría de ingreso eliminada correctamente."
        );
      } catch (error) {
        console.error(
          "No se pudo eliminar la categoría de ingreso:",
          error
        );

        setIncomeError(
          "No se pudo eliminar la categoría de ingreso. Volvé a intentarlo."
        );
      } finally {
        setIncomeAction("");
      }
    };

  const handleDeleteExpense =
    async (category) => {
      resetExpenseMessages();

      const confirmed =
        window.confirm(
          `¿Seguro que deseas eliminar la categoría "${category}"? Los gastos asociados pasarán a la categoría General.`
        );

      if (!confirmed) {
        return;
      }

      setExpenseAction(
        `delete-${category}`
      );

      try {
        const result =
          await deleteExpenseCategory(
            category
          );

        if (!result?.success) {
          setExpenseError(
            result?.message ||
              "No se pudo eliminar la categoría de gasto."
          );

          return;
        }

        if (
          editingExpenseCategory ===
          category
        ) {
          setEditingExpenseCategory(
            null
          );

          setExpenseEditValue("");
        }

        setExpenseMessage(
          result.message ||
            "Categoría de gasto eliminada correctamente."
        );
      } catch (error) {
        console.error(
          "No se pudo eliminar la categoría de gasto:",
          error
        );

        setExpenseError(
          "No se pudo eliminar la categoría de gasto. Volvé a intentarlo."
        );
      } finally {
        setExpenseAction("");
      }
    };

  const handleIncomeKeyDown = (
    event
  ) => {
    if (
      event.key === "Enter" &&
      !isIncomeBusy
    ) {
      event.preventDefault();

      void handleAddIncomeCategory();
    }
  };

  const handleExpenseKeyDown = (
    event
  ) => {
    if (
      event.key === "Enter" &&
      !isExpenseBusy
    ) {
      event.preventDefault();

      void handleAddExpenseCategory();
    }
  };

  const handleIncomeEditKeyDown = (
    event,
    category
  ) => {
    if (
      event.key === "Enter" &&
      !isIncomeBusy
    ) {
      event.preventDefault();

      void handleSaveIncomeEdit(
        category
      );
    }

    if (
      event.key === "Escape" &&
      !isIncomeBusy
    ) {
      handleCancelIncomeEdit();
    }
  };

  const handleExpenseEditKeyDown = (
    event,
    category
  ) => {
    if (
      event.key === "Enter" &&
      !isExpenseBusy
    ) {
      event.preventDefault();

      void handleSaveExpenseEdit(
        category
      );
    }

    if (
      event.key === "Escape" &&
      !isExpenseBusy
    ) {
      handleCancelExpenseEdit();
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          Categorías
        </h1>

        <p className={styles.subtitle}>
          Administra por separado las
          categorías de ingresos y gastos.
        </p>
      </div>

      <div className={styles.grid}>
        <section
          className={styles.card}
          aria-busy={isIncomeBusy}
        >
          <h2
            className={styles.cardTitle}
          >
            Categorías de ingresos
          </h2>

          {incomeError && (
            <div
              className={`${styles.message} ${styles.errorMessage}`}
              role="alert"
            >
              <i className="bi bi-exclamation-circle"></i>

              <span>
                {incomeError}
              </span>
            </div>
          )}

          {incomeMessage && (
            <div
              className={`${styles.message} ${styles.successMessage}`}
              role="status"
            >
              <i className="bi bi-check-circle"></i>

              <span>
                {incomeMessage}
              </span>
            </div>
          )}

          <div className={styles.addRow}>
            <input
              className={styles.input}
              type="text"
              placeholder="Nueva categoría de ingreso"
              value={newIncomeCategory}
              onChange={(event) => {
                setNewIncomeCategory(
                  event.target.value
                );

                resetIncomeMessages();
              }}
              onKeyDown={
                handleIncomeKeyDown
              }
              disabled={isIncomeBusy}
            />

            <button
              className={
                styles.addButton
              }
              type="button"
              onClick={() =>
                void handleAddIncomeCategory()
              }
              disabled={isIncomeBusy}
            >
              <i
                className={
                  incomeAction === "add"
                    ? "bi bi-hourglass-split"
                    : "bi bi-plus-circle"
                }
              ></i>

              {incomeAction === "add"
                ? "Agregando..."
                : "Agregar"}
            </button>
          </div>

          <div className={styles.list}>
            {incomeCategories.map(
              (category) => {
                const isEditing =
                  editingIncomeCategory ===
                  category;

                const isProtected =
                  category === "General";

                const isSaving =
                  incomeAction ===
                  `edit-${category}`;

                const isDeleting =
                  incomeAction ===
                  `delete-${category}`;

                return (
                  <div
                    key={category}
                    className={styles.item}
                  >
                    {isEditing ? (
                      <>
                        <input
                          className={
                            styles.editInput
                          }
                          type="text"
                          value={
                            incomeEditValue
                          }
                          onChange={(
                            event
                          ) => {
                            setIncomeEditValue(
                              event.target
                                .value
                            );

                            resetIncomeMessages();
                          }}
                          onKeyDown={(
                            event
                          ) =>
                            handleIncomeEditKeyDown(
                              event,
                              category
                            )
                          }
                          disabled={
                            isIncomeBusy
                          }
                          autoFocus
                        />

                        <div
                          className={
                            styles.actions
                          }
                        >
                          <button
                            className={
                              styles.iconButton
                            }
                            type="button"
                            onClick={() =>
                              void handleSaveIncomeEdit(
                                category
                              )
                            }
                            disabled={
                              isIncomeBusy
                            }
                            title="Guardar"
                            aria-label={`Guardar cambios de ${category}`}
                          >
                            <i
                              className={
                                isSaving
                                  ? "bi bi-hourglass-split"
                                  : "bi bi-check-lg"
                              }
                            ></i>
                          </button>

                          <button
                            className={
                              styles.iconButton
                            }
                            type="button"
                            onClick={
                              handleCancelIncomeEdit
                            }
                            disabled={
                              isIncomeBusy
                            }
                            title="Cancelar"
                            aria-label={`Cancelar edición de ${category}`}
                          >
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span
                          className={
                            styles.itemName
                          }
                        >
                          {category}
                        </span>

                        <div
                          className={
                            styles.actions
                          }
                        >
                          <button
                            className={
                              styles.iconButton
                            }
                            type="button"
                            onClick={() =>
                              handleStartEditIncome(
                                category
                              )
                            }
                            disabled={
                              isProtected ||
                              isIncomeBusy
                            }
                            title={
                              isProtected
                                ? "La categoría General no se puede editar"
                                : "Editar"
                            }
                            aria-label={`Editar categoría ${category}`}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>

                          <button
                            className={`${styles.iconButton} ${styles.deleteButton}`}
                            type="button"
                            onClick={() =>
                              void handleDeleteIncome(
                                category
                              )
                            }
                            disabled={
                              isProtected ||
                              isIncomeBusy
                            }
                            title={
                              isProtected
                                ? "La categoría General no se puede eliminar"
                                : "Eliminar"
                            }
                            aria-label={`Eliminar categoría ${category}`}
                          >
                            <i
                              className={
                                isDeleting
                                  ? "bi bi-hourglass-split"
                                  : "bi bi-trash"
                              }
                            ></i>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </section>

        <section
          className={styles.card}
          aria-busy={isExpenseBusy}
        >
          <h2
            className={styles.cardTitle}
          >
            Categorías de gastos
          </h2>

          {expenseError && (
            <div
              className={`${styles.message} ${styles.errorMessage}`}
              role="alert"
            >
              <i className="bi bi-exclamation-circle"></i>

              <span>
                {expenseError}
              </span>
            </div>
          )}

          {expenseMessage && (
            <div
              className={`${styles.message} ${styles.successMessage}`}
              role="status"
            >
              <i className="bi bi-check-circle"></i>

              <span>
                {expenseMessage}
              </span>
            </div>
          )}

          <div className={styles.addRow}>
            <input
              className={styles.input}
              type="text"
              placeholder="Nueva categoría de gasto"
              value={
                newExpenseCategory
              }
              onChange={(event) => {
                setNewExpenseCategory(
                  event.target.value
                );

                resetExpenseMessages();
              }}
              onKeyDown={
                handleExpenseKeyDown
              }
              disabled={isExpenseBusy}
            />

            <button
              className={
                styles.addButton
              }
              type="button"
              onClick={() =>
                void handleAddExpenseCategory()
              }
              disabled={isExpenseBusy}
            >
              <i
                className={
                  expenseAction === "add"
                    ? "bi bi-hourglass-split"
                    : "bi bi-plus-circle"
                }
              ></i>

              {expenseAction === "add"
                ? "Agregando..."
                : "Agregar"}
            </button>
          </div>

          <div className={styles.list}>
            {expenseCategories.map(
              (category) => {
                const isEditing =
                  editingExpenseCategory ===
                  category;

                const isProtected =
                  category === "General";

                const isSaving =
                  expenseAction ===
                  `edit-${category}`;

                const isDeleting =
                  expenseAction ===
                  `delete-${category}`;

                return (
                  <div
                    key={category}
                    className={styles.item}
                  >
                    {isEditing ? (
                      <>
                        <input
                          className={
                            styles.editInput
                          }
                          type="text"
                          value={
                            expenseEditValue
                          }
                          onChange={(
                            event
                          ) => {
                            setExpenseEditValue(
                              event.target
                                .value
                            );

                            resetExpenseMessages();
                          }}
                          onKeyDown={(
                            event
                          ) =>
                            handleExpenseEditKeyDown(
                              event,
                              category
                            )
                          }
                          disabled={
                            isExpenseBusy
                          }
                          autoFocus
                        />

                        <div
                          className={
                            styles.actions
                          }
                        >
                          <button
                            className={
                              styles.iconButton
                            }
                            type="button"
                            onClick={() =>
                              void handleSaveExpenseEdit(
                                category
                              )
                            }
                            disabled={
                              isExpenseBusy
                            }
                            title="Guardar"
                            aria-label={`Guardar cambios de ${category}`}
                          >
                            <i
                              className={
                                isSaving
                                  ? "bi bi-hourglass-split"
                                  : "bi bi-check-lg"
                              }
                            ></i>
                          </button>

                          <button
                            className={
                              styles.iconButton
                            }
                            type="button"
                            onClick={
                              handleCancelExpenseEdit
                            }
                            disabled={
                              isExpenseBusy
                            }
                            title="Cancelar"
                            aria-label={`Cancelar edición de ${category}`}
                          >
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span
                          className={
                            styles.itemName
                          }
                        >
                          {category}
                        </span>

                        <div
                          className={
                            styles.actions
                          }
                        >
                          <button
                            className={
                              styles.iconButton
                            }
                            type="button"
                            onClick={() =>
                              handleStartEditExpense(
                                category
                              )
                            }
                            disabled={
                              isProtected ||
                              isExpenseBusy
                            }
                            title={
                              isProtected
                                ? "La categoría General no se puede editar"
                                : "Editar"
                            }
                            aria-label={`Editar categoría ${category}`}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>

                          <button
                            className={`${styles.iconButton} ${styles.deleteButton}`}
                            type="button"
                            onClick={() =>
                              void handleDeleteExpense(
                                category
                              )
                            }
                            disabled={
                              isProtected ||
                              isExpenseBusy
                            }
                            title={
                              isProtected
                                ? "La categoría General no se puede eliminar"
                                : "Eliminar"
                            }
                            aria-label={`Eliminar categoría ${category}`}
                          >
                            <i
                              className={
                                isDeleting
                                  ? "bi bi-hourglass-split"
                                  : "bi bi-trash"
                              }
                            ></i>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Categories;