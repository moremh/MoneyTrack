import { useContext, useState } from "react";
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

  const [newIncomeCategory, setNewIncomeCategory] = useState("");
  const [newExpenseCategory, setNewExpenseCategory] = useState("");

  const [editingIncomeCategory, setEditingIncomeCategory] = useState(null);
  const [editingExpenseCategory, setEditingExpenseCategory] = useState(null);

  const [incomeEditValue, setIncomeEditValue] = useState("");
  const [expenseEditValue, setExpenseEditValue] = useState("");

  const [incomeMessage, setIncomeMessage] = useState("");
  const [expenseMessage, setExpenseMessage] = useState("");
  const [incomeError, setIncomeError] = useState("");
  const [expenseError, setExpenseError] = useState("");

  const resetIncomeMessages = () => {
    setIncomeMessage("");
    setIncomeError("");
  };

  const resetExpenseMessages = () => {
    setExpenseMessage("");
    setExpenseError("");
  };

  const handleAddIncomeCategory = () => {
    const value = newIncomeCategory.trim();

    resetIncomeMessages();

    if (!value) {
      setIncomeError("Debes escribir un nombre para la categoría de ingreso.");
      return;
    }

    if (
      incomeCategories.some(
        (category) => category.toLowerCase() === value.toLowerCase()
      )
    ) {
      setIncomeError("Esa categoría de ingreso ya existe.");
      return;
    }

    addIncomeCategory(value);
    setNewIncomeCategory("");
    setIncomeMessage("Categoría de ingreso agregada correctamente.");
  };

  const handleAddExpenseCategory = () => {
    const value = newExpenseCategory.trim();

    resetExpenseMessages();

    if (!value) {
      setExpenseError("Debes escribir un nombre para la categoría de gasto.");
      return;
    }

    if (
      expenseCategories.some(
        (category) => category.toLowerCase() === value.toLowerCase()
      )
    ) {
      setExpenseError("Esa categoría de gasto ya existe.");
      return;
    }

    addExpenseCategory(value);
    setNewExpenseCategory("");
    setExpenseMessage("Categoría de gasto agregada correctamente.");
  };

  const handleStartEditIncome = (category) => {
    resetIncomeMessages();
    setEditingIncomeCategory(category);
    setIncomeEditValue(category);
  };

  const handleStartEditExpense = (category) => {
    resetExpenseMessages();
    setEditingExpenseCategory(category);
    setExpenseEditValue(category);
  };

  const handleSaveIncomeEdit = (oldName) => {
    const value = incomeEditValue.trim();

    resetIncomeMessages();

    if (!value) {
      setIncomeError("El nombre de la categoría no puede estar vacío.");
      return;
    }

    const duplicated = incomeCategories.some(
      (category) =>
        category.toLowerCase() === value.toLowerCase() &&
        category.toLowerCase() !== oldName.toLowerCase()
    );

    if (duplicated) {
      setIncomeError("Ya existe otra categoría de ingreso con ese nombre.");
      return;
    }

    updateIncomeCategory(oldName, value);
    setEditingIncomeCategory(null);
    setIncomeEditValue("");
    setIncomeMessage("Categoría de ingreso actualizada correctamente.");
  };

  const handleSaveExpenseEdit = (oldName) => {
    const value = expenseEditValue.trim();

    resetExpenseMessages();

    if (!value) {
      setExpenseError("El nombre de la categoría no puede estar vacío.");
      return;
    }

    const duplicated = expenseCategories.some(
      (category) =>
        category.toLowerCase() === value.toLowerCase() &&
        category.toLowerCase() !== oldName.toLowerCase()
    );

    if (duplicated) {
      setExpenseError("Ya existe otra categoría de gasto con ese nombre.");
      return;
    }

    updateExpenseCategory(oldName, value);
    setEditingExpenseCategory(null);
    setExpenseEditValue("");
    setExpenseMessage("Categoría de gasto actualizada correctamente.");
  };

  const handleCancelIncomeEdit = () => {
    setEditingIncomeCategory(null);
    setIncomeEditValue("");
    resetIncomeMessages();
  };

  const handleCancelExpenseEdit = () => {
    setEditingExpenseCategory(null);
    setExpenseEditValue("");
    resetExpenseMessages();
  };

  const handleDeleteIncome = (category) => {
    resetIncomeMessages();
    deleteIncomeCategory(category);
    setIncomeMessage("Categoría de ingreso eliminada correctamente.");
  };

  const handleDeleteExpense = (category) => {
    resetExpenseMessages();
    deleteExpenseCategory(category);
    setExpenseMessage("Categoría de gasto eliminada correctamente.");
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Categorías</h1>
        <p className={styles.subtitle}>
          Administra por separado las categorías de ingresos y gastos.
        </p>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Categorías de ingresos</h2>

          {incomeError && (
            <div className={`${styles.message} ${styles.errorMessage}`}>
              <i className="bi bi-exclamation-circle"></i>
              <span>{incomeError}</span>
            </div>
          )}

          {incomeMessage && (
            <div className={`${styles.message} ${styles.successMessage}`}>
              <i className="bi bi-check-circle"></i>
              <span>{incomeMessage}</span>
            </div>
          )}

          <div className={styles.addRow}>
            <input
              className={styles.input}
              type="text"
              placeholder="Nueva categoría de ingreso"
              value={newIncomeCategory}
              onChange={(e) => setNewIncomeCategory(e.target.value)}
            />

            <button
              className={styles.addButton}
              type="button"
              onClick={handleAddIncomeCategory}
            >
              <i className="bi bi-plus-circle"></i>
              Agregar
            </button>
          </div>

          <div className={styles.list}>
            {incomeCategories.map((category) => {
              const isEditing = editingIncomeCategory === category;
              const isProtected = category === "General";

              return (
                <div key={category} className={styles.item}>
                  {isEditing ? (
                    <>
                      <input
                        className={styles.editInput}
                        type="text"
                        value={incomeEditValue}
                        onChange={(e) => setIncomeEditValue(e.target.value)}
                      />

                      <div className={styles.actions}>
                        <button
                          className={styles.iconButton}
                          type="button"
                          onClick={() => handleSaveIncomeEdit(category)}
                          title="Guardar"
                        >
                          <i className="bi bi-check-lg"></i>
                        </button>

                        <button
                          className={styles.iconButton}
                          type="button"
                          onClick={handleCancelIncomeEdit}
                          title="Cancelar"
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className={styles.itemName}>{category}</span>

                      <div className={styles.actions}>
                        <button
                          className={styles.iconButton}
                          type="button"
                          onClick={() => handleStartEditIncome(category)}
                          disabled={isProtected}
                          title="Editar"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>

                        <button
                          className={`${styles.iconButton} ${styles.deleteButton}`}
                          type="button"
                          onClick={() => handleDeleteIncome(category)}
                          disabled={isProtected}
                          title="Eliminar"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Categorías de gastos</h2>

          {expenseError && (
            <div className={`${styles.message} ${styles.errorMessage}`}>
              <i className="bi bi-exclamation-circle"></i>
              <span>{expenseError}</span>
            </div>
          )}

          {expenseMessage && (
            <div className={`${styles.message} ${styles.successMessage}`}>
              <i className="bi bi-check-circle"></i>
              <span>{expenseMessage}</span>
            </div>
          )}

          <div className={styles.addRow}>
            <input
              className={styles.input}
              type="text"
              placeholder="Nueva categoría de gasto"
              value={newExpenseCategory}
              onChange={(e) => setNewExpenseCategory(e.target.value)}
            />

            <button
              className={styles.addButton}
              type="button"
              onClick={handleAddExpenseCategory}
            >
              <i className="bi bi-plus-circle"></i>
              Agregar
            </button>
          </div>

          <div className={styles.list}>
            {expenseCategories.map((category) => {
              const isEditing = editingExpenseCategory === category;
              const isProtected = category === "General";

              return (
                <div key={category} className={styles.item}>
                  {isEditing ? (
                    <>
                      <input
                        className={styles.editInput}
                        type="text"
                        value={expenseEditValue}
                        onChange={(e) => setExpenseEditValue(e.target.value)}
                      />

                      <div className={styles.actions}>
                        <button
                          className={styles.iconButton}
                          type="button"
                          onClick={() => handleSaveExpenseEdit(category)}
                          title="Guardar"
                        >
                          <i className="bi bi-check-lg"></i>
                        </button>

                        <button
                          className={styles.iconButton}
                          type="button"
                          onClick={handleCancelExpenseEdit}
                          title="Cancelar"
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className={styles.itemName}>{category}</span>

                      <div className={styles.actions}>
                        <button
                          className={styles.iconButton}
                          type="button"
                          onClick={() => handleStartEditExpense(category)}
                          disabled={isProtected}
                          title="Editar"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>

                        <button
                          className={`${styles.iconButton} ${styles.deleteButton}`}
                          type="button"
                          onClick={() => handleDeleteExpense(category)}
                          disabled={isProtected}
                          title="Eliminar"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Categories;