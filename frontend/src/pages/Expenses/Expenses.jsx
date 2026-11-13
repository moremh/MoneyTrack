import { useSearchParams } from "react-router-dom";
import { AccountContext } from "../../context/AccountContext";
import { DialogContext } from "../../context/DialogContext/DialogContext";
import useTransactionAnnotations from "../../hooks/useTransactionAnnotations";
import { matchesMovement, orderMovements } from "../../utils/movementFilters";
import MovementFilters, { EMPTY_MOVEMENT_FILTERS } from "../../components/income/MovementFilters/MovementFilters";
import MovementDetails from "../../components/income/MovementDetails/MovementDetails";
import {
  useContext,
  useEffect,
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
  const [searchParams] = useSearchParams();
  const { accounts = [] } = useContext(AccountContext) || {};
  const { confirmDialog, alertDialog } = useContext(DialogContext) || {};
  const { annotations, saveAnnotation } = useTransactionAnnotations();
  const [detailsMovement, setDetailsMovement] = useState(null);
  const [duplicateMovement, setDuplicateMovement] = useState(null);
  const [filters, setFilters] = useState(() => ({...EMPTY_MOVEMENT_FILTERS, query: searchParams.get("q") || ""}));
  const queryParam = searchParams.get("q") || "";
  useEffect(() => { setFilters(old => ({...old, query: queryParam})); }, [queryParam]);

  const {
    expenses,
    addExpense,
    deleteExpense,
    updateExpense,
    movementUsage,
    settings,
  } = useContext(FinanceContext);

  const [
    editingExpense,
    setEditingExpense,
  ] = useState(null);

  const [
    showPremiumModal,
    setShowPremiumModal,
  ] = useState(false);



  const categories = useMemo(() => [...new Set(expenses.map(item => item.category || "General"))].sort(), [expenses]);
  const tags = useMemo(() => [...new Set(Object.values(annotations).flatMap(item => item.tags || []))].sort(), [annotations]);
  const accountNames = useMemo(() => new Map(accounts.map(account=>[account.id,account.name])),[accounts]);
  const filteredExpenses = useMemo(() => orderMovements(
    expenses.filter(item => matchesMovement(item,filters,annotations,accountNames.get(item.accountId)||"")),filters.order
  ),[expenses,filters,annotations,accountNames]);

  const handleDelete = async movementId => {
    const item = expenses.find(entry=>entry.id===movementId);
    if (!item) return;
    const confirmed = await confirmDialog?.({title:"Eliminar gasto",message:`¿Eliminar "${item.description}" por $${Number(item.amount).toLocaleString("es-AR")}? Esta acción no se puede deshacer.`,confirmText:"Eliminar",cancelText:"Cancelar",danger:true});
    if (!confirmed) return;
    const result = await deleteExpense(movementId);
    if (result?.success === false) await alertDialog?.({title:"Error al eliminar",message:result.message || "No se pudo eliminar el registro.",danger:true});
  };

  const handleDuplicate = async movement => {
    const result = await addExpense(movement);
    if (result?.success) setDuplicateMovement(null);
    return result;
  };

  const handleUpdateExpense = async (
    updatedExpense
  ) => {
    if (!editingExpense) {
      return {
        success: false,
        message:
          "No se encontró el gasto que deseas editar.",
      };
    }

    try {
      const result =
        await updateExpense({
          ...updatedExpense,
          id: editingExpense.id,
        });

      if (!result?.success) {
        return (
          result || {
            success: false,
            message:
              "No se pudo actualizar el gasto.",
          }
        );
      }

      setEditingExpense(null);

      return result;
    } catch (error) {
      console.error(
        "No se pudo actualizar el gasto:",
        error
      );

      return {
        success: false,
        message:
          "No se pudo actualizar el gasto. Volvé a intentarlo.",
      };
    }
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
        <MovementFilters filters={filters} onChange={setFilters} categories={categories}
          accounts={accounts} tags={tags} />
        <p className={styles.results}>
          Mostrando{" "}
          {filteredExpenses.length} de{" "}
          {expenses.length} gastos
        </p>

        <IncomeTable
          incomes={filteredExpenses}
          onDelete={handleDelete}
          onDetails={setDetailsMovement}
          onDuplicate={setDuplicateMovement}
          onEdit={setEditingExpense}
        />
      </Card>

      {editingExpense && (
        <Modal
          onClose={() =>
            setEditingExpense(null)
          }
        >
          <h2
            className={
              styles.modalTitle
            }
          >
            Editar gasto
          </h2>

          <IncomeForm
            initialData={
              editingExpense
            }
            type="expense"
            onAdd={
              handleUpdateExpense
            }
          />
        </Modal>
      )}

      {detailsMovement && <MovementDetails movement={detailsMovement}
        accountName={accountNames.get(detailsMovement.accountId)}
        annotation={annotations[detailsMovement.id]} settings={settings} onSave={saveAnnotation}
        onClose={() => setDetailsMovement(null)} />}
      {duplicateMovement && <Modal onClose={() => setDuplicateMovement(null)}>
        <h2>Duplicar gasto</h2>
        <p>Se creará un nuevo movimiento. Podés revisar los datos antes de guardarlo.</p>
        <IncomeForm type="expense" templateData={duplicateMovement} onAdd={handleDuplicate}
          onLimitReached={() => setShowPremiumModal(true)} />
      </Modal>}
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