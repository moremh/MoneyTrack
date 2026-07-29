import { useContext, useState } from "react";
import { FinanceContext } from "../../context/FinanceContext";

import Card from "../../components/common/Card/Card";
import Modal from "../../components/common/Modal/Modal";
import GoalForm from "../../components/goals/GoalForm/GoalForm";
import GoalList from "../../components/goals/GoalList/GoalList";

import styles from "./Goals.module.css";

function Goals() {
  const { goals, addGoal, deleteGoal, updateGoal } =
    useContext(FinanceContext);

  const [editingGoal, setEditingGoal] = useState(null);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Objetivos</h1>
        <p className={styles.subtitle}>
          Define metas de ahorro y seguí tu progreso.
        </p>
      </div>

      <Card title="Nuevo objetivo">
        <GoalForm onSubmit={addGoal} />
      </Card>

      <Card title="Lista de objetivos">
        <GoalList
          goals={goals}
          onEdit={setEditingGoal}
          onDelete={deleteGoal}
        />
      </Card>

      {editingGoal && (
        <Modal onClose={() => setEditingGoal(null)}>
          <h2 className={styles.modalTitle}>Editar objetivo</h2>

          <GoalForm
            initialData={editingGoal}
            onSubmit={(updated) => {
              updateGoal(updated);
              setEditingGoal(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default Goals;