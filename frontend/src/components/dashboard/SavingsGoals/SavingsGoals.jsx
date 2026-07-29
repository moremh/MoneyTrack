import styles from "./SavingsGoals.module.css";

function SavingsGoals({ goals = [] }) {
  if (goals.length === 0) {
    return (
      <div className={styles.emptyState}>
        Todavía no hay objetivos cargados.
      </div>
    );
  }

  const topGoals = goals.slice(0, 3);

  return (
    <div className={styles.list}>
      {topGoals.map((goal) => {
        const percentage =
          goal.targetAmount > 0
            ? Math.min(
                100,
                Math.round((goal.currentAmount / goal.targetAmount) * 100)
              )
            : 0;

        return (
          <div key={goal.id} className={styles.item}>
            <div className={styles.row}>
              <span className={styles.name}>{goal.title}</span>
              <span className={styles.percent}>{percentage}%</span>
            </div>

            <div className={styles.progressBar}>
              <div
                className={styles.progress}
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SavingsGoals;