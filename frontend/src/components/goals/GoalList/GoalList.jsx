import styles from "./GoalList.module.css";

function GoalList({
  goals = [],
  onEdit,
  onDelete,
  loading = false,
  deletingGoalId = null,
}) {
  if (loading) {
    return (
      <div
        className={styles.emptyState}
        role="status"
      >
        Cargando objetivos...
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div
        className={styles.emptyState}
      >
        Todavía no agregaste objetivos.
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {goals.map((goal) => {
        const targetAmount =
          Number(
            goal.targetAmount
          ) || 0;

        const currentAmount =
          Number(
            goal.currentAmount
          ) || 0;

        const percentage =
          targetAmount > 0
            ? Math.min(
                100,
                Math.max(
                  0,
                  Math.round(
                    (
                      currentAmount /
                      targetAmount
                    ) * 100
                  )
                )
              )
            : 0;

        const isDeleting =
          deletingGoalId ===
          goal.id;

        const goalTitle =
          goal.title ||
          goal.name ||
          "Objetivo";

        const formattedDeadline =
          goal.deadline
            ? goal.deadline
                .split("-")
                .reverse()
                .join("/")
            : "Sin definir";

        return (
          <div
            key={goal.id}
            className={styles.card}
            aria-busy={isDeleting}
          >
            <div className={styles.top}>
              <div>
                <h3
                  className={
                    styles.title
                  }
                >
                  {goalTitle}
                </h3>

                <p
                  className={
                    styles.deadline
                  }
                >
                  Fecha límite:{" "}
                  {formattedDeadline}
                </p>
              </div>

              <div
                className={
                  styles.actions
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    onEdit(goal)
                  }
                  disabled={isDeleting}
                  title="Editar objetivo"
                  aria-label={`Editar objetivo ${goalTitle}`}
                >
                  <i className="bi bi-pencil"></i>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void onDelete(
                      goal.id
                    )
                  }
                  disabled={isDeleting}
                  title="Eliminar objetivo"
                  aria-label={`Eliminar objetivo ${goalTitle}`}
                >
                  <i
                    className={
                      isDeleting
                        ? "bi bi-hourglass-split"
                        : "bi bi-trash"
                    }
                  ></i>
                </button>
              </div>
            </div>

            <div
              className={
                styles.values
              }
            >
              <span>
                Ahorrado: ${" "}
                {currentAmount.toLocaleString(
                  "es-AR",
                  {
                    minimumFractionDigits:
                      0,
                    maximumFractionDigits:
                      2,
                  }
                )}
              </span>

              <span>
                Objetivo: ${" "}
                {targetAmount.toLocaleString(
                  "es-AR",
                  {
                    minimumFractionDigits:
                      0,
                    maximumFractionDigits:
                      2,
                  }
                )}
              </span>
            </div>

            <div
              className={
                styles.progressBar
              }
              role="progressbar"
              aria-label={`Progreso de ${goalTitle}`}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={
                percentage
              }
            >
              <div
                className={
                  styles.progress
                }
                style={{
                  width: `${percentage}%`,
                }}
              ></div>
            </div>

            <p
              className={
                styles.percent
              }
            >
              {percentage}% completado
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default GoalList;