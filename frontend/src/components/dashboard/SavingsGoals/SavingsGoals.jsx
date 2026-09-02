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
        const targetAmount =
          Number(goal.targetAmount) || 0;

        const currentAmount =
          Number(goal.currentAmount) || 0;

        const rawPercentage =
          targetAmount > 0
            ? (currentAmount / targetAmount) * 100
            : 0;

        const percentage = Math.min(
          100,
          Math.max(0, rawPercentage)
        );

        const percentageLabel =
  percentage <= 0
    ? "0"
    : percentage < 10
      ? percentage
          .toFixed(1)
          .replace(".", ",")
      : String(
          Math.round(
            percentage
          )
        );

        const hasProgress =
          currentAmount > 0 && percentage > 0;

        return (
          <div key={goal.id} className={styles.item}>
            <div className={styles.row}>
              <span className={styles.name}>
                {goal.title}
              </span>

              <span className={styles.percent}>
                {percentageLabel}%
              </span>
            </div>

            <div
              className={styles.progressBar}
              role="progressbar"
              aria-label={`Progreso de ${
                goal.title || goal.name || "objetivo"
              }`}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Number(
                percentage.toFixed(2)
              )}
            >
              <div
                className={styles.progress}
                style={{
                  width: `${percentage}%`,
                  minWidth: hasProgress ? "4px" : "0",
                }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SavingsGoals;