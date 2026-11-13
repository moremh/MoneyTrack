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

import styles from "./Income.module.css";

function Income() {
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
    incomes,
    addIncome,
    deleteIncome,
    updateIncome,
    movementUsage,
    settings,
  } = useContext(FinanceContext);

  const [
    editingIncome,
    setEditingIncome,
  ] = useState(null);

  const [
    showPremiumModal,
    setShowPremiumModal,
  ] = useState(false);



  const categories = useMemo(() => [...new Set(incomes.map(item => item.category || "General"))].sort(), [incomes]);
  const tags = useMemo(() => [...new Set(Object.values(annotations).flatMap(item => item.tags || []))].sort(), [annotations]);
  const accountNames = useMemo(() => new Map(accounts.map(account=>[account.id,account.name])),[accounts]);
  const filteredIncomes = useMemo(() => orderMovements(
    incomes.filter(item => matchesMovement(item,filters,annotations,accountNames.get(item.accountId)||"")),filters.order
  ),[incomes,filters,annotations,accountNames]);

  const handleDelete = async movementId => {
    const item = incomes.find(entry=>entry.id===movementId);
    if (!item) return;
    const confirmed = await confirmDialog?.({title:"Eliminar ingreso",message:`¿Eliminar "${item.description}" por $${Number(item.amount).toLocaleString("es-AR")}? Esta acción no se puede deshacer.`,confirmText:"Eliminar",cancelText:"Cancelar",danger:true});
    if (!confirmed) return;
    const result = await deleteIncome(movementId);
    if (result?.success === false) await alertDialog?.({title:"Error al eliminar",message:result.message || "No se pudo eliminar el registro.",danger:true});
  };

  const handleDuplicate = async movement => {
    const result = await addIncome(movement);
    if (result?.success) setDuplicateMovement(null);
    return result;
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
        <MovementFilters filters={filters} onChange={setFilters} categories={categories}
          accounts={accounts} tags={tags} />
        <p className={styles.results}>
          Mostrando{" "}
          {filteredIncomes.length} de{" "}
          {incomes.length} ingresos
        </p>

        <IncomeTable
          incomes={filteredIncomes}
          onDelete={handleDelete}
          onDetails={setDetailsMovement}
          onDuplicate={setDuplicateMovement}
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

      {detailsMovement && <MovementDetails movement={detailsMovement}
        accountName={accountNames.get(detailsMovement.accountId)}
        annotation={annotations[detailsMovement.id]} settings={settings} onSave={saveAnnotation}
        onClose={() => setDetailsMovement(null)} />}
      {duplicateMovement && <Modal onClose={() => setDuplicateMovement(null)}>
        <h2>Duplicar ingreso</h2>
        <p>Se creará un nuevo movimiento. Podés revisar los datos antes de guardarlo.</p>
        <IncomeForm type="income" templateData={duplicateMovement} onAdd={handleDuplicate}
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

export default Income;