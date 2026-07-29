import styles from "./GoalList.module.css";

function GoalList({ goals, onEdit, onDelete }) {
  if (goals.length === 0) {
    return (
      <div className={styles.emptyState}>
        Todavía no agregaste objetivos.
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {goals.map((goal) => {
        const percentage =
          goal.targetAmount > 0
            ? Math.min(
                100,
                Math.round((goal.currentAmount / goal.targetAmount) * 100)
              )
            : 0;

        return (
          <div key={goal.id} className={styles.card}>
            <div className={styles.top}>
              <div>
                <h3 className={styles.title}>{goal.title}</h3>
                <p className={styles.deadline}>
                  Fecha límite:{" "}
                  {goal.deadline
                    ? goal.deadline.split("-").reverse().join("/")
                    : "Sin definir"}
                </p>
              </div>

              <div className={styles.actions}>
                <button type="button" onClick={() => onEdit(goal)}>
                  <i className="bi bi-pencil"></i>
                </button>

                <button type="button" onClick={() => onDelete(goal.id)}>
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            </div>

            <div className={styles.values}>
              <span>
                Ahorrado: $ {Number(goal.currentAmount).toLocaleString("es-AR")}
              </span>
              <span>
                Objetivo: $ {Number(goal.targetAmount).toLocaleString("es-AR")}
              </span>
            </div>

            <div className={styles.progressBar}>
              <div
                className={styles.progress}
                style={{ width: `${percentage}%` }}
              ></div>
            </div>

            <p className={styles.percent}>{percentage}% completado</p>
          </div>
        );
      })}
    </div>
  );
}

export default GoalList;