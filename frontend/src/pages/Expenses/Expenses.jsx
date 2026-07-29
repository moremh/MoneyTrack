import {
  useContext,
  useMemo,
  useState,
} from "react";

import { FinanceContext } from "../../context/FinanceContext";

import IncomeForm from "../../components/income/IncomeForm/IncomeForm";
import IncomeTable from "../../components/income/IncomeTable/IncomeTable";
import Card from "../../components/common/Card/Card";
import Modal from "../../components/common/Modal/Modal";

import MovementUsage from "../../components/premium/MovementUsage/MovementUsage";
import PremiumLimitModal from "../../components/premium/PremiumLimitModal/PremiumLimitModal";

import styles from "./Expenses.module.css";

function Expenses() {
  const {
    expenses,
    addExpense,
    deleteExpense,
    updateExpense,
    movementUsage,
  } = useContext(FinanceContext);

  const [editingExpense, setEditingExpense] =
    useState(null);

  const [showPremiumModal, setShowPremiumModal] =
    useState(false);

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      if (fromDate && item.date < fromDate) {
        return false;
      }

      if (toDate && item.date > toDate) {
        return false;
      }

      return true;
    });
  }, [expenses, fromDate, toDate]);

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
  };

  const handleUpdateExpense = (updatedExpense) => {
    if (!editingExpense) {
      return {
        success: false,
        message: "No se encontró el gasto que deseas editar.",
      };
    }

    const result = updateExpense({
      ...updatedExpense,
      id: editingExpense.id,
    });

    if (result?.success === false) {
      return result;
    }

    setEditingExpense(null);

    return result || {
      success: true,
    };
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        Gastos
      </h1>

      <MovementUsage
        usage={movementUsage}
        onPremiumClick={() =>
          setShowPremiumModal(true)
        }
      />

      <Card title="Nuevo gasto">
        <IncomeForm
          onAdd={addExpense}
          type="expense"
          onLimitReached={() =>
            setShowPremiumModal(true)
          }
        />
      </Card>

      <Card title="Lista de gastos">
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label htmlFor="expense-from-date">
              Desde
            </label>

            <input
              id="expense-from-date"
              className={styles.filterInput}
              type="date"
              value={fromDate}
              onChange={(event) =>
                setFromDate(event.target.value)
              }
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="expense-to-date">
              Hasta
            </label>

            <input
              id="expense-to-date"
              className={styles.filterInput}
              type="date"
              value={toDate}
              onChange={(event) =>
                setToDate(event.target.value)
              }
            />
          </div>

          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.clearButton}
              onClick={clearFilters}
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <p className={styles.results}>
          Mostrando {filteredExpenses.length} de{" "}
          {expenses.length} gastos
        </p>

        <IncomeTable
          incomes={filteredExpenses}
          onDelete={deleteExpense}
          onEdit={setEditingExpense}
        />
      </Card>

      {editingExpense && (
        <Modal
          onClose={() => setEditingExpense(null)}
        >
          <h2 className={styles.modalTitle}>
            Editar gasto
          </h2>

          <IncomeForm
            initialData={editingExpense}
            type="expense"
            onAdd={handleUpdateExpense}
          />
        </Modal>
      )}

      {showPremiumModal && (
        <PremiumLimitModal
          usage={movementUsage}
          onClose={() =>
            setShowPremiumModal(false)
          }
        />
      )}
    </div>
  );
}

export default Expenses;