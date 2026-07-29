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

import styles from "./Income.module.css";

function Income() {
  const {
    incomes,
    addIncome,
    deleteIncome,
    updateIncome,
    movementUsage,
  } = useContext(FinanceContext);

  const [
    editingIncome,
    setEditingIncome,
  ] = useState(null);

  const [
    showPremiumModal,
    setShowPremiumModal,
  ] = useState(false);

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const filteredIncomes = useMemo(() => {
    return incomes.filter((item) => {
      if (
        fromDate &&
        item.date < fromDate
      ) {
        return false;
      }

      if (
        toDate &&
        item.date > toDate
      ) {
        return false;
      }

      return true;
    });
  }, [
    incomes,
    fromDate,
    toDate,
  ]);

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
  };

  const handleUpdateIncome = async (
    updatedIncome
  ) => {
    if (!editingIncome) {
      return {
        success: false,
        message:
          "No se encontró el ingreso que deseas editar.",
      };
    }

    try {
      const result =
        await updateIncome({
          ...updatedIncome,
          id: editingIncome.id,
        });

      if (!result?.success) {
        return (
          result || {
            success: false,
            message:
              "No se pudo actualizar el ingreso.",
          }
        );
      }

      setEditingIncome(null);

      return result;
    } catch (error) {
      console.error(
        "No se pudo actualizar el ingreso:",
        error
      );

      return {
        success: false,
        message:
          "No se pudo actualizar el ingreso. Volvé a intentarlo.",
      };
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        Ingresos
      </h1>

      <MovementUsage
        usage={movementUsage}
        onPremiumClick={() =>
          setShowPremiumModal(true)
        }
      />

      <Card title="Nuevo ingreso">
        <IncomeForm
          onAdd={addIncome}
          type="income"
          onLimitReached={() =>
            setShowPremiumModal(true)
          }
        />
      </Card>

      <Card title="Lista de ingresos">
        <div className={styles.filters}>
          <div
            className={
              styles.filterGroup
            }
          >
            <label htmlFor="income-from-date">
              Desde
            </label>

            <input
              id="income-from-date"
              className={
                styles.filterInput
              }
              type="date"
              value={fromDate}
              onChange={(event) =>
                setFromDate(
                  event.target.value
                )
              }
            />
          </div>

          <div
            className={
              styles.filterGroup
            }
          >
            <label htmlFor="income-to-date">
              Hasta
            </label>

            <input
              id="income-to-date"
              className={
                styles.filterInput
              }
              type="date"
              value={toDate}
              onChange={(event) =>
                setToDate(
                  event.target.value
                )
              }
            />
          </div>

          <div
            className={
              styles.filterActions
            }
          >
            <button
              type="button"
              className={
                styles.clearButton
              }
              onClick={clearFilters}
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <p className={styles.results}>
          Mostrando{" "}
          {filteredIncomes.length} de{" "}
          {incomes.length} ingresos
        </p>

        <IncomeTable
          incomes={filteredIncomes}
          onDelete={deleteIncome}
          onEdit={setEditingIncome}
        />
      </Card>

      {editingIncome && (
        <Modal
          onClose={() =>
            setEditingIncome(null)
          }
        >
          <h2
            className={
              styles.modalTitle
            }
          >
            Editar ingreso
          </h2>

          <IncomeForm
            initialData={editingIncome}
            type="income"
            onAdd={
              handleUpdateIncome
            }
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

export default Income;