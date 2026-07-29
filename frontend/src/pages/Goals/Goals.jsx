import {
  useContext,
  useState,
} from "react";

import { FinanceContext } from "../../context/FinanceContext";

import Card from "../../components/common/Card/Card";
import Modal from "../../components/common/Modal/Modal";
import GoalForm from "../../components/goals/GoalForm/GoalForm";
import GoalList from "../../components/goals/GoalList/GoalList";

import styles from "./Goals.module.css";

function Goals() {
  const {
    goals,
    addGoal,
    deleteGoal,
    updateGoal,
    loading,
  } = useContext(FinanceContext);

  const [
    editingGoal,
    setEditingGoal,
  ] = useState(null);

  const [
    deletingGoalId,
    setDeletingGoalId,
  ] = useState(null);

  const handleCreateGoal = async (
    newGoal
  ) => {
    try {
      const result =
        await addGoal(newGoal);

      return (
        result || {
          success: false,
          message:
            "No se pudo crear el objetivo.",
        }
      );
    } catch (error) {
      console.error(
        "No se pudo crear el objetivo:",
        error
      );

      return {
        success: false,
        message:
          "No se pudo crear el objetivo. Volvé a intentarlo.",
      };
    }
  };

  const handleUpdateGoal = async (
    updatedGoal
  ) => {
    if (!editingGoal) {
      return {
        success: false,
        message:
          "No se encontró el objetivo que deseas editar.",
      };
    }

    try {
      const result =
        await updateGoal({
          ...updatedGoal,
          id: editingGoal.id,
        });

      if (!result?.success) {
        return (
          result || {
            success: false,
            message:
              "No se pudo actualizar el objetivo.",
          }
        );
      }

      setEditingGoal(null);

      return result;
    } catch (error) {
      console.error(
        "No se pudo actualizar el objetivo:",
        error
      );

      return {
        success: false,
        message:
          "No se pudo actualizar el objetivo. Volvé a intentarlo.",
      };
    }
  };

  const handleDeleteGoal = async (
    goalId
  ) => {
    const selectedGoal =
      goals.find(
        (goal) =>
          goal.id === goalId
      );

    const goalName =
      selectedGoal?.title ||
      selectedGoal?.name ||
      "este objetivo";

    const confirmed =
      window.confirm(
        `¿Seguro que deseas eliminar "${goalName}"? Esta acción no se puede deshacer.`
      );

    if (!confirmed) {
      return {
        success: false,
        cancelled: true,
      };
    }

    setDeletingGoalId(goalId);

    try {
      const result =
        await deleteGoal(goalId);

      if (!result?.success) {
        window.alert(
          result?.message ||
            "No se pudo eliminar el objetivo."
        );

        return (
          result || {
            success: false,
          }
        );
      }

      if (
        editingGoal?.id === goalId
      ) {
        setEditingGoal(null);
      }

      return result;
    } catch (error) {
      console.error(
        "No se pudo eliminar el objetivo:",
        error
      );

      window.alert(
        "No se pudo eliminar el objetivo. Volvé a intentarlo."
      );

      return {
        success: false,
        message:
          "No se pudo eliminar el objetivo.",
      };
    } finally {
      setDeletingGoalId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          Objetivos
        </h1>

        <p className={styles.subtitle}>
          Define metas de ahorro y seguí tu
          progreso.
        </p>
      </div>

      <Card title="Nuevo objetivo">
        <GoalForm
          onSubmit={handleCreateGoal}
        />
      </Card>

      <Card title="Lista de objetivos">
        <GoalList
          goals={goals}
          loading={loading}
          deletingGoalId={
            deletingGoalId
          }
          onEdit={setEditingGoal}
          onDelete={
            handleDeleteGoal
          }
        />
      </Card>

      {editingGoal && (
        <Modal
          onClose={() =>
            setEditingGoal(null)
          }
        >
          <h2
            className={
              styles.modalTitle
            }
          >
            Editar objetivo
          </h2>

          <GoalForm
            initialData={editingGoal}
            onSubmit={
              handleUpdateGoal
            }
          />
        </Modal>
      )}
    </div>
  );
}

export default Goals;